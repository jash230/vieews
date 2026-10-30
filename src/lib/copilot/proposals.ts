import "server-only";
import { listAccounts } from "@/lib/accounts/service";
import { signedReadUrls } from "@/lib/media/service";
import { validateMedia } from "@/lib/platforms/limits";
import { createPostSchema, type CreatePostInput } from "@/lib/posts/schema";
import { createPost, mediaInfoOf, PostValidationError } from "@/lib/posts/service";
import { projectAccountIds } from "@/lib/projects/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MediaAssetRow } from "@/lib/types";
import type { PostProposalInput, ProposalStatus, ProposalView } from "./types";

// Outward-facing actions the copilot wants to take. They wait here as cards until the user decides.

interface ProposalRow {
  id: string;
  user_id: string;
  project_id: string;
  tool_use_id: string;
  kind: "post";
  input: PostProposalInput;
  status: ProposalStatus;
  result: ProposalView["result"];
  reported_at: string | null;
  created_at: string;
  decided_at: string | null;
}

async function loadMedia(userId: string, ids: string[]): Promise<MediaAssetRow[]> {
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin().from("media_assets").select("*").eq("user_id", userId).in("id", ids);
  if (error) throw error;
  const byId = new Map((data as MediaAssetRow[]).map((m) => [m.id, m]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

async function toViews(userId: string, rows: ProposalRow[]): Promise<ProposalView[]> {
  if (!rows.length) return [];
  const accounts = await listAccounts(userId);
  const media = await loadMedia(userId, [...new Set(rows.flatMap((r) => r.input.mediaAssetIds))]);
  const thumbs = await signedReadUrls(media.map((m) => m.thumbnail_path ?? (m.kind === "image" ? m.storage_path : "")));
  return rows.map((r) => ({
    id: r.id,
    toolUseId: r.tool_use_id,
    kind: r.kind,
    input: r.input,
    status: r.status,
    result: r.result,
    accounts: Object.fromEntries(
      accounts
        .filter((a) => r.input.targets.some((t) => t.accountId === a.id))
        .map((a) => [a.id, { platform: a.platform, name: a.username ?? a.display_name ?? a.platform }]),
    ),
    media: r.input.mediaAssetIds.flatMap((id) => {
      const m = media.find((x) => x.id === id);
      return m ? [{ id, kind: m.kind, thumbUrl: thumbs[m.thumbnail_path ?? (m.kind === "image" ? m.storage_path : "")] ?? null }] : [];
    }),
  }));
}

/** Checks a proposed post the way createPost will, so the copilot hears about problems before the user does. */
async function precheck(userId: string, projectId: string, input: PostProposalInput): Promise<string[]> {
  const parsed = createPostSchema.safeParse({ ...input, projectId, mediaAssetIds: input.mediaAssetIds });
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const problems: string[] = [];
  const [media, linked, accounts] = await Promise.all([loadMedia(userId, input.mediaAssetIds), projectAccountIds(userId, projectId), listAccounts(userId)]);
  if (media.length !== input.mediaAssetIds.length) problems.push("Some media ids weren't found. Use ids of files the user attached.");
  if (media.some((m) => m.status !== "ready")) problems.push("Some media hasn't finished uploading.");
  if (media.some((m) => m.purged_at)) problems.push("Some media was already cleaned up; ask the user to attach it again.");
  for (const t of parsed.data.targets) {
    const account = accounts.find((a) => a.id === t.accountId);
    if (!account) problems.push(`Account ${t.accountId} isn't connected.`);
    else if (!linked.includes(account.id)) problems.push(`Account ${t.accountId} doesn't post for this project.`);
    else if (account.platform !== t.options.platform) problems.push(`Account ${t.accountId} is ${account.platform}, not ${t.options.platform}.`);
    else if (account.status !== "active") problems.push(`The ${account.platform} account needs reconnecting.`);
    if (media.length === input.mediaAssetIds.length) {
      problems.push(...validateMedia(media.map(mediaInfoOf), t.captionOverride ?? parsed.data.caption, t.options).map((i) => `${i.platform}: ${i.message}`));
    }
  }
  return problems;
}

export async function createPostProposal(ctx: { userId: string; projectId: string; toolUseId?: string }, input: PostProposalInput): Promise<ProposalView> {
  if (!ctx.toolUseId) throw new Error("Missing tool call id");
  const problems = await precheck(ctx.userId, ctx.projectId, input);
  if (problems.length) throw new Error(`Fix these before proposing:\n${problems.join("\n")}`);
  const { data, error } = await supabaseAdmin()
    .from("copilot_proposals")
    .insert({ user_id: ctx.userId, project_id: ctx.projectId, tool_use_id: ctx.toolUseId, kind: "post", input })
    .select("*")
    .single();
  if (error) throw error;
  return (await toViews(ctx.userId, [data as ProposalRow]))[0];
}

export async function listProposals(userId: string, projectId: string): Promise<ProposalView[]> {
  const { data, error } = await supabaseAdmin()
    .from("copilot_proposals")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  return toViews(userId, (data ?? []) as ProposalRow[]);
}

async function getPending(userId: string, proposalId: string): Promise<ProposalRow> {
  const { data, error } = await supabaseAdmin().from("copilot_proposals").select("*").eq("user_id", userId).eq("id", proposalId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Proposal not found");
  if (data.status !== "pending") throw new Error("This was already decided");
  return data as ProposalRow;
}

async function decide(row: ProposalRow, status: ProposalStatus, result: ProposalView["result"]): Promise<ProposalView> {
  const { data, error } = await supabaseAdmin()
    .from("copilot_proposals")
    .update({ status, result, decided_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) throw error;
  return (await toViews(row.user_id, [data as ProposalRow]))[0];
}

/** Sets the outcome of a proposal this request already claimed. */
async function settle(row: ProposalRow, status: ProposalStatus, result: ProposalView["result"]): Promise<ProposalView> {
  const { data, error } = await supabaseAdmin()
    .from("copilot_proposals")
    .update({ status, result })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw error;
  return (await toViews(row.user_id, [data as ProposalRow]))[0];
}

/** The user pressed Approve: create the post exactly as proposed. */
export async function approveProposal(userId: string, proposalId: string): Promise<ProposalView> {
  const pending = await getPending(userId, proposalId);
  // Claim the proposal first so a double press or a second tab can't post it twice.
  const { data: claimed, error } = await supabaseAdmin()
    .from("copilot_proposals")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", pending.id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!claimed) throw new Error("This was already decided");
  const row = claimed as ProposalRow;
  try {
    const input = { ...row.input, projectId: row.project_id, meta: { source: "copilot", reason: row.input.reason ?? null } };
    delete input.reason;
    // createPost validates the stored input against createPostSchema itself.
    const post = await createPost(userId, input as unknown as CreatePostInput, "web");
    return settle(row, "approved", { postId: post.id });
  } catch (err) {
    const message = err instanceof PostValidationError || err instanceof Error ? err.message : "Couldn't create the post";
    return settle(row, "failed", { error: message });
  }
}

export async function declineProposal(userId: string, proposalId: string): Promise<ProposalView> {
  return decide(await getPending(userId, proposalId), "declined", null);
}

/** Decisions the copilot hasn't heard about yet, as lines for the next user message. Marks them reported. */
export async function takeUnreportedDecisions(userId: string, projectId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("copilot_proposals")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .neq("status", "pending")
    .is("reported_at", null);
  if (error) throw error;
  // An approval still creating its post has no result yet; report it next time.
  const rows = ((data ?? []) as ProposalRow[]).filter((r) => r.status !== "approved" || r.result);
  if (!rows.length) return [];
  await db.from("copilot_proposals").update({ reported_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
  return rows.map((r) =>
    r.status === "approved"
      ? `The user approved post proposal ${r.tool_use_id}; post ${r.result?.postId} was created.`
      : r.status === "declined"
        ? `The user declined post proposal ${r.tool_use_id}.`
        : `The user approved post proposal ${r.tool_use_id}, but creating it failed: ${r.result?.error}`,
  );
}
