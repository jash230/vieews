import { z } from "zod";

// What the copilot and the ad pipeline know about an app. Mirrors Ad Studio's app.md frontmatter
// (ad-studio/studio/src/kit.ts), except screens, logo and photos live in project_media.
// Every field has a default so a half-finished draft can be saved and filled in later.

const list = z.array(z.string().trim().min(1)).default([]);

export const projectKitSchema = z.object({
  oneLiner: z.string().trim().max(160).default(""),
  /** Who it's for, specifically. */
  audience: z.string().trim().default(""),
  /** Core desires it serves: status, calm, money, attraction, belonging… */
  desires: list,
  /** Pains in the audience's own words. These become ad angles. */
  pains: list,
  /** Outcomes the app really delivers (no invented numbers). */
  outcomes: list,
  /** The one moment that makes people ask "what app is that?" */
  magicMoment: z
    .object({ description: z.string().trim().default(""), mediaIds: z.array(z.string().uuid()).default([]) })
    .prefault({}),
  /** True when the app produces a visible change worth a before/after. */
  beforeAfter: z.boolean().default(false),
  claims: z
    .object({
      /** Statements ads may make. Everything else is off limits. */
      allowed: list,
      banned: list,
    })
    .prefault({}),
  /** How the ad says where to get it, e.g. "Free on the App Store — search Tally". */
  cta: z.string().trim().default(""),
  tone: list,
  /** People who'd plausibly use it, for AI-person formats. */
  personas: list,
  brand: z
    .object({
      primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#111111"),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#25F4EE"),
      font: z.enum(["tiktok-sans", "inter"]).default("tiktok-sans"),
    })
    .prefault({}),
  hashtags: list,
  language: z.string().default("en"),
});

export type ProjectKit = z.infer<typeof projectKitSchema>;
export type ProjectKitInput = z.input<typeof projectKitSchema>;

export const emptyKit = (): ProjectKit => projectKitSchema.parse({});

/** Fields an ad can't be made without, in the order the user should fill them. */
export function kitGaps(kit: ProjectKit, screenCount: number): string[] {
  const gaps: string[] = [];
  if (!kit.oneLiner) gaps.push("one-line pitch");
  if (!kit.audience) gaps.push("audience");
  if (!kit.pains.length) gaps.push("pains");
  if (!kit.claims.allowed.length) gaps.push("claims ads may make");
  if (!kit.cta) gaps.push("call to action");
  if (!screenCount) gaps.push("screenshots");
  return gaps;
}
