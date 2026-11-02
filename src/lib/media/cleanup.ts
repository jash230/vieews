import type { MediaAssetRow, PostRow } from "@/lib/types";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const CLEANUP_RULES = {
  /** Keep files of fully published posts this long (time to notice a problem). */
  publishedAfterDays: 3,
  /** Failed, partly published or canceled posts keep their files longer so you can retry. */
  settledAfterDays: 14,
  /** Uploads that no post uses. */
  orphanAfterDays: 2,
};

export type PostUsage = Pick<PostRow, "status" | "published_at" | "updated_at">;
export type MediaUsageAsset = Pick<MediaAssetRow, "id" | "status" | "created_at">;

const daysSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / DAY_MS;

/** Whether an asset's stored file can be deleted, given every post that uses it. */
export function isPurgeable(asset: MediaUsageAsset, posts: PostUsage[], now: Date): boolean {
  if (!posts.length) return daysSince(asset.created_at, now) >= CLEANUP_RULES.orphanAfterDays;
  return posts.every((p) => {
    if (p.status === "published") return daysSince(p.published_at ?? p.updated_at, now) >= CLEANUP_RULES.publishedAfterDays;
    if (p.status === "failed" || p.status === "partial" || p.status === "canceled") {
      return daysSince(p.updated_at, now) >= CLEANUP_RULES.settledAfterDays;
    }
    return false; // scheduled or still publishing
  });
}
