import { NonRetriableError } from "inngest";
import { getValidAccessToken, markNeedsReauth } from "@/lib/accounts/service";
import { CLEANUP_RULES, DAY_MS, isPurgeable, type MediaUsageAsset, type PostUsage } from "@/lib/media/cleanup";
import { appMediaUrl, purgeMediaFile, signedReadUrl } from "@/lib/media/service";
import { adapters } from "@/lib/platforms";
import { PlatformError, type PublishContext } from "@/lib/platforms/types";
import { mediaIdsOf } from "@/lib/posts/schema";
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
      // Conditional, so a cancel landing between the check and the update still wins.
      const { data: claimed } = await db
        .from("posts")
        .update({ status: "publishing" })
        .eq("id", postId)
        .in("status", ["scheduled", "publishing"])
        .select("id");
      if (!claimed?.length) return [];
      const { data } = await db.from("post_targets").select("id, social_account_id").eq("post_id", postId).eq("status", "pending");
      // Every account was disconnected (targets cascade away): settle the post instead of leaving it publishing.
      if (!data?.length) await refreshPostStatus(postId);
      return data ?? [];
    });

    if (targets.length) {
      await step.sendEvent(
        "fan-out",
        targets.map((t) => ({ name: EVENTS.targetPublish, data: { targetId: t.id, accountId: t.social_account_id, postId } })),
      );
    }
    return { targets: targets.length };
  },
);

async function failTarget(targetId: string, message: string, postId?: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("post_targets")
    .update({ status: "failed", error: message.slice(0, 2000), finished_at: new Date().toISOString() })
    .eq("id", targetId)
    .select("post_id")
    .maybeSingle();
  // The target is gone when its account was disconnected mid-publish; still settle the post.
  const owner = data?.post_id ?? postId;
  if (owner) await refreshPostStatus(owner);
}

export const publishTarget = inngest.createFunction(
  {
    id: "publish-target",
    triggers: [{ event: EVENTS.targetPublish }],
    retries: 3,
    // One upload at a time per connected account keeps us inside platform rate limits.
    concurrency: { key: "event.data.accountId", limit: 1 },
    onFailure: async ({ event, error }) => {
      const { targetId, postId } = event.data.event.data as { targetId: string; postId?: string };
      await failTarget(targetId, error.message, postId);
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
      const items = await loadItems(post as PostRow);
      return { target: target as PostTargetRow, post: post as PostRow, account: account as SocialAccountRow, media: items[0], items };
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
    const { target, post, account, media, items } = await load();
    const adapter = adapters[target.platform];

    const ctx: PublishContext = {
      account,
      media,
      items,
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
      itemUrls: () => Promise.all(items.map((m) => signedReadUrl(m.storage_path, 60 * 60))),
      appItemUrls: () => items.map((m) => appMediaUrl(m)),
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

/** Media in post order. Posts from before carousels only have media_asset_id. */
async function loadItems(post: PostRow): Promise<MediaAssetRow[]> {
  const db = supabaseAdmin();
  const { data: links } = await db.from("post_media").select("media_asset_id, position").eq("post_id", post.id).order("position");
  const ids = links?.length ? links.map((l) => l.media_asset_id as string) : [post.media_asset_id];
  const { data: rows } = await db.from("media_assets").select("*").in("id", ids);
  const byId = new Map(((rows ?? []) as MediaAssetRow[]).map((m) => [m.id, m]));
  const items = ids.map((id) => byId.get(id));
  if (items.some((m) => !m || m.purged_at)) throw new NonRetriableError("Media was deleted");
  return items as MediaAssetRow[];
}

/**
 * Frees storage (Supabase's free plan has 1 GB): deletes the stored file once every post using it is
 * done. The media row and its thumbnail stay so the post history still renders.
 */
export const cleanupMedia = inngest.createFunction(
  { id: "cleanup-media", triggers: [{ cron: "TZ=UTC 30 4 * * *" }] },
  async ({ step }) => {
    const candidates = await step.run("find-candidates", async () => {
      const db = supabaseAdmin();
      const { data: assets } = await db
        .from("media_assets")
        .select("id, storage_path, status, created_at")
        .is("purged_at", null)
        .lt("created_at", new Date(Date.now() - CLEANUP_RULES.orphanAfterDays * DAY_MS).toISOString())
        .order("created_at")
        .limit(500);
      if (!assets?.length) return [];
      const { data: links } = await db
        .from("post_media")
        .select("media_asset_id, post:posts(status, published_at, updated_at, media_asset_id)")
        .in("media_asset_id", assets.map((a) => a.id));
      // Covers of posts made before post_media existed.
      const { data: covers } = await db
        .from("posts")
        .select("status, published_at, updated_at, media_asset_id")
        .in("media_asset_id", assets.map((a) => a.id));
      // Files a project keeps (icon, screens, magic-moment clips) or a pending copilot proposal uses are never cleaned up.
      const ids = assets.map((a) => a.id as string);
      const [{ data: projectMedia }, { data: projects }, { data: proposals }] = await Promise.all([
        db.from("project_media").select("media_asset_id").in("media_asset_id", ids),
        db.from("projects").select("icon_asset_id, magic:kit->magicMoment->mediaIds"),
        db.from("copilot_proposals").select("input").eq("status", "pending"),
      ]);
      const pinned = new Set<string>([
        ...(projectMedia ?? []).map((r) => r.media_asset_id as string),
        ...(projects ?? []).flatMap((p) => [p.icon_asset_id as string | null, ...((p.magic as string[] | null) ?? [])]).filter((x): x is string => !!x),
        ...(proposals ?? []).flatMap((p) => mediaIdsOf((p.input ?? {}) as { mediaAssetId?: string; mediaAssetIds?: string[] })),
      ]);
      const usage = new Map<string, PostUsage[]>();
      const add = (id: string, p: PostUsage | null) => p && usage.set(id, [...(usage.get(id) ?? []), p]);
      for (const l of links ?? []) add(l.media_asset_id as string, l.post as unknown as PostUsage);
      for (const c of covers ?? []) add(c.media_asset_id as string, c as PostUsage);
      return assets
        .filter((a) => !pinned.has(a.id as string))
        .filter((a) => isPurgeable(a as MediaUsageAsset, usage.get(a.id) ?? [], new Date()))
        .map((a) => ({ id: a.id as string, storage_path: a.storage_path as string }));
    });

    for (const asset of candidates) {
      await step.run(`purge-${asset.id}`, () => purgeMediaFile(asset));
    }
    return { purged: candidates.length };
  },
);

export const functions = [publishPost, publishTarget, cleanupMedia];
