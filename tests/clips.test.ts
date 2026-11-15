import { describe, expect, it } from "vitest";
import { assTime, buildAss, displayWord, groupWords, wordsInRange } from "@/lib/clips/captions";
import { clipFilter, detachedCommand, prepareScript, renderScript, shq, videoKbps, CLIP_MAX_BYTES } from "@/lib/clips/render";
import { cleanCandidates, MAX_CLIP_S, type ClipCandidate } from "@/lib/clips/select";
import { parseDeepgram, snapToSentences, toSentences } from "@/lib/clips/transcript";
import type { TranscriptWord } from "@/lib/types";

/** Words 0.3s long, 0.1s apart, starting at `from`. */
function speak(text: string, from = 0): TranscriptWord[] {
  return text.split(" ").map((w, i) => ({ w, s: +(from + i * 0.4).toFixed(2), e: +(from + i * 0.4 + 0.3).toFixed(2) }));
}

describe("captions", () => {
  it("formats ASS times", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(61.234)).toBe("0:01:01.23");
    expect(assTime(3725.5)).toBe("1:02:05.50");
  });

  it("groups at most 3 words and breaks on punctuation and pauses", () => {
    const words = [...speak("this is the best advice, I ever got"), ...speak("seriously", 10)];
    const groups = groupWords(words).map((g) => g.words.map((w) => w.w).join(" "));
    expect(groups).toEqual(["this is the", "best advice,", "I ever got", "seriously"]);
  });

  it("holds a group on screen until the next starts when the gap is short", () => {
    const groups = groupWords(speak("one two three four"));
    expect(groups[0].end).toBe(groups[1].start);
  });

  it("keeps long words from overflowing a line", () => {
    const groups = groupWords(speak("extraordinarily unbelievable outcomes"));
    expect(groups.every((g) => g.words.map((w) => w.w).join(" ").length <= 18 || g.words.length === 1)).toBe(true);
  });

  it("strips ASS control characters and upper-cases words", () => {
    expect(displayWord("{hi}\\there")).toBe("HITHERE");
  });

  it("highlights each word in turn and pops the group in", () => {
    const ass = buildAss(speak("hello big world"));
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(events).toHaveLength(3);
    expect(events[0]).toContain("\\fscx85");
    expect(events[0]).toMatch(/\{\\c&H0000E5FF\}HELLO\{\\c&H00FFFFFF\} BIG WORLD/);
    expect(events[1]).not.toContain("\\fscx85");
    expect(events[2]).toMatch(/BIG \{\\c&H0000E5FF\}WORLD/);
    expect(ass).toContain("PlayResY: 1920");
  });

  it("shifts words to the clip's own timeline", () => {
    const words = speak("a b c d e f", 100);
    const inClip = wordsInRange(words, 100.4, 101.5);
    expect(inClip.map((w) => w.w)).toEqual(["b", "c", "d"]);
    expect(inClip[0].s).toBeCloseTo(0);
  });
});

describe("render scripts", () => {
  it("quotes shell arguments safely", () => {
    expect(shq("it's")).toBe(`'it'\\''s'`);
    expect(prepareScript({ kind: "link", url: "https://x.com/a?b=1&c='$(rm -rf /)'" })).toContain(`'https://x.com/a?b=1&c='\\''$(rm -rf /)'\\'''`);
  });

  it("only fetches yt-dlp for links", () => {
    expect(prepareScript({ kind: "link", url: "https://youtu.be/x" })).toContain("yt-dlp");
    expect(prepareScript({ kind: "file", url: "https://s.example/f.mp4" })).not.toContain("yt-dlp");
  });

  it("records the exit code of a detached phase", () => {
    expect(detachedCommand("prepare")[1]).toContain("echo $? > prepare.done");
  });

  it("centre-crops to 9:16, scales to 1080x1920 and burns captions", () => {
    expect(clipFilter("clip-0.ass")).toBe("crop=w=min(iw\\,ih*9/16):h=min(ih\\,iw*16/9),scale=1080:1920:flags=lanczos,setsar=1,subtitles=clip-0.ass:fontsdir=fonts");
    const script = renderScript(2, 61.5, 101.5);
    expect(script).toContain("-ss 61.500 -i src.mp4 -t 40.000");
    expect(script).toContain("clip-2.mp4");
    expect(script).toContain("clip-2.jpg");
  });

  it("keeps any clip under the storage cap", () => {
    for (const dur of [10, 45, 90, 180]) {
      const bytes = ((videoKbps(dur) + 128) * 1000 * dur) / 8;
      expect(bytes).toBeLessThan(CLIP_MAX_BYTES);
    }
  });
});

describe("transcript", () => {
  it("reads words from a Deepgram response", () => {
    const json = { results: { channels: [{ alternatives: [{ words: [{ word: "hi", punctuated_word: "Hi,", start: 0.123, end: 0.456 }] }] }] } };
    expect(parseDeepgram(json)).toEqual([{ w: "Hi,", s: 0.12, e: 0.46 }]);
    expect(() => parseDeepgram({})).toThrow();
  });

  it("splits sentences and snaps moments to their edges", () => {
    const words = [...speak("First one here."), ...speak("Second sentence now.", 2), ...speak("Third.", 4)];
    const sentences = toSentences(words);
    expect(sentences.map((s) => s.text)).toEqual(["First one here.", "Second sentence now.", "Third."]);
    const snapped = snapToSentences(sentences, 2.5, 3.0);
    expect(snapped.start).toBeCloseTo(1.85);
    expect(snapped.end).toBeCloseTo(3.35);
  });
});

describe("cleanCandidates", () => {
  const sentences = Array.from({ length: 60 }, (_, i) => ({ start: i * 5, end: i * 5 + 4.5, text: `Sentence ${i}.` }));
  const cand = (start: number, end: number, score: number): ClipCandidate => ({ start, end, score, title: "t", hook: "h", caption: "c", reason: "r" });

  it("drops overlaps (keeping the higher score), too-short clips and bad times", () => {
    const out = cleanCandidates([cand(10, 40, 50), cand(20, 50, 90), cand(100, 103, 99), cand(50, 40, 80), cand(200, 240, 70)], sentences, 300);
    expect(out.map((c) => c.score)).toEqual([90, 70]);
  });

  it("caps clip length at the last sentence that fits, never mid-sentence", () => {
    const [c] = cleanCandidates([cand(0, 250, 80)], sentences, 300);
    expect(c.end - c.start).toBeLessThanOrEqual(MAX_CLIP_S);
    expect(sentences.some((s) => Math.abs(s.end + 0.25 - c.end) < 0.01)).toBe(true);
  });
});
