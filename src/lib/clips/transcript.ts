import type { TranscriptWord } from "@/lib/types";

/** Deepgram charges about this per audio minute (Nova-3, pay as you go). */
export const DEEPGRAM_USD_PER_MIN = 0.0043;

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
}

/** Words with timings from a Deepgram pre-recorded response. */
export function parseDeepgram(json: unknown): TranscriptWord[] {
  const words = (json as { results?: { channels?: { alternatives?: { words?: DeepgramWord[] }[] }[] } })?.results?.channels?.[0]?.alternatives?.[0]?.words;
  if (!Array.isArray(words)) throw new Error("The transcription came back empty.");
  return words
    .filter((w) => typeof w.start === "number" && typeof w.end === "number")
    .map((w) => ({ w: (w.punctuated_word ?? w.word).trim(), s: round(w.start), e: round(w.end) }))
    .filter((w) => w.w);
}

const round = (n: number) => Math.round(n * 100) / 100;

export interface Sentence {
  start: number;
  end: number;
  text: string;
}

/** Joins words into sentences (or 25-word chunks when nobody uses full stops) for the AI to read. */
export function toSentences(words: TranscriptWord[]): Sentence[] {
  const out: Sentence[] = [];
  let cur: TranscriptWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ start: cur[0].s, end: cur[cur.length - 1].e, text: cur.map((w) => w.w).join(" ") });
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (prev && w.s - prev.e > 1.5) flush();
    cur.push(w);
    if (/[.!?…]["')\]]?$/.test(w.w) || cur.length >= 25) flush();
  }
  flush();
  return out;
}

/** Snaps a moment to sentence edges: the start to the sentence it falls in, the end to the sentence end. */
export function snapToSentences(sentences: Sentence[], start: number, end: number): { start: number; end: number } {
  const first = sentences.find((s) => s.end > start) ?? sentences[0];
  const last = [...sentences].reverse().find((s) => s.start < end) ?? sentences[sentences.length - 1];
  if (!first || !last) return { start, end };
  // A small lead-in and tail so the first and last words aren't clipped.
  return { start: Math.max(0, first.start - 0.15), end: Math.max(first.start + 1, last.end + 0.25) };
}
