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
  const purged = await purgeFinishedMedia();
  const failed = await failStaleTargets();
  const stalled = await findStalledPosts();
  for (const postId of stalled) await startPublishPost(postId).catch((err) => console.error(err));
  return Response.json({ purged, failed, restarted: stalled.length });
}
