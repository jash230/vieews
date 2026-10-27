import { NonRetriableError } from "inngest";
import { getValidAccessToken, markNeedsReauth } from "@/lib/accounts/service";
import { signedReadUrl } from "@/lib/media/service";
import { adapters } from "@/lib/platforms";
import { PlatformError, type PublishContext } from "@/lib/platforms/types";
import { refreshPostStatus } from "@/lib/posts/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MediaAssetRow, PostRow, PostTargetRow, SocialAccountRow } from "@/lib/types";
import { EVENTS, inngest } from "./client";

export const publishPost = inngest.createFunction(
  {
    id: "publish-post",
    triggers: [{ event: EVENTS.postRequested }],
    cancelOn: [{ event: EVENTS.postCanceled, match: "data.postId" }],
  },
  async ({ event, step }) => {
    const postId = event.data.postId as string;
    const post = await step.run("load-post", async () => {
      const { data } = await supabaseAdmin().from("posts").select("id, status, scheduled_for").eq("id", postId).single();
      return data as Pick<PostRow, "id" | "status" | "scheduled_for"> | null;
    });
    if (!post || post.status === "canceled") return { skipped: true };

    if (post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now()) {
      await step.sleepUntil("wait-for-schedule", post.scheduled_for);
    }

    const targets = await step.run("start-publishing", async () => {
      const db = supabaseAdmin();
      // Re-check: the post may have been canceled while we slept.
      const { data: fresh } = await db.from("posts").select("status").eq("id", postId).single();
      if (!fresh || fresh.status === "canceled") return [];
      await db.from("posts").update({ status: "publishing" }).eq("id", postId);
      const { data } = await db.from("post_targets").select("id, social_account_id").eq("post_id", postId).eq("status", "pending");
      return data ?? [];
    });

    if (targets.length) {
      await step.sendEvent(
        "fan-out",
        targets.map((t) => ({ name: EVENTS.targetPublish, data: { targetId: t.id, accountId: t.social_account_id } })),
      );
    }
    return { targets: targets.length };
  },
);

async function failTarget(targetId: string, message: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("post_targets")
    .update({ status: "failed", error: message.slice(0, 2000), finished_at: new Date().toISOString() })
    .eq("id", targetId)
    .select("post_id")
    .single();
  if (data) await refreshPostStatus(data.post_id);
}

export const publishTarget = inngest.createFunction(
  {
    id: "publish-target",
    triggers: [{ event: EVENTS.targetPublish }],
    retries: 3,
    // One upload at a time per connected account keeps us inside platform rate limits.
    concurrency: { key: "event.data.accountId", limit: 1 },
    onFailure: async ({ event, error }) => {
      const targetId = (event.data.event.data as { targetId: string }).targetId;
      await failTarget(targetId, error.message);
    },
  },
  async ({ event, step }) => {
    const targetId = event.data.targetId as string;
    const db = supabaseAdmin();

    const load = async () => {
      const { data: target } = await db.from("post_targets").select("*").eq("id", targetId).single();
      if (!target) throw new NonRetriableError("Target no longer exists");
      const [{ data: post }, { data: account }] = await Promise.all([
        db.from("posts").select("*").eq("id", target.post_id).single(),
        db.from("social_accounts").select("*").eq("id", target.social_account_id).single(),
      ]);
      if (!post) throw new NonRetriableError("Post no longer exists");
      if (!account) throw new NonRetriableError("This account was disconnected");
      const { data: media } = await db.from("media_assets").select("*").eq("id", post.media_asset_id).single();
      if (!media) throw new NonRetriableError("Media was deleted");
      return { target: target as PostTargetRow, post: post as PostRow, account: account as SocialAccountRow, media: media as MediaAssetRow };
    };

    const initial = await step.run("mark-started", async () => {
      const { target } = await load();
      if (target.status === "published" || target.status === "canceled") return { skip: true };
      await db
        .from("post_targets")
        .update({ status: "uploading", attempts: target.attempts + 1, started_at: new Date().toISOString(), error: null })
        .eq("id", targetId);
      return { skip: false };
    });
    if (initial.skip) return { skipped: true };

    // Rows are re-read on every invocation (they're cheap) so tokens never land in step state.
    const { target, post, account, media } = await load();
    const adapter = adapters[target.platform];

    const ctx: PublishContext = {
      account,
      media,
      caption: target.caption_override ?? post.caption,
      options: target.options,
      run: (id, fn) =>
        step.run(id, async () => {
          try {
            return await fn();
          } catch (err) {
            if (err instanceof PlatformError) {
              if (err.opts.reauth) await markNeedsReauth(account.id, err.message);
              if (!err.opts.retryable) throw new NonRetriableError(err.message, { cause: err });
            }
            throw err;
          }
        }) as never,
      sleep: (id, duration) => step.sleep(id, duration),
      accessToken: () => getValidAccessToken(account),
      mediaUrl: () => signedReadUrl(media.storage_path, 60 * 60),
      setStatus: async (status) => {
        await step.run(`status-${status}`, async () => {
          await db.from("post_targets").update({ status }).eq("id", targetId);
        });
      },
    };

    const result = await adapter.publish(ctx);

    await step.run("mark-published", async () => {
      await db
        .from("post_targets")
        .update({ status: "published", remote_id: result.remoteId, remote_url: result.remoteUrl, finished_at: new Date().toISOString(), error: null })
        .eq("id", targetId);
      await refreshPostStatus(post.id);
    });
    return result;
  },
);

export const functions = [publishPost, publishTarget];
