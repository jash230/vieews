import "server-only";
import { EVENTS, inngest } from "@/lib/inngest/client";
import { validateTarget, type ValidationIssue } from "@/lib/platforms/limits";
import { getMediaAsset } from "@/lib/media/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MediaAssetRow, PostRow, PostStatus, PostTargetRow, SocialAccountRow } from "@/lib/types";
import { createPostSchema, type CreatePostInput } from "./schema";

export class PostValidationError extends Error {
  constructor(readonly issues: ValidationIssue[] | string[]) {
    super(issues.map((i) => (typeof i === "string" ? i : `${i.platform}: ${i.message}`)).join("\n"));
    this.name = "PostValidationError";
  }
}

export interface PostWithTargets extends PostRow {
  targets: (PostTargetRow & { account: Pick<SocialAccountRow, "username" | "display_name" | "avatar_url"> | null })[];
  media: MediaAssetRow | null;
}

const POST_SELECT = "*, media:media_assets(*), targets:post_targets(*, account:social_accounts(username, display_name, avatar_url))";

export async function createPost(userId: string, raw: CreatePostInput, source: "web" | "mcp", extra: { tiktokMaxDurationS?: number } = {}) {
  const parsed = createPostSchema.safeParse(raw);
  if (!parsed.success) throw new PostValidationError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const input = parsed.data;
  const db = supabaseAdmin();

  const media = await getMediaAsset(userId, input.mediaAssetId);
  if (media.status !== "ready") throw new PostValidationError(["Media upload hasn't finished yet"]);

  const accountIds = [...new Set(input.targets.map((t) => t.accountId))];
  const { data: accounts, error: accErr } = await db.from("social_accounts").select("id, platform, status").eq("user_id", userId).in("id", accountIds);
  if (accErr) throw accErr;
  const byId = new Map((accounts ?? []).map((a) => [a.id, a]));

  const issues: ValidationIssue[] = [];
  const problems: string[] = [];
  for (const t of input.targets) {
    const account = byId.get(t.accountId);
    if (!account) problems.push(`Account ${t.accountId} isn't connected`);
    else if (account.platform !== t.options.platform) problems.push(`Account ${t.accountId} is ${account.platform}, not ${t.options.platform}`);
    else if (account.status !== "active") problems.push(`Reconnect your ${account.platform} account before posting`);
    issues.push(
      ...validateTarget(
        { kind: media.kind, mime: media.mime, sizeBytes: media.size_bytes, width: media.width, height: media.height, durationS: media.duration_s },
        t.captionOverride ?? input.caption,
        t.options,
        extra,
      ),
    );
  }
  if (problems.length) throw new PostValidationError(problems);
  if (issues.length) throw new PostValidationError(issues);

  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
  if (scheduledFor && scheduledFor.getTime() < Date.now() - 60_000) throw new PostValidationError(["Scheduled time is in the past"]);
  const isScheduled = !!scheduledFor && scheduledFor.getTime() > Date.now() + 30_000;

  const { data: post, error: postErr } = await db
    .from("posts")
    .insert({
      user_id: userId,
      caption: input.caption,
      media_asset_id: media.id,
      scheduled_for: isScheduled ? scheduledFor!.toISOString() : null,
      status: isScheduled ? "scheduled" : "publishing",
      source,
    })
    .select("*")
    .single();
  if (postErr) throw postErr;

  const { error: tErr } = await db.from("post_targets").insert(
    input.targets.map((t) => ({
      post_id: post.id,
      user_id: userId,
      social_account_id: t.accountId,
      platform: t.options.platform,
      options: t.options,
      caption_override: t.captionOverride ?? null,
      status: "pending",
    })),
  );
  if (tErr) {
    await db.from("posts").delete().eq("id", post.id);
    throw tErr;
  }

  await inngest.send({ name: EVENTS.postRequested, data: { postId: post.id } });
  return getPost(userId, post.id);
}

export async function getPost(userId: string, postId: string): Promise<PostWithTargets> {
  const { data, error } = await supabaseAdmin().from("posts").select(POST_SELECT).eq("user_id", userId).eq("id", postId).single();
  if (error || !data) throw new Error("Post not found");
  return data as unknown as PostWithTargets;
}

export async function listPosts(userId: string, opts: { limit?: number; status?: PostStatus[]; upcoming?: boolean } = {}): Promise<PostWithTargets[]> {
  let q = supabaseAdmin().from("posts").select(POST_SELECT).eq("user_id", userId);
  if (opts.status?.length) q = q.in("status", opts.status);
  q = opts.upcoming ? q.order("scheduled_for", { ascending: true }) : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(opts.limit ?? 50);
  if (error) throw error;
  return (data ?? []) as unknown as PostWithTargets[];
}

export async function cancelPost(userId: string, postId: string) {
  const post = await getPost(userId, postId);
  if (post.status !== "scheduled") throw new Error("Only scheduled posts can be canceled");
  const db = supabaseAdmin();
  await db.from("posts").update({ status: "canceled" }).eq("id", postId).eq("status", "scheduled");
  await db.from("post_targets").update({ status: "canceled" }).eq("post_id", postId).eq("status", "pending");
  await inngest.send({ name: EVENTS.postCanceled, data: { postId } });
}

/**
 * Removes the post from Vieews (its targets cascade; the media stays in the library).
 * Doesn't take anything down from the platforms it already went out to.
 */
export async function deletePost(userId: string, postId: string) {
  const post = await getPost(userId, postId);
  if (post.status === "publishing") throw new Error("This post is still publishing. Wait for it to finish, then delete it.");
  if (post.status === "scheduled") await inngest.send({ name: EVENTS.postCanceled, data: { postId } });
  const { error } = await supabaseAdmin().from("posts").delete().eq("user_id", userId).eq("id", postId);
  if (error) throw error;
}

export async function retryTarget(userId: string, targetId: string) {
  const db = supabaseAdmin();
  const { data: target, error } = await db.from("post_targets").select("*").eq("user_id", userId).eq("id", targetId).single();
  if (error || !target) throw new Error("Target not found");
  if (target.status !== "failed") throw new Error("Only failed targets can be retried");
  await db.from("post_targets").update({ status: "pending", error: null, finished_at: null }).eq("id", targetId);
  await db.from("posts").update({ status: "publishing" }).eq("id", target.post_id);
  await inngest.send({ name: EVENTS.targetPublish, data: { targetId, accountId: target.social_account_id } });
}

/** Derives the post status from its targets. */
export function rollupStatus(statuses: PostTargetRow["status"][]): PostStatus {
  if (statuses.some((s) => s === "pending" || s === "uploading" || s === "processing")) return "publishing";
  const live = statuses.filter((s) => s !== "canceled");
  if (!live.length) return "canceled";
  if (live.every((s) => s === "published")) return "published";
  if (live.every((s) => s === "failed")) return "failed";
  return "partial";
}

export async function refreshPostStatus(postId: string): Promise<PostStatus> {
  const db = supabaseAdmin();
  const { data } = await db.from("post_targets").select("status").eq("post_id", postId);
  const status = rollupStatus((data ?? []).map((t) => t.status));
  await db
    .from("posts")
    .update({ status, published_at: status === "published" || status === "partial" ? new Date().toISOString() : null })
    .eq("id", postId)
    .neq("status", "canceled");
  return status;
}
