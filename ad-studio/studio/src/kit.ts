import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

/** ad-studio/ (this file lives in ad-studio/studio/src). */
export const STUDIO_ROOT = resolve(import.meta.dirname, "../..");
export const APPS_DIR = join(STUDIO_ROOT, "apps");

const screenSchema = z.object({
  /** Path inside the kit's media folder, e.g. screens/result.png */
  file: z.string().min(1),
  /** What the screen shows, in plain words. */
  shows: z.string().min(1),
  /** magic: part of the core "wow" moment. result/before/after/home/onboarding/paywall… */
  tags: z.array(z.string()).default([]),
});

export const kitSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  oneLiner: z.string().min(1).max(160),
  /** Who it's for, specifically. */
  audience: z.string().min(1),
  /** Core desires it serves (Blake Anderson): attraction, status, self-improvement, entertainment, money, belonging, calm… */
  desires: z.array(z.string()).min(1),
  /** Pains in the audience's own words. These become angles. */
  pains: z.array(z.string()).min(1),
  /** Outcomes the app really delivers (no invented numbers). */
  outcomes: z.array(z.string()).default([]),
  /** The one moment that makes people ask "what app is that?" */
  magicMoment: z.object({ description: z.string().min(1), screens: z.array(z.string()).min(1) }),
  screens: z.array(screenSchema).min(1),
  logo: z.string().optional(),
  /** Real photos you provide (people, product, results). Preferred over AI images when they fit. */
  photos: z.array(z.object({ file: z.string(), shows: z.string() })).default([]),
  /** True when the app produces a visible change worth a before/after. */
  beforeAfter: z.boolean().default(false),
  claims: z.object({
    /** Statements ads may make. Everything else is off limits. */
    allowed: z.array(z.string()).min(1),
    banned: z.array(z.string()).default([]),
  }),
  /** How the ad should say where to get it, e.g. "Free on the App Store — search Tally". */
  cta: z.string().min(1),
  tone: z.array(z.string()).default([]),
  /** People who'd plausibly use it, for AI-person formats (e.g. "college student cramming for finals"). */
  personas: z.array(z.string()).default([]),
  brand: z
    .object({ primary: z.string().default("#111111"), accent: z.string().default("#25F4EE"), font: z.enum(["tiktok-sans", "inter"]).default("tiktok-sans") })
    .default({ primary: "#111111", accent: "#25F4EE", font: "tiktok-sans" }),
  hashtags: z.array(z.string()).default([]),
  language: z.string().default("en"),
  formats: z
    .object({
      deny: z.array(z.string()).default([]),
      /** Multiplies a format's chance, e.g. { V1: 1.5 }. */
      weights: z.record(z.string(), z.number().min(0)).default({}),
    })
    .default({ deny: [], weights: {} }),
  adsPerDay: z.number().int().min(0).max(30).default(10),
});
export type Kit = z.infer<typeof kitSchema>;

export interface LoadedKit {
  kit: Kit;
  /** Free-form notes after the frontmatter: voice, things to avoid, examples. */
  notes: string;
  dir: string;
  mediaDir: string;
}

export function splitFrontmatter(source: string): { data: unknown; body: string } {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("app.md must start with YAML frontmatter between --- lines");
  return { data: parse(m[1]), body: m[2].trim() };
}

/** Problems a kit can't render with: missing files, magic-moment screens that aren't listed. */
export function kitProblems(kit: Kit, fileExists: (relPath: string) => boolean): string[] {
  const problems: string[] = [];
  const files = new Set(kit.screens.map((s) => s.file));
  for (const s of kit.screens) if (!fileExists(s.file)) problems.push(`Missing screen file media/${s.file}`);
  for (const p of kit.photos) if (!fileExists(p.file)) problems.push(`Missing photo file media/${p.file}`);
  if (kit.logo && !fileExists(kit.logo)) problems.push(`Missing logo media/${kit.logo}`);
  for (const f of kit.magicMoment.screens) if (!files.has(f)) problems.push(`magicMoment screen ${f} isn't in screens`);
  return problems;
}

export function loadKit(slug: string, appsDir = APPS_DIR): LoadedKit {
  const dir = join(appsDir, slug);
  const path = join(dir, "app.md");
  if (!existsSync(path)) throw new Error(`No kit at ${path}`);
  const { data, body } = splitFrontmatter(readFileSync(path, "utf8"));
  const parsed = kitSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`${path} is invalid:\n${parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const mediaDir = join(dir, "media");
  const problems = kitProblems(parsed.data, (rel) => existsSync(join(mediaDir, rel)));
  if (problems.length) throw new Error(`${path}:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  return { kit: parsed.data, notes: body, dir, mediaDir };
}

export function listKits(appsDir = APPS_DIR): string[] {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(appsDir, d.name, "app.md")))
    .map((d) => d.name);
}
