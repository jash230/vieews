/** Platform captions from one set of copy, inside each platform's limits. */

export const CAPTION_LIMITS = {
  caption: 2200,
  hashtags: 5,
  youtubeTitle: 100,
  tiktokPhotoTitle: 90,
} as const;

export interface CaptionInput {
  /** The on-screen hook; also the caption's first line. */
  hook: string;
  /** One or two short lines that continue the story. Optional. */
  body?: string;
  /** Where to get the app, e.g. "Free on the App Store: search Tally". */
  cta: string;
  hashtags?: string[];
}

export interface Captions {
  caption: string;
  youtubeTitle: string;
}

const tag = (t: string) => `#${t.replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`;

/** Cuts at a word boundary and adds an ellipsis when needed. */
export function clip(text: string, max: number): string {
  const chars = [...text.trim()];
  if (chars.length <= max) return text.trim();
  const cut = chars.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function buildCaptions(input: CaptionInput): Captions {
  const tags = [...new Set((input.hashtags ?? []).map(tag).filter((t) => t.length > 1))].slice(0, CAPTION_LIMITS.hashtags);
  const parts = [input.hook.trim(), input.body?.trim(), input.cta.trim(), tags.join(" ")].filter(Boolean) as string[];
  const caption = clip(parts.join("\n\n"), CAPTION_LIMITS.caption);
  const youtubeTitle = clip(input.hook.replace(/[<>]/g, "").replace(/\s+/g, " "), CAPTION_LIMITS.youtubeTitle);
  return { caption, youtubeTitle };
}
