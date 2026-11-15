import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/models";
import { recordClaudeUsage } from "@/lib/usage/service";
import type { TranscriptWord } from "@/lib/types";
import { snapToSentences, toSentences } from "./transcript";

// Reads a timestamped transcript and picks the moments most likely to work as short-form clips.

/** The AI picks each clip's length; this is the ceiling. Longer clips rarely hold attention. */
export const MAX_CLIP_S = 45;
export const MIN_CLIP_S = 10;
export const MAX_CLIPS = 10;

const schema = z.object({
  clips: z
    .array(
      z.object({
        start: z.number().describe("Start time in seconds, the start of a sentence from the transcript"),
        end: z.number().describe("End time in seconds, the end of a sentence from the transcript"),
        title: z.string().describe("A punchy title for YouTube Shorts, max 80 characters, no clickbait lies"),
        hook: z.string().describe("The opening line that grabs attention, quoted or closely paraphrased from the clip"),
        caption: z.string().describe("A post caption: one or two short lines plus 3-5 relevant hashtags"),
        score: z.number().int().describe("0-100: how likely this is to go viral on TikTok, Reels and Shorts"),
        reason: z.string().describe("One sentence on why it works: the hook, payoff, emotion or controversy"),
      }),
    )
    .describe("The best standalone moments, best first"),
});

export type ClipCandidate = z.infer<typeof schema>["clips"][number];

const SYSTEM = `You are a short-form video editor who has cut thousands of viral TikToks, Reels and Shorts from podcasts, interviews, streams and talks.
From a timestamped transcript, pick the moments that would perform best as standalone vertical clips.

A great clip:
- Hooks in the first 3 seconds: a bold claim, a question, a surprising fact, conflict or a strong emotion. Never starts mid-thought.
- Stands alone: a viewer who hasn't seen the rest understands it.
- Has a payoff: a punchline, answer, story ending, or insight. It ends on a complete sentence, ideally right after the payoff.
- Has no dead air or rambling setup.

Rules:
- Use times from the transcript only. Start at the start of a sentence and end at the end of one.
- Clips must not overlap.
- Score honestly; a weak video gets low scores. Return fewer clips rather than padding with weak ones.`;

/** Asks Claude for the best clips, then snaps them to sentence edges and drops anything invalid. */
export async function findClips(
  userId: string,
  projectId: string | null,
  words: TranscriptWord[],
  opts: { title?: string | null },
): Promise<ClipCandidate[]> {
  const sentences = toSentences(words);
  if (!sentences.length) throw new Error("Nobody speaks in this video, so there's nothing to caption or clip.");
  const duration = sentences[sentences.length - 1].end;
  const transcript = sentences.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n");
  const wanted = Math.max(1, Math.min(MAX_CLIPS, Math.round(duration / 240) + 2));

  const response = await anthropic().messages.parse({
    model: MODELS.clips,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          opts.title ? `Video title: ${opts.title}` : null,
          `Video length: ${Math.round(duration)}s.`,
          `Each clip is ${MIN_CLIP_S}-${MAX_CLIP_S}s long. Let the moment set the length: a quick punchline can be 15s, a story can use all ${MAX_CLIP_S}s. Never pad a clip or cut it before its payoff.`,
          `Return up to ${wanted} clips.`,
          "",
          "Transcript (seconds):",
          transcript,
        ]
          .filter((l) => l !== null)
          .join("\n"),
      },
    ],
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
  });
  void recordClaudeUsage(userId, projectId, MODELS.clips, response.usage, "clip-find");

  if (response.stop_reason === "refusal") throw new Error("The AI wouldn't clip this video.");
  const picked = response.parsed_output?.clips;
  if (!picked) throw new Error("The AI's clip list came back incomplete. Try again.");
  return cleanCandidates(picked, sentences, duration);
}

/** Snaps, length-checks, de-overlaps and sorts candidates. Exported for tests. */
export function cleanCandidates(picked: ClipCandidate[], sentences: ReturnType<typeof toSentences>, duration: number): ClipCandidate[] {
  const kept: ClipCandidate[] = [];
  const sorted = [...picked].sort((a, b) => b.score - a.score);
  for (const c of sorted) {
    if (!(c.end > c.start) || c.start < 0 || c.start > duration) continue;
    const snapped = snapToSentences(sentences, c.start, Math.min(c.end, duration + 1));
    const start = snapped.start;
    let end = snapped.end;
    if (end - start > MAX_CLIP_S) {
      // Too long: end on the last sentence that still fits, never mid-sentence.
      const fits = sentences.findLast((s) => s.end > start && s.end + 0.25 - start <= MAX_CLIP_S);
      if (!fits) continue;
      end = fits.end + 0.25;
    }
    if (end - start < MIN_CLIP_S) continue;
    if (kept.some((k) => start < k.end && end > k.start)) continue;
    kept.push({
      ...c,
      start: round(start),
      end: round(end),
      score: Math.max(0, Math.min(100, Math.round(c.score))),
      title: c.title.slice(0, 100),
    });
    if (kept.length >= MAX_CLIPS) break;
  }
  return kept;
}

const round = (n: number) => Math.round(n * 100) / 100;
