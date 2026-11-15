// A clip request waiting for the user to sign in or pick a plan. Kept in this browser only,
// so a link from another site can't start a job. /clips picks it up and starts it.

const KEY = "vieews:pending-clip";
const TTL_MS = 60 * 60_000;

export interface PendingClip {
  sourceUrl?: string;
  sourceAssetId?: string;
  /** The plans page was already shown for it: don't send them back there in a loop. */
  paywalled?: boolean;
}

export function stashPendingClip(p: PendingClip) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {}
}

export function takePendingClip(): PendingClip | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    localStorage.removeItem(KEY);
    if (!v || Date.now() - v.at > TTL_MS) return null;
    return typeof v.sourceUrl === "string" || typeof v.sourceAssetId === "string"
      ? { sourceUrl: v.sourceUrl, sourceAssetId: v.sourceAssetId, paywalled: v.paywalled === true }
      : null;
  } catch {
    return null;
  }
}
