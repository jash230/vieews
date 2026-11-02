import { DEFAULT_MIX, FORMATS, NEURONS_PER_IMAGE, TONES, type Category, type Format, type Tone } from "./catalog";
import { dayIn, engagementOf, type HistoryEntry } from "./history";
import type { Kit } from "./kit";

/**
 * Chooses what the next ad should be. It follows what worked for real apps:
 * - Explore first: try every format the app can do (Alberto tested 5–6 formats in two weeks).
 * - Then exploit: most ads reuse a winning format with a new hook and new images, changing one
 *   thing at a time (Dupe, Clover's 90/10, Stronger reusing winning hooks), while ~30% keep exploring.
 * - Never the same ad twice: no exact hook reuse, no format twice in a row, and an identical
 *   format × angle × hook pattern × tone combination waits 30 days.
 */

export interface PickInput {
  kit: Kit;
  history: HistoryEntry[];
  now: Date;
  seed: number;
  /** Free image budget left today (Workers AI neurons). */
  neuronsLeft: number;
  timeZone?: string;
  mix?: Record<Category, number>;
}

export interface Candidate {
  format: string;
  formatName: string;
  category: Category;
  output: "slides" | "video";
  angle: string;
  hookPattern: string;
  tone: Tone;
  persona: string | null;
  mode: "explore" | "exploit";
  /** The winning ad this varies, in exploit mode. */
  variantOf: string | null;
  score: number;
  why: string[];
}

export interface PickResult {
  candidates: Candidate[];
  /** Hooks already used for this app: never reuse one word for word. */
  usedHooks: string[];
  recent: Pick<HistoryEntry, "format" | "hookPattern" | "hook" | "angle" | "createdAt">[];
  adsToday: number;
  adsPerDay: number;
  winners: { adId: string; format: string; hookPattern: string; hook: string; views: number }[];
}

const COMBO_COOLDOWN_DAYS = 30;
const EXPLOIT_SHARE = 0.7;
const RECENT_WINDOW = 10;

/** Small deterministic PRNG so a given seed always picks the same thing (testable). */
export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const comboKey = (c: { format: string; angle: string; hookPattern: string; tone: string }) => `${c.format}|${c.angle}|${c.hookPattern}|${c.tone}`;

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A winner did ≥3× the app's median views, or ≥10K views with ≥3% engagement. */
export function winnersOf(history: HistoryEntry[]): HistoryEntry[] {
  const measured = history.filter((h) => h.metrics && h.metrics.views > 0);
  const med = measured.length >= 5 ? median(measured.map((h) => h.metrics!.views)) : Infinity;
  return measured
    .filter((h) => h.metrics!.views >= 3 * med || (h.metrics!.views >= 10_000 && engagementOf(h.metrics!) >= 0.03))
    .sort((a, b) => b.metrics!.views - a.metrics!.views);
}

export function formatsFor(kit: Kit, neuronsLeft: number): Format[] {
  return FORMATS.filter(
    (f) =>
      !kit.formats.deny.includes(f.id) &&
      kit.screens.length >= f.needs.screens &&
      (!f.needs.beforeAfter || kit.beforeAfter) &&
      f.needs.aiImages * NEURONS_PER_IMAGE <= neuronsLeft,
  );
}

/** Index of the most recent use (0 = last ad); Infinity if never used. */
function lastUse<T>(history: HistoryEntry[], get: (h: HistoryEntry) => T, value: T): number {
  const i = history.findIndex((h) => get(h) === value);
  return i === -1 ? Infinity : i;
}

/** Options ordered from least to most recently used (never-used first, random among ties). */
function byLeastRecent<T>(options: readonly T[], history: HistoryEntry[], get: (h: HistoryEntry) => T, random: () => number): T[] {
  return options
    .map((o) => ({ o, last: lastUse(history, get, o), tie: random() }))
    .sort((a, b) => (b.last === a.last ? a.tie - b.tie : b.last - a.last))
    .map((x) => x.o);
}

const leastRecent = <T>(options: readonly T[], history: HistoryEntry[], get: (h: HistoryEntry) => T, random: () => number): T =>
  byLeastRecent(options, history, get, random)[0];

export function pick(input: PickInput): PickResult {
  const { kit, now, seed } = input;
  const random = rng(seed);
  const tz = input.timeZone ?? "UTC";
  const mix = input.mix ?? DEFAULT_MIX;
  const history = input.history.filter((h) => h.app === kit.slug).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recent = history.slice(0, RECENT_WINDOW);
  const cooldownStart = new Date(now.getTime() - COMBO_COOLDOWN_DAYS * 86_400_000).toISOString();
  const recentCombos = new Set(history.filter((h) => h.createdAt >= cooldownStart).map(comboKey));

  const available = formatsFor(kit, input.neuronsLeft);
  const angles = [...kit.pains, ...kit.desires];
  const tones: readonly Tone[] = TONES;
  const personas = kit.personas.length ? kit.personas : [kit.audience];
  const winners = winnersOf(history);

  const build = (format: Format, mode: Candidate["mode"], why: string[], fixed?: Partial<Candidate>): Candidate | null => {
    // Try angles and tones from least to most recently used until the combination is fresh.
    const hookPattern = fixed?.hookPattern ?? leastRecent(format.hooks, history, (h) => h.hookPattern, random);
    const toneOrder = byLeastRecent(tones, history, (h) => h.tone as Tone, random);
    for (const angle of byLeastRecent(angles, history, (h) => h.angle, random)) {
      for (const tone of toneOrder) {
        const c = { format: format.id, angle, hookPattern, tone };
        if (recentCombos.has(comboKey(c))) continue;
        return {
          ...c,
          formatName: format.name,
          category: format.category,
          output: format.output,
          persona: format.category === "person" ? leastRecent(personas, history, (h) => h.persona ?? "", random) : null,
          mode,
          variantOf: fixed?.variantOf ?? null,
          score: 0,
          why,
        };
      }
    }
    return null;
  };

  const candidates: Candidate[] = [];
  const lastFormat = history[0]?.format;

  // Exploit: reuse a winner's format and hook pattern with a new angle, hook and images.
  const exploitable = winners.filter((w) => available.some((f) => f.id === w.format) && (w.format !== lastFormat || available.length === 1));
  if (exploitable.length && random() < EXPLOIT_SHARE) {
    const w = exploitable[Math.floor(random() * Math.min(3, exploitable.length))];
    const c = build(available.find((f) => f.id === w.format)!, "exploit", [`varies winner ${w.adId} (${w.metrics!.views} views): same format and hook pattern, new angle and hook`], {
      hookPattern: w.hookPattern,
      variantOf: w.adId,
    });
    if (c) candidates.push({ ...c, score: 10 });
  }

  // Explore: weight formats by the mix, favor ones this app hasn't tried, avoid repeats.
  const perCategory = (cat: Category) => available.filter((f) => f.category === cat).length || 1;
  for (const format of available) {
    if (format.id === lastFormat && available.length > 1) continue;
    const why: string[] = [];
    let score = (mix[format.category] ?? 0) / perCategory(format.category);
    score *= kit.formats.weights[format.id] ?? 1;
    const uses = recent.filter((h) => h.format === format.id).length;
    if (!history.some((h) => h.format === format.id)) {
      score *= 2;
      why.push("not tried for this app yet");
    } else if (uses) {
      score *= 0.5 ** uses;
      why.push(`used ${uses}× in the last ${RECENT_WINDOW} ads`);
    }
    const won = winners.filter((w) => w.format === format.id).length;
    if (won) {
      score *= 1 + won;
      why.push(`${won} winning ad${won > 1 ? "s" : ""} in this format`);
    }
    score *= 0.75 + 0.5 * random();
    const c = build(format, "explore", why);
    if (c) candidates.push({ ...c, score: Math.round(score * 1000) / 1000 });
  }

  candidates.sort((a, b) => b.score - a.score);
  const today = dayIn(now, tz);
  return {
    candidates: candidates.slice(0, 5),
    usedHooks: history.map((h) => h.hook).slice(0, 200),
    recent: recent.map(({ format, hookPattern, hook, angle, createdAt }) => ({ format, hookPattern, hook, angle, createdAt })),
    adsToday: history.filter((h) => dayIn(h.createdAt, tz) === today).length,
    adsPerDay: kit.adsPerDay,
    winners: winners.slice(0, 5).map((w) => ({ adId: w.adId, format: w.format, hookPattern: w.hookPattern, hook: w.hook, views: w.metrics!.views })),
  };
}

/** Neurons already spent today across all apps (they share one free allowance, which resets at 00:00 UTC). */
export function neuronsUsedToday(history: HistoryEntry[], now: Date): number {
  const today = dayIn(now, "UTC");
  return history.filter((h) => dayIn(h.createdAt, "UTC") === today).reduce((sum, h) => sum + h.neurons, 0);
}
