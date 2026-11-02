import "server-only";
import { after } from "next/server";
import { getValidAccessToken, markNeedsReauth } from "@/lib/accounts/service";
import { appMediaUrl, signedReadUrl } from "@/lib/media/service";
import { adapters } from "@/lib/platforms";
import { PlatformError, type PublishContext, type PublishResult } from "@/lib/platforms/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MediaAssetRow, PostRow, PostTargetRow, SocialAccountRow } from "@/lib/types";
import { refreshPostStatus } from "./service";

/**
 * Publishing one target, run by the publish workflows (src/workflows/publish). A target is claimed
 * (pending → uploading) exactly once, so a restarted workflow can't post it twice.
 */

/** How long a due post may sit with nothing started before the post page restarts it. */
export const HEAL_AFTER_MS = 10 * 60_000;
/**
 * A claimed target still unfinished after this long was killed mid-publish and will never finish.
 * The slowest real run (an upload, then 15 min of Instagram polling, plus retries) stays well under it.
 */
export const STALE_AFTER_MS = 60 * 60_000;

const STALE_MESSAGE =
  "Publishing stopped before it finished (the server timed out or restarted). Check the platform in case it went out, then retry.";

const IN_FLIGHT = ["uploading", "processing"] as const;

/** A failure retrying can't fix (bad media, rejected by the platform, deleted rows). */
export class NonRetriableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NonRetriableError";
  }
}

export function isStaleTarget(t: Pick<PostTargetRow, "status" | "started_at">, now = new Date()): boolean {
  return (IN_FLIGHT as readonly string[]).includes(t.status) && !!t.started_at && now.getTime() - new Date(t.started_at).getTime() > STALE_AFTER_MS;
}

/** A post whose pending targets nobody has started long after they were due: its workflow was lost. */
export function needsRestart(
  post: Pick<PostRow, "status" | "scheduled_for" | "updated_at"> & { targets: Pick<PostTargetRow, "status">[] },
  now = new Date(),
): boolean {
  if (!post.targets.some((t) => t.status === "pending")) return false;
  // Another target of this account is mid-upload, and the rest wait their turn behind it.
  if (post.targets.some((t) => (IN_FLIGHT as readonly string[]).includes(t.status))) return false;
  const overdue = (iso: string) => now.getTime() - new Date(iso).getTime() > HEAL_AFTER_MS;
  if (post.status === "scheduled") return !!post.scheduled_for && overdue(post.scheduled_for);
  return post.status === "publishing" && overdue(post.updated_at);
}

/** Fails targets that were killed mid-publish, for one post or (from the daily cron) all of them. Returns how many. */
export async function failStaleTargets(postId?: string): Promise<number> {
  let q = supabaseAdmin()
    .from("post_targets")
    .update({ status: "failed", error: STALE_MESSAGE, finished_at: new Date().toISOString() })
    .in("status", [...IN_FLIGHT])
    .lt("started_at", new Date(Date.now() - STALE_AFTER_MS).toISOString());
  if (postId) q = q.eq("post_id", postId);
  const { data } = await q.select("post_id");
  for (const id of new Set((data ?? []).map((t) => t.post_id as string))) await refreshPostStatus(id);
  return data?.length ?? 0;
}

/** Fails every target of the post that never started, e.g. when its workflow gave up. */
export async function failPendingTargets(postId: string, message: string) {
  await supabaseAdmin()
    .from("post_targets")
    .update({ status: "failed", error: message.slice(0, 2000), finished_at: new Date().toISOString() })
    .eq("post_id", postId)
    .eq("status", "pending");
  await refreshPostStatus(postId);
}

/** Posts the daily cron should restart: overdue scheduled ones and stalled publishing ones. */
export async function findStalledPosts(): Promise<string[]> {
  const { data } = await supabaseAdmin()
    .from("posts")
    .select("id, status, scheduled_for, updated_at, targets:post_targets(status)")
    .in("status", ["scheduled", "publishing"])
    .lt("updated_at", new Date(Date.now() - HEAL_AFTER_MS).toISOString())
    .limit(100);
  const posts = (data ?? []) as unknown as (Parameters<typeof needsRestart>[0] & { id: string })[];
  return posts.filter((p) => needsRestart(p)).map((p) => p.id);
}

/** What a publish workflow should do next with a post. */
export type PublishPlan =
  | { kind: "skip" }
  | { kind: "wait"; until: string }
  /** Pending target ids, one list per account: accounts run in parallel, each list one at a time. */
  | { kind: "go"; byAccount: string[][] };

/** Decides whether a post is due, and if so marks it publishing and lists what's left to post. */
export async function planPublish(postId: string): Promise<PublishPlan> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("status, scheduled_for").eq("id", postId).maybeSingle();
  if (!post || post.status === "canceled") return { kind: "skip" };
  // Re-read on every wake-up, so a canceled, deleted or rescheduled post is never published early.
  if (post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now()) return { kind: "wait", until: post.scheduled_for };

  const { data: pending } = await db.from("post_targets").select("id, social_account_id").eq("post_id", postId).eq("status", "pending").order("created_at");
  // Nothing left (another run got there first): derive the status instead of leaving it "publishing".
  if (!pending?.length) {
    await refreshPostStatus(postId);
    return { kind: "skip" };
  }
  if (post.status !== "publishing") await db.from("posts").update({ status: "publishing" }).eq("id", postId);
  const byAccount = new Map<string, string[]>();
  for (const t of pending) byAccount.set(t.social_account_id as string, [...(byAccount.get(t.social_account_id as string) ?? []), t.id as string]);
  return { kind: "go", byAccount: [...byAccount.values()] };
}

/** Durable steps for an adapter: memoized runs and resumable sleeps. */
export interface StepRunner {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
  sleep(id: string, duration: string): Promise<void>;
}

export async function failTarget(targetId: string, message: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("post_targets")
    .update({ status: "failed", error: message.slice(0, 2000), finished_at: new Date().toISOString() })
    .eq("id", targetId)
    .select("post_id")
    .single();
  if (data) await refreshPostStatus(data.post_id);
}

/** Moves a pending target to uploading. False when it's gone or someone else already claimed it. */
export async function claimTarget(targetId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data: target } = await db.from("post_targets").select("status, attempts").eq("id", targetId).single();
  if (!target || target.status !== "pending") return false;
  const { data } = await db
    .from("post_targets")
    .update({ status: "uploading", attempts: target.attempts + 1, started_at: new Date().toISOString(), error: null })
    .eq("id", targetId)
    .eq("status", "pending")
    .eq("attempts", target.attempts)
    .select("id");
  return !!data?.length;
}

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

/** Uploads a claimed target to its platform and records the result. */
export async function publishClaimedTarget(targetId: string, steps: StepRunner): Promise<PublishResult> {
  const db = supabaseAdmin();
  // Rows are re-read on every invocation (they're cheap) so tokens never land in step state.
  const { data: targetRow } = await db.from("post_targets").select("*").eq("id", targetId).single();
  if (!targetRow) throw new NonRetriableError("Target no longer exists");
  const target = targetRow as PostTargetRow;
  const [{ data: postRow }, { data: accountRow }] = await Promise.all([
    db.from("posts").select("*").eq("id", target.post_id).single(),
    db.from("social_accounts").select("*").eq("id", target.social_account_id).single(),
  ]);
  if (!postRow) throw new NonRetriableError("Post no longer exists");
  if (!accountRow) throw new NonRetriableError("This account was disconnected");
  const post = postRow as PostRow;
  const account = accountRow as SocialAccountRow;
  const items = await loadItems(post);
  const media = items[0];

  const ctx: PublishContext = {
    account,
    media,
    items,
    caption: target.caption_override ?? post.caption,
    options: target.options,
    run: (id, fn) =>
      steps.run(id, async () => {
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
    sleep: (id, duration) => steps.sleep(id, duration),
    accessToken: () => getValidAccessToken(account),
    mediaUrl: () => signedReadUrl(media.storage_path, 60 * 60),
    itemUrls: () => Promise.all(items.map((m) => signedReadUrl(m.storage_path, 60 * 60))),
    appItemUrls: () => items.map((m) => appMediaUrl(m)),
    setStatus: async (status) => {
      await steps.run(`status-${status}`, async () => {
        await db.from("post_targets").update({ status }).eq("id", targetId);
      });
    },
  };

  const result = await adapters[target.platform].publish(ctx);

  await steps.run("mark-published", async () => {
    await db
      .from("post_targets")
      .update({ status: "published", remote_id: result.remoteId, remote_url: result.remoteUrl, finished_at: new Date().toISOString(), error: null })
      .eq("id", targetId);
    await refreshPostStatus(post.id);
  });
  return result;
}

/** Results of a target's finished adapter steps, by step id. A finished sleep is stored as true. */
export type StepMemo = Record<string, { v: unknown }>;

/** How far one call to advanceTarget got. Every kind carries the memo to resume from. */
export type Advance =
  | { kind: "done"; memo: StepMemo }
  | { kind: "sleep"; memo: StepMemo; id: string; duration: string }
  | { kind: "error"; memo: StepMemo; message: string; retryable: boolean };

/** Thrown by the replay runner to stop an adapter at its next unfinished sleep. */
class Suspend {
  constructor(
    readonly id: string,
    readonly duration: string,
  ) {}
}

/** Runs a claimed target's adapter, resuming from `memo` (see replaySteps). */
export function advanceTarget(targetId: string, memo: StepMemo): Promise<Advance> {
  return replaySteps(memo, (steps) => publishClaimedTarget(targetId, steps));
}

/**
 * Runs `body` from the top, skipping steps the memo already finished, until it reaches a sleep it
 * hasn't done yet, finishes, or fails. The workflow does the sleeping and calls again, so long waits
 * (Instagram processing) cost nothing and survive restarts. Errors come back as data with the memo,
 * so a retry redoes only the step that failed.
 */
export async function replaySteps(memo: StepMemo, body: (steps: StepRunner) => Promise<unknown>): Promise<Advance> {
  const next: StepMemo = { ...memo };
  const steps: StepRunner = {
    async run(id, fn) {
      if (id in next) return next[id].v as never;
      const v = await fn();
      next[id] = { v };
      return v;
    },
    async sleep(id, duration) {
      if (id in next) return;
      throw new Suspend(id, duration);
    },
  };
  try {
    await body(steps);
    return { kind: "done", memo: next };
  } catch (err) {
    if (err instanceof Suspend) return { kind: "sleep", memo: next, id: err.id, duration: err.duration };
    console.error("[publish]", err);
    return { kind: "error", memo: next, message: err instanceof Error ? err.message : String(err), retryable: !(err instanceof NonRetriableError) };
  }
}

/**
 * Self-heal for a post someone is looking at: targets killed mid-publish are failed so they can be
 * retried, and due targets nobody picked up (the workflow was lost) get a new workflow after the
 * response. Cheap when there's nothing to do, so safe to call on every render.
 */
export function healStalledPost(
  post: Pick<PostRow, "id" | "status" | "scheduled_for" | "updated_at"> & { targets: Pick<PostTargetRow, "status" | "started_at">[] },
) {
  const now = new Date();
  const stale = post.targets.some((t) => isStaleTarget(t, now));
  const restart = needsRestart(post, now);
  if (!stale && !restart) return;
  after(async () => {
    if (stale) await failStaleTargets(post.id);
    if (restart) {
      const { startPublishPost } = await import("./start");
      await startPublishPost(post.id).catch((err) => console.error(err));
    }
  });
}
