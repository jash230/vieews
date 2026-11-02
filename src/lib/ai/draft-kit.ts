import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Listing } from "@/lib/projects/import";
import type { ProjectKitInput } from "@/lib/projects/kit";
import { recordClaudeUsage } from "@/lib/usage/service";
import { anthropic } from "./client";
import { MODELS } from "./models";

// Drafts a project's kit from its store listing, for the user to review before saving.

const MAX_IMAGES = 6;

const hex = z.string().describe("A #RRGGBB color");

const draftSchema = z.object({
  oneLiner: z.string().describe("What the app does, one sentence, max 140 characters"),
  audience: z.string().describe("A specific person and the moment they'd want it, not 'everyone'"),
  desires: z.array(z.string()).describe("1-3 core desires it serves, e.g. status, calm, money, self-improvement"),
  pains: z.array(z.string()).describe("3-6 pains in the audience's own words"),
  outcomes: z.array(z.string()).describe("What the app really delivers, from the listing; no invented numbers"),
  magicMoment: z.object({
    description: z.string().describe("The one moment that makes people ask 'what app is that?'"),
    screenIndexes: z.array(z.number().int()).describe("Indexes of the screenshots that show it"),
  }),
  beforeAfter: z.boolean().describe("True only if the app produces a visible before/after change"),
  claimsAllowed: z.array(z.string()).describe("Plain facts the listing supports, safe for ads to state"),
  claimsBanned: z.array(z.string()).describe("Things ads must never say (numbers, guarantees, other platforms)"),
  cta: z.string().describe("Where to get it, e.g. 'Free on the App Store: search Tally'"),
  tone: z.array(z.string()).describe("2-3 words for the voice"),
  personas: z.array(z.string()).describe("2-3 realistic adults who'd use it, with a detail, for AI-person ad formats"),
  hashtags: z.array(z.string()).describe("3-5 hashtags without #"),
  brandPrimary: hex,
  brandAccent: hex,
  screens: z
    .array(z.object({ index: z.number().int(), shows: z.string(), tags: z.array(z.string()) }))
    .describe("One entry per screenshot: what it shows in plain words; tags like magic, result, home, onboarding, paywall"),
});

export interface KitDraft {
  kit: ProjectKitInput;
  /** Per screenshot (same order as listing.screenshotUrls). */
  screens: { shows: string; tags: string[] }[];
}

const SYSTEM = `You set up ad campaigns for mobile apps and websites. From a store listing and its screenshots, draft the facts that every future ad will be built on.
Be honest: claims must be supported by the listing, never invent numbers, ratings, user counts or features. Prefer the audience's own words for pains. If something isn't knowable from the listing, give your best plain guess; the owner reviews everything before it's saved.`;

export async function draftKit(userId: string, projectId: string | null, listing: Listing): Promise<KitDraft> {
  const images = listing.screenshotUrls.slice(0, MAX_IMAGES);
  const content: Anthropic.ContentBlockParam[] = [
    ...images.flatMap((url, i): Anthropic.ContentBlockParam[] => [
      { type: "text", text: `Screenshot ${i}:` },
      { type: "image", source: { type: "url", url } },
    ]),
    {
      type: "text",
      text: [
        `Name: ${listing.name}`,
        listing.developer && `Developer: ${listing.developer}`,
        listing.category && `Category: ${listing.category}`,
        `Source: ${listing.source} (${listing.storeUrl})`,
        `Description:\n${listing.description.slice(0, 6000)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  const response = await anthropic().messages.parse({
    model: MODELS.draft,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: zodOutputFormat(draftSchema) },
  });
  void recordClaudeUsage(userId, projectId, MODELS.draft, response.usage, "draft-kit");

  if (response.stop_reason === "refusal") throw new Error("The AI couldn't draft this app. Fill in the details by hand.");
  const d = response.parsed_output;
  if (!d) throw new Error("The AI draft came back incomplete. Try again or fill in the details by hand.");

  const validIndex = (i: number) => Number.isInteger(i) && i >= 0 && i < images.length;
  const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);
  const screens = images.map((_, i) => {
    const s = d.screens.find((x) => x.index === i);
    return { shows: s?.shows ?? "", tags: s?.tags ?? [] };
  });
  return {
    kit: {
      oneLiner: d.oneLiner.slice(0, 160),
      audience: d.audience,
      desires: d.desires,
      pains: d.pains,
      outcomes: d.outcomes,
      // Screen indexes become media ids once the screenshots are copied in.
      magicMoment: { description: d.magicMoment.description, mediaIds: [] },
      beforeAfter: d.beforeAfter,
      claims: { allowed: d.claimsAllowed, banned: d.claimsBanned },
      cta: d.cta,
      tone: d.tone,
      personas: d.personas,
      hashtags: d.hashtags.map((h) => h.replace(/^#/, "")),
      brand: {
        ...(isHex(d.brandPrimary) ? { primary: d.brandPrimary } : {}),
        ...(isHex(d.brandAccent) ? { accent: d.brandAccent } : {}),
      },
    },
    screens: screens.map((s, i) => ({
      ...s,
      tags: d.magicMoment.screenIndexes.filter(validIndex).includes(i) && !s.tags.includes("magic") ? [...s.tags, "magic"] : s.tags,
    })),
  };
}
