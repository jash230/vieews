import { env } from "@/lib/env";
import { purgeFinishedMedia } from "@/lib/media/service";
import { failStaleTargets, findStalledPosts } from "@/lib/posts/publish";
import { startPublishPost } from "@/lib/posts/start";

export const maxDuration = 300;

/**
 * Once a day (vercel.json): frees storage of finished posts, fails uploads killed mid-publish, and
 * restarts any post whose workflow was lost (claims keep anything from posting twice).
 */
export async function GET(request: Request) {
  const secret = env.cronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Each job runs on its own: a storage hiccup in cleanup must not keep stuck posts from recovering.
  const attempt = async <T,>(job: string, fn: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await fn();
    } catch (err) {
      console.error(`cron ${job} failed`, err);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  };
  const purged = await attempt("purge", purgeFinishedMedia);
  const failed = await attempt("fail-stale", () => failStaleTargets());
  const stalled = await attempt("find-stalled", findStalledPosts);
  const restart = Array.isArray(stalled) ? stalled : [];
  for (const postId of restart) await startPublishPost(postId).catch((err) => console.error(err));
  const ok = [purged, failed, stalled].every((r) => !(r && typeof r === "object" && "error" in r));
  return Response.json({ purged, failed, restarted: restart.length }, { status: ok ? 200 : 500 });
}
