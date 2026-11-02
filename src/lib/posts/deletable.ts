import type { PostRow } from "@/lib/types";

/** A post still "publishing" this long after its last update has stalled, so it may be deleted. */
export const STUCK_AFTER_MS = 15 * 60_000;

/** Posts can be deleted unless an upload may still be running. */
export function canDeletePost(post: Pick<PostRow, "status" | "updated_at">, now = Date.now()) {
  return post.status !== "publishing" || now - new Date(post.updated_at).getTime() > STUCK_AFTER_MS;
}
