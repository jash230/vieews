import { z } from "zod";

/**
 * One ad, as a list of scenes. The same spec renders as swipeable slides (one still per scene,
 * for TikTok photo posts and Instagram carousels) and as a vertical video (for YouTube Shorts,
 * Reels and TikTok video). Media paths are relative to the run folder, or "kit:<path>" for a
 * file in the app kit's media folder.
 */

export const FPS = 30;
export const SIZES = {
  /** TikTok / Reels / Shorts, and TikTok photo slides. */
  vertical: { width: 1080, height: 1920 },
  /** Instagram carousels only accept 4:5 to 1.91:1. */
  portrait: { width: 1080, height: 1350 },
} as const;
export type SizeName = keyof typeof SIZES;

const mediaPath = z.string().min(1);

export const textSchema = z.object({
  text: z.string().min(1).max(240),
  /** Vertical placement inside the platform safe zone. */
  position: z.enum(["top", "upper", "center", "lower"]).default("upper"),
  /**
   * outline: TikTok's classic white text with black stroke. box: TikTok's white label boxes.
   * clean: white with a soft shadow. small: small, off-center "Gen Z" text (GlamUp). headline: 1–4 huge words.
   */
  style: z.enum(["outline", "box", "clean", "small", "headline"]).default("outline"),
  align: z.enum(["center", "left"]).default("center"),
});
export type SceneText = z.infer<typeof textSchema>;

const voiceSchema = z.object({
  /** WAV from `npm run voice`. */
  src: mediaPath,
  /** What it says; shown as word-by-word captions. */
  text: z.string().min(1),
  durationS: z.number().positive(),
});

const common = {
  durationS: z.number().min(0.5).max(15).default(2.5),
  text: textSchema.optional(),
  voice: voiceSchema.optional(),
};

export const sceneSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("photo"),
    ...common,
    src: mediaPath,
    motion: z.enum(["none", "zoom-in", "zoom-out", "pan-up", "pan-down", "handheld"]).default("zoom-in"),
    /** Darkens the photo so text reads (0–0.6). */
    dim: z.number().min(0).max(0.6).default(0.15),
  }),
  z.object({
    type: z.literal("screen"),
    ...common,
    src: mediaPath,
    /** phone: screenshot inside a phone. full: screenshot fills the frame. */
    frame: z.enum(["phone", "full"]).default("phone"),
    /** Punch in on a point of the screenshot (0–1 coordinates). */
    zoom: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), scale: z.number().min(1).max(3) }).optional(),
    /** Show a tap ripple at a point (0–1 coordinates). */
    tap: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
    background: z.string().optional(),
  }),
  z.object({
    type: z.literal("chat"),
    ...common,
    contact: z.string().min(1).max(40),
    messages: z.array(z.object({ from: z.enum(["me", "them"]), text: z.string().min(1).max(200) })).min(1).max(8),
  }),
  z.object({
    type: z.literal("text"),
    ...common,
    text: textSchema,
    /** Solid color, CSS gradient, or a media path (shown blurred). */
    background: z.string().default("#111111"),
  }),
  z.object({
    type: z.literal("split"),
    ...common,
    before: mediaPath,
    after: mediaPath,
    labels: z.tuple([z.string().max(24), z.string().max(24)]).default(["before", "after"]),
  }),
  z.object({
    type: z.literal("end"),
    ...common,
    logo: mediaPath.optional(),
    appName: z.string().min(1).max(40),
    line: z.string().min(1).max(80),
    sub: z.string().max(80).optional(),
  }),
]);
export type Scene = z.infer<typeof sceneSchema>;

export const themeSchema = z.object({
  primary: z.string().default("#111111"),
  accent: z.string().default("#25F4EE"),
  font: z.enum(["tiktok-sans", "inter"]).default("tiktok-sans"),
});
export type Theme = z.infer<typeof themeSchema>;

export const adSpecSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,64}$/, "lowercase letters, digits and dashes"),
  /** slides: TikTok photo post + Instagram carousel + a video version for YouTube. video: one video everywhere. */
  kind: z.enum(["slides", "video"]),
  theme: themeSchema.default({ primary: "#111111", accent: "#25F4EE", font: "tiktok-sans" }),
  scenes: z.array(sceneSchema).min(1).max(12),
  /** Optional background music for the video version (royalty-free file you own). */
  music: z.object({ src: mediaPath, volume: z.number().min(0).max(1).default(0.25) }).optional(),
});
export type AdSpec = z.infer<typeof adSpecSchema>;

/** Scene length on screen: long enough for its voiceover. */
export function sceneDurationS(scene: Scene): number {
  return Math.max(scene.durationS, scene.voice ? scene.voice.durationS + 0.35 : 0);
}

export function totalFrames(spec: Pick<AdSpec, "scenes">): number {
  return spec.scenes.reduce((sum, s) => sum + Math.round(sceneDurationS(s) * FPS), 0);
}

/** Every media path the spec uses, so the renderer can stage just those files. */
export function mediaPaths(spec: AdSpec): string[] {
  const paths = new Set<string>();
  for (const s of spec.scenes) {
    if (s.voice) paths.add(s.voice.src);
    if (s.type === "photo" || s.type === "screen") paths.add(s.src);
    if (s.type === "split") {
      paths.add(s.before);
      paths.add(s.after);
    }
    if (s.type === "end" && s.logo) paths.add(s.logo);
    if (s.type === "text" && isMediaBackground(s.background)) paths.add(s.background);
  }
  if (spec.music) paths.add(spec.music.src);
  return [...paths];
}

export const isMediaBackground = (bg: string) => /\.(png|jpe?g|webp)$/i.test(bg);

/** Splits a voiceover line into 3-word caption pages (TikTok style), timed by length. */
export function captionPages(text: string, durationS: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const pages: string[][] = [];
  for (let i = 0; i < words.length; i += 3) pages.push(words.slice(i, i + 3));
  const total = words.join("").length || 1;
  let at = 0;
  return pages.map((page) => {
    const len = (page.join("").length / total) * durationS;
    const out = { words: page, startS: at, endS: at + len };
    at += len;
    return out;
  });
}
