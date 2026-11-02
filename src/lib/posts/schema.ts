import { z } from "zod";

export const youtubeOptionsSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(30).optional(),
  privacy: z.enum(["public", "unlisted", "private"]).default("private"),
  madeForKids: z.boolean().optional(),
  containsSyntheticMedia: z.boolean().optional(),
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
  autoAddMusic: z.boolean().optional(),
});

export const targetOptionsSchema = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("youtube"), youtube: youtubeOptionsSchema }),
  z.object({ platform: z.literal("instagram"), instagram: instagramOptionsSchema }),
  z.object({ platform: z.literal("tiktok"), tiktok: tiktokOptionsSchema }),
]);

export const MAX_CAROUSEL_ITEMS = 35;
const MAX_META_BYTES = 16 * 1024;

export const createPostSchema = z
  .object({
    mediaAssetId: z.string().uuid().optional().describe("A single video or photo. Use mediaAssetIds for a photo carousel."),
    mediaAssetIds: z
      .array(z.string().uuid())
      .min(1)
      .max(MAX_CAROUSEL_ITEMS)
      .optional()
      .describe("Photos in order for a carousel (TikTok photo post or Instagram carousel). The first is the cover."),
    projectId: z.string().uuid().nullish().describe("The project (app) this post promotes. Defaults to the first project."),
    caption: z.string().max(5000).default(""),
    scheduledFor: z.string().datetime({ offset: true }).nullish(),
    campaign: z.string().trim().min(1).max(100).nullish().describe('Optional grouping, e.g. "ad-studio:myapp". Filter list_posts by it.'),
    meta: z
      .record(z.string(), z.unknown())
      .nullish()
      .refine((m) => !m || JSON.stringify(m).length <= MAX_META_BYTES, "meta must be under 16 KB")
      .describe("Optional JSON stored with the post and returned by get_post/list_posts."),
    targets: z
      .array(
        z.object({
          accountId: z.string().uuid(),
          captionOverride: z.string().max(5000).nullish(),
          options: targetOptionsSchema,
        }),
      )
      .min(1, "Pick at least one account"),
  })
  .refine((v) => !!v.mediaAssetId !== !!v.mediaAssetIds?.length, {
    message: "Give either mediaAssetId or mediaAssetIds",
    path: ["mediaAssetIds"],
  });

export type CreatePostInput = z.input<typeof createPostSchema>;

/** The post's media ids in order, whichever field the caller used. */
export function mediaIdsOf(input: { mediaAssetId?: string; mediaAssetIds?: string[] }): string[] {
  return input.mediaAssetIds?.length ? input.mediaAssetIds : input.mediaAssetId ? [input.mediaAssetId] : [];
}
