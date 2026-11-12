import type { PostRow, PostTargetRow } from "@/lib/types";

/** A post still "publishing" this long after its last update has stalled, so it may be deleted. */
export const STUCK_AFTER_MS = 15 * 60_000;
/** Mirrors STALE_AFTER_MS in publish.ts: an upload claimed this long ago was killed and won't finish. */
const UPLOAD_GIVES_UP_AFTER_MS = 60 * 60_000;

type DeletablePost = Pick<PostRow, "status" | "updated_at"> & { targets?: Pick<PostTargetRow, "status" | "started_at">[] };

/** Posts can be deleted unless an upload may still be running. */
export function canDeletePost(post: DeletablePost, now = Date.now()) {
  if (post.status !== "publishing") return true;
  if (now - new Date(post.updated_at).getTime() <= STUCK_AFTER_MS) return false;
  // A slow upload (e.g. Instagram processing) can run long after the post last changed: wait for it.
  return !(post.targets ?? []).some(
    (t) =>
      (t.status === "uploading" || t.status === "processing") &&
      (!t.started_at || now - new Date(t.started_at).getTime() <= UPLOAD_GIVES_UP_AFTER_MS),
  );
}
