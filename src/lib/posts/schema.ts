import { z } from "zod";

export const youtubeOptionsSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(30).optional(),
  privacy: z.enum(["public", "unlisted", "private"]).default("private"),
  madeForKids: z.boolean().optional(),
});

export const instagramOptionsSchema = z.object({
  format: z.enum(["reel", "post", "story"]),
  shareToFeed: z.boolean().optional(),
});

export const tiktokOptionsSchema = z.object({
  privacyLevel: z.string().min(1),
  disableComment: z.boolean().default(false),
  disableDuet: z.boolean().default(false),
  disableStitch: z.boolean().default(false),
  brandOrganic: z.boolean().default(false),
  brandedContent: z.boolean().default(false),
  isAigc: z.boolean().optional(),
});

export const targetOptionsSchema = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("youtube"), youtube: youtubeOptionsSchema }),
  z.object({ platform: z.literal("instagram"), instagram: instagramOptionsSchema }),
  z.object({ platform: z.literal("tiktok"), tiktok: tiktokOptionsSchema }),
]);

export const createPostSchema = z.object({
  mediaAssetId: z.string().uuid(),
  caption: z.string().max(5000).default(""),
  scheduledFor: z.string().datetime({ offset: true }).nullish(),
  targets: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        captionOverride: z.string().max(5000).nullish(),
        options: targetOptionsSchema,
      }),
    )
    .min(1, "Pick at least one account"),
});

export type CreatePostInput = z.input<typeof createPostSchema>;
