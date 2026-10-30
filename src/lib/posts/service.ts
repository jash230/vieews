import "server-only";
import { EVENTS, inngest } from "@/lib/inngest/client";
import { validateMedia, type MediaInfo, type ValidationIssue } from "@/lib/platforms/limits";
import { assertProjectOwner, defaultProject, projectAccountIds } from "@/lib/projects/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MediaAssetRow, PostRow, PostStatus, PostTargetRow, SocialAccountRow } from "@/lib/types";
import { createPostSchema, mediaIdsOf, type CreatePostInput } from "./schema";

export class PostValidationError extends Error {
  constructor(readonly issues: ValidationIssue[] | string[]) {
    super(issues.map((i) => (typeof i === "string" ? i : `${i.platform}: ${i.message}`)).join("\n"));
    this.name = "PostValidationError";
  }
}

export interface PostWithTargets extends PostRow {
  targets: (PostTargetRow & { account: Pick<SocialAccountRow, "username" | "display_name" | "avatar_url"> | null })[];
  /** The cover (first item). */
  media: MediaAssetRow | null;
  /** All media in order; one item unless the post is a carousel. */
  items: MediaAssetRow[];
}

// The cover embed names its foreign key because post_media is a second path to media_assets.
const POST_SELECT =
  "*, media:media_assets!posts_media_asset_id_fkey(*), items:post_media(position, media:media_assets(*)), targets:post_targets(*, account:social_accounts(username, display_name, avatar_url))";

type PostSelectRow = Omit<PostWithTargets, "items"> & { items: { position: number; media: MediaAssetRow | null }[] | null };

function withItems(row: PostSelectRow): PostWithTargets {
  const items = [...(row.items ?? [])]
    .sort((a, b) => a.position - b.position)
    .flatMap((i) => (i.media ? [i.media] : []));
  // Posts created before post_media existed have only media_asset_id.
  return { ...row, items: items.length ? items : row.media ? [row.media] : [] };
}

export const mediaInfoOf = (m: MediaAssetRow): MediaInfo => ({
  kind: m.kind,
  mime: m.mime,
  sizeBytes: m.size_bytes,
  width: m.width,
  height: m.height,
  durationS: m.duration_s,
});

async function loadReadyMedia(userId: string, ids: string[]): Promise<MediaAssetRow[]> {
  const { data, error } = await supabaseAdmin().from("media_assets").select("*").eq("user_id", userId).in("id", ids);
  if (error) throw error;
  const byId = new Map((data as MediaAssetRow[]).map((m) => [m.id, m]));
  return ids.map((id, i) => {
    const media = byId.get(id);
    const label = ids.length > 1 ? `Item ${i + 1}` : "Media";
    if (!media) throw new PostValidationError([`${label} wasn't found`]);
    if (media.status !== "ready") throw new PostValidationError([`${label} hasn't finished uploading yet`]);
    if (media.purged_at) throw new PostValidationError([`${label} was already cleaned up after an earlier post. Upload it again.`]);
    return media;
  });
}

export async function createPost(userId: string, raw: CreatePostInput, source: "web" | "mcp", extra: { tiktokMaxDurationS?: number } = {}) {
  const parsed = createPostSchema.safeParse(raw);
  if (!parsed.success) throw new PostValidationError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const input = parsed.data;
  const db = supabaseAdmin();

  const project = input.projectId ? await assertProjectOwner(userId, input.projectId) : await defaultProject(userId);
  if (!project) throw new PostValidationError(["Create a project for your app before posting"]);

  const items = await loadReadyMedia(userId, mediaIdsOf(input));
  const media = items[0];

  const accountIds = [...new Set(input.targets.map((t) => t.accountId))];
  const linked = new Set(await projectAccountIds(userId, project.id));
  const { data: accounts, error: accErr } = await db.from("social_accounts").select("id, platform, status").eq("user_id", userId).in("id", accountIds);
  if (accErr) throw accErr;
  const byId = new Map((accounts ?? []).map((a) => [a.id, a]));

  const issues: ValidationIssue[] = [];
  const problems: string[] = [];
  for (const t of input.targets) {
    const account = byId.get(t.accountId);
    if (!account) problems.push(`Account ${t.accountId} isn't connected`);
    else if (account.platform !== t.options.platform) problems.push(`Account ${t.accountId} is ${account.platform}, not ${t.options.platform}`);
    else if (!linked.has(account.id)) problems.push(`Your ${account.platform} account isn't added to ${project.name}. Add it in the project's settings.`);
    else if (account.status !== "active") problems.push(`Reconnect your ${account.platform} account before posting`);
    issues.push(...validateMedia(items.map(mediaInfoOf), t.captionOverride ?? input.caption, t.options, extra));
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
      project_id: project.id,
      caption: input.caption,
      media_asset_id: media.id,
      scheduled_for: isScheduled ? scheduledFor!.toISOString() : null,
      status: isScheduled ? "scheduled" : "publishing",
      source,
      campaign: input.campaign ?? null,
      meta: input.meta ?? {},
    })
    .select("*")
    .single();
  if (postErr) throw postErr;

  const { error: mErr } = await db
    .from("post_media")
    .insert(items.map((m, position) => ({ post_id: post.id, media_asset_id: m.id, position })));
  if (mErr) {
    await db.from("posts").delete().eq("id", post.id);
    throw mErr;
  }

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
  return withItems(data as unknown as PostSelectRow);
}

export async function listPosts(
  userId: string,
  opts: { limit?: number; status?: PostStatus[]; upcoming?: boolean; campaign?: string; since?: string; before?: string; projectId?: string } = {},
): Promise<PostWithTargets[]> {
  let q = supabaseAdmin().from("posts").select(POST_SELECT).eq("user_id", userId);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.status?.length) q = q.in("status", opts.status);
  if (opts.campaign) q = q.eq("campaign", opts.campaign);
  if (opts.since) q = q.gte("created_at", opts.since);
  if (opts.before) q = q.lt("created_at", opts.before);
  q = opts.upcoming ? q.order("scheduled_for", { ascending: true }) : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(opts.limit ?? 50);
  if (error) throw error;
  return ((data ?? []) as unknown as PostSelectRow[]).map(withItems);
}

export async function cancelPost(userId: string, postId: string) {
  const post = await getPost(userId, postId);
  if (post.status !== "scheduled") throw new Error("Only scheduled posts can be canceled");
  const db = supabaseAdmin();
  const { data: canceled } = await db.from("posts").update({ status: "canceled" }).eq("id", postId).eq("status", "scheduled").select("id");
  // Publishing started between the check and the update; leave its targets alone.
  if (!canceled?.length) throw new Error("This post has started publishing and can't be canceled");
  await db.from("post_targets").update({ status: "canceled" }).eq("post_id", postId).eq("status", "pending");
  await inngest.send({ name: EVENTS.postCanceled, data: { postId } });
}

export async function retryTarget(userId: string, targetId: string) {
  const db = supabaseAdmin();
  const { data: target, error } = await db.from("post_targets").select("*").eq("user_id", userId).eq("id", targetId).single();
  if (error || !target) throw new Error("Target not found");
  if (target.status !== "failed") throw new Error("Only failed targets can be retried");
  const post = await getPost(userId, target.post_id);
  if (post.items.some((m) => m.purged_at)) throw new Error("This post's media was cleaned up to free storage. Create a new post instead.");
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
