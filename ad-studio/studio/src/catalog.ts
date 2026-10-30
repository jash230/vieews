/**
 * Ad formats and hook patterns, each copied from something that worked for a real app.
 * The full recipes (beats, rules, examples, sources) are in skills/make-ad/references/formats.md
 * and hooks.md; this file is what the picker reasons over.
 */

export type Category = "slideshow" | "screen" | "person";

export interface FormatNeeds {
  /** Minimum app screenshots in the kit. */
  screens: number;
  /** AI-generated images per ad (estimate, for the daily free image budget). */
  aiImages: number;
  /** The app shows a visible transformation (before/after). */
  beforeAfter?: boolean;
}

export interface Format {
  id: string;
  name: string;
  category: Category;
  output: "slides" | "video";
  needs: FormatNeeds;
  /** Hook patterns that fit this format, best first. */
  hooks: string[];
  /** Who it's copied from (details and links in formats.md). */
  source: string;
}

export const FORMATS: Format[] = [
  { id: "S1", name: "Pain, hard fixes, app as the easy fix", category: "slideshow", output: "slides", needs: { screens: 1, aiImages: 1 }, hooks: ["warning-flip", "relatable-story", "secret", "list"], source: "Superwall Podcast agency pattern; Pep AI; Flame" },
  { id: "S2", name: "Before/after, then the app", category: "slideshow", output: "slides", needs: { screens: 1, aiImages: 2, beforeAfter: true }, hooks: ["emotional-confession", "pov", "question"], source: "GlamUp (10M views); Umax" },
  { id: "S3", name: "Text-message drama resolved by the app", category: "slideshow", output: "slides", needs: { screens: 1, aiImages: 0 }, hooks: ["relatable-story", "question", "pov"], source: "Knownwell (438K views)" },
  { id: "S5", name: "Value list with a money slide", category: "slideshow", output: "slides", needs: { screens: 2, aiImages: 1 }, hooks: ["list", "warning-flip", "secret"], source: "Sway AI (4M-view post); Curiosity Quench" },
  { id: "S6", name: "Larry 6-slide: someone doubted it, I showed them", category: "slideshow", output: "slides", needs: { screens: 2, aiImages: 2 }, hooks: ["doubter"], source: "Larry / Oliver Henry (Snugly, Liply)" },
  { id: "S4", name: "Selfie cover with a tension hook, then app screens", category: "person", output: "slides", needs: { screens: 2, aiImages: 1 }, hooks: ["tension-fragment", "pov", "credential-pain", "emotional-confession"], source: "Stronger (725 posts, 11 over 1M); BePresent" },
  { id: "V1", name: "Magic-moment demo", category: "screen", output: "video", needs: { screens: 2, aiImages: 0 }, hooks: ["watch-me", "pov", "question", "warning-flip"], source: "Cal AI core screens; Sprout 6.7s clip; Halo AI loading screen" },
  { id: "V2", name: "Voiceover tutorial over app screens", category: "screen", output: "video", needs: { screens: 3, aiImages: 0 }, hooks: ["watch-me", "question", "identity-goal", "secret"], source: "Shot Pattern ($1.57/install); Payout" },
  { id: "V3", name: "Animated text story with an app payoff", category: "screen", output: "video", needs: { screens: 1, aiImages: 0 }, hooks: ["relatable-story", "pov", "doubter"], source: "Halo AI (1.2B views); Knownwell" },
  { id: "V4", name: "AI person, silent hook, then app screens", category: "person", output: "video", needs: { screens: 2, aiImages: 1 }, hooks: ["credential-pain", "identity-goal", "tension-fragment", "emotional-confession"], source: "SideShift (9.6M views); BePresent selfie + text" },
];

export interface HookPattern {
  id: string;
  template: string;
  source: string;
}

export const HOOK_PATTERNS: HookPattern[] = [
  { id: "question", template: "Open a question and don't answer it in the hook.", source: "The Evolved Founder: question hook 50K views vs 500 for the answer" },
  { id: "warning-flip", template: "Stop doing X / Don't X before you see this / Stop using [named enemy] for Y.", source: "r/SideProject 4.4M views; Massive 'Stop using LinkedIn'" },
  { id: "secret", template: "The thing nobody tells you about X.", source: "r/SideProject slideshow formula" },
  { id: "relatable-story", template: "A specific first-person moment, e.g. 'My boss fired me and I'm glad he did'.", source: "r/SideProject; Knownwell 'I think you left your toothbrush…'" },
  { id: "identity-goal", template: "If you [identity] but you're trying to [goal], you need to see this.", source: "FaithFull's top Meta ad (Arcads AI actor)" },
  { id: "tension-fragment", template: "A short loaded fragment: 'Grandpa was right', 'Skipping legs…'.", source: "Stronger" },
  { id: "pov", template: "POV: you [situation the app fixes / result].", source: "Umax 'POV: you use the Umax app to glow up'" },
  { id: "watch-me", template: "Watch me [get result] in [short time].", source: "Payout 'Watch me make up to $900 in just 30 seconds'" },
  { id: "doubter", template: "[Person] said [doubt] so I showed them [the app].", source: "Larry slideshows" },
  { id: "emotional-confession", template: "Short emotional line + emojis on its own line, e.g. 'never saw myself with the / right makeup routine / 😭😭'.", source: "GlamUp fixed hook (10M views)" },
  { id: "credential-pain", template: "I have [credential] and [painful situation].", source: "SideShift 'I have a master's degree and couldn't find a job'" },
  { id: "list", template: "N [things/mistakes/hobbies] that [benefit] — the app is one item.", source: "Sway AI 'five mistakes when flirting over text'; Curiosity Quench 'most attractive hobbies'" },
];

export const TONES = ["funny", "earnest", "dramatic", "aesthetic", "blunt"] as const;
export type Tone = (typeof TONES)[number];

/** Mix before there's performance data: views from slideshows, installs from screen-led demos. */
export const DEFAULT_MIX: Record<Category, number> = { slideshow: 0.4, screen: 0.4, person: 0.2 };

export const formatById = (id: string) => FORMATS.find((f) => f.id === id);

/** Neuron cost of one generated image (flux-2-klein-4b at 720×1280, ~4 output tiles). */
export const NEURONS_PER_IMAGE = 110;
