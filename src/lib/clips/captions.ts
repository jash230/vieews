import type { TranscriptWord } from "@/lib/types";

// Builds an ASS subtitle file with CapCut-style captions: a few words at a time in big bold
// caps, the word being spoken highlighted, and each group popping in. ffmpeg burns it in with libass.

export const CAPTION_STYLE = {
  font: "Montserrat ExtraBold",
  size: 92,
  /** Max words on screen at once. */
  maxWords: 3,
  /** Max characters on screen at once, so a group fits one line at 1080px. */
  maxChars: 18,
  /** A pause longer than this starts a new group. */
  maxGapS: 0.6,
  /** Distance from the bottom edge: lower-middle of the frame, clear of platform UI. */
  marginV: 560,
} as const;

// ASS colours are &HAABBGGRR.
const WHITE = "&H00FFFFFF";
const BLACK = "&H00000000";
const YELLOW = "&H0000E5FF";

export interface CaptionGroup {
  words: TranscriptWord[];
  start: number;
  end: number;
}

/** The words spoken inside [start, end], with times relative to the clip start. */
export function wordsInRange(words: TranscriptWord[], start: number, end: number): TranscriptWord[] {
  return words
    .filter((w) => w.e > start && w.s < end)
    .map((w) => ({ w: w.w, s: Math.max(0, w.s - start), e: Math.min(end - start, w.e - start) }));
}

const endsSentence = (w: string) => /[.!?…]["')\]]?$/.test(w);
const endsClause = (w: string) => /[,;:]$/.test(w);

/** Splits words into on-screen groups at pauses, punctuation and length limits. */
export function groupWords(words: TranscriptWord[], style = CAPTION_STYLE): CaptionGroup[] {
  const groups: CaptionGroup[] = [];
  let current: TranscriptWord[] = [];
  const flush = () => {
    if (!current.length) return;
    groups.push({ words: current, start: current[0].s, end: current[current.length - 1].e });
    current = [];
  };
  for (const word of words) {
    const prev = current[current.length - 1];
    const chars = current.reduce((n, w) => n + w.w.length + 1, 0) + word.w.length;
    if (prev && (current.length >= style.maxWords || chars > style.maxChars || word.s - prev.e > style.maxGapS)) flush();
    current.push(word);
    if (endsSentence(word.w) || endsClause(word.w)) flush();
  }
  flush();
  // Hold each group until the next one starts (up to the gap limit) so captions don't flicker.
  for (let i = 0; i < groups.length - 1; i++) {
    const next = groups[i + 1];
    if (next.start - groups[i].end <= style.maxGapS) groups[i].end = next.start;
  }
  return groups;
}

/** h:mm:ss.cc, the ASS time format. */
export function assTime(seconds: number): string {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/** Text as it appears on screen: caps, without ASS control characters. */
export function displayWord(w: string): string {
  return w.replace(/[{}\\]/g, "").toUpperCase();
}

/**
 * The whole .ass file for one clip. `words` must already be relative to the clip start (see
 * wordsInRange). Each word gets one event showing its group, with that word in yellow.
 */
export function buildAss(words: TranscriptWord[], style = CAPTION_STYLE): string {
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,${style.font},${style.size},${WHITE},${WHITE},${BLACK},&H80000000,-1,0,0,0,100,100,0,0,1,7,3,2,60,60,${style.marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const events: string[] = [];
  for (const group of groupWords(words, style)) {
    group.words.forEach((word, i) => {
      const start = i === 0 ? group.start : word.s;
      const end = i === group.words.length - 1 ? group.end : group.words[i + 1].s;
      if (end <= start) return;
      const text = group.words
        .map((w, j) => (j === i ? `{\\c${YELLOW}}${displayWord(w.w)}{\\c${WHITE}}` : displayWord(w.w)))
        .join(" ");
      // The group pops in on its first word, then holds still while the highlight moves.
      const pop = i === 0 ? "{\\fscx85\\fscy85\\t(0,90,\\fscx100\\fscy100)}" : "";
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,0,,${pop}${text}`);
    });
  }
  return [...header, ...events, ""].join("\n");
}
