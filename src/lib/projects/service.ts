import "server-only";
import { signedReadUrls } from "@/lib/media/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PUBLIC_ACCOUNT_COLUMNS, type MediaAssetRow, type PublicAccount } from "@/lib/types";
import { projectKitSchema, type ProjectKit, type ProjectKitInput } from "./kit";

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  store_url: string | null;
  platform_hint: "ios" | "android" | "web" | null;
  kit: ProjectKit;
  notes: string;
  icon_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectMediaRole = "screen" | "logo" | "photo";

export interface ProjectMediaRow {
  project_id: string;
  media_asset_id: string;
  role: ProjectMediaRole;
  shows: string;
  tags: string[];
  position: number;
}

export interface ProjectMediaItem extends ProjectMediaRow {
  media: MediaAssetRow;
  /** Signed read URL (an hour). */
  url: string | null;
}

export interface ProjectInput {
  name: string;
  storeUrl?: string | null;
  platformHint?: ProjectRow["platform_hint"];
  kit?: ProjectKitInput;
  notes?: string;
  iconAssetId?: string | null;
}

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "app";
}

/** `base`, or `base-2`, `base-3`… whichever isn't taken. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

const parseRow = (row: ProjectRow): ProjectRow => ({ ...row, kit: projectKitSchema.parse(row.kit ?? {}) });

export async function listProjects(userId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabaseAdmin().from("projects").select("*").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return ((data ?? []) as ProjectRow[]).map(parseRow);
}

export async function getProject(userId: string, projectId: string): Promise<ProjectRow> {
  const { data, error } = await supabaseAdmin().from("projects").select("*").eq("user_id", userId).eq("id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ProjectNotFoundError();
  return parseRow(data as ProjectRow);
}

/** Throws unless `projectId` belongs to `userId`. Every project-scoped write goes through this. */
export const assertProjectOwner = getProject;

/** The user's first project, or null when they have none. */
export async function defaultProject(userId: string): Promise<ProjectRow | null> {
  const { data, error } = await supabaseAdmin().from("projects").select("*").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
  if (error) throw error;
  return data ? parseRow(data as ProjectRow) : null;
}

export async function createProject(userId: string, input: ProjectInput): Promise<ProjectRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Give the project a name");
  const db = supabaseAdmin();
  const { data: rows, error: slugErr } = await db.from("projects").select("slug").eq("user_id", userId);
  if (slugErr) throw slugErr;
  const { data, error } = await db
    .from("projects")
    .insert({
      user_id: userId,
      name,
      slug: uniqueSlug(slugify(name), (rows ?? []).map((r) => r.slug)),
      store_url: input.storeUrl ?? null,
      platform_hint: input.platformHint ?? null,
      kit: projectKitSchema.parse(input.kit ?? {}),
      notes: input.notes ?? "",
      icon_asset_id: input.iconAssetId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return parseRow(data as ProjectRow);
}

export async function updateProject(userId: string, projectId: string, patch: Partial<ProjectInput>): Promise<ProjectRow> {
  const current = await assertProjectOwner(userId, projectId);
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error("Give the project a name");
    update.name = patch.name.trim();
  }
  if (patch.storeUrl !== undefined) update.store_url = patch.storeUrl;
  if (patch.platformHint !== undefined) update.platform_hint = patch.platformHint;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.iconAssetId !== undefined) update.icon_asset_id = patch.iconAssetId;
  // Kit patches merge into what's saved, so callers (and the copilot) can change one field at a time.
  if (patch.kit !== undefined) update.kit = projectKitSchema.parse({ ...current.kit, ...patch.kit });
  if (!Object.keys(update).length) return current;
  const { data, error } = await supabaseAdmin().from("projects").update(update).eq("user_id", userId).eq("id", projectId).select("*").single();
  if (error) throw error;
  return parseRow(data as ProjectRow);
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await assertProjectOwner(userId, projectId);
  const { error } = await supabaseAdmin().from("projects").delete().eq("user_id", userId).eq("id", projectId);
  if (error) throw error;
}

export async function projectAccountIds(userId: string, projectId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("project_accounts")
    .select("social_account_id")
    .eq("user_id", userId)
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((r) => r.social_account_id as string);
}

export async function listProjectAccounts(userId: string, projectId: string): Promise<PublicAccount[]> {
  const ids = await projectAccountIds(userId, projectId);
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin()
    .from("social_accounts")
    .select(PUBLIC_ACCOUNT_COLUMNS)
    .eq("user_id", userId)
    .in("id", ids)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as PublicAccount[];
}

/** Replaces which of the user's connected accounts post for this project. */
export async function setProjectAccounts(userId: string, projectId: string, accountIds: string[]): Promise<PublicAccount[]> {
  await assertProjectOwner(userId, projectId);
  const db = supabaseAdmin();
  const wanted = [...new Set(accountIds)];
  if (wanted.length) {
    const { data, error } = await db.from("social_accounts").select("id").eq("user_id", userId).in("id", wanted);
    if (error) throw error;
    const owned = new Set((data ?? []).map((r) => r.id as string));
    const missing = wanted.filter((id) => !owned.has(id));
    if (missing.length) throw new Error(`Account ${missing[0]} isn't connected`);
  }
  const { error: delErr } = await db.from("project_accounts").delete().eq("user_id", userId).eq("project_id", projectId);
  if (delErr) throw delErr;
  if (wanted.length) {
    const { error } = await db
      .from("project_accounts")
      .insert(wanted.map((social_account_id) => ({ project_id: projectId, social_account_id, user_id: userId })));
    if (error) throw error;
  }
  return listProjectAccounts(userId, projectId);
}

/** Adds one account to a project (used right after connecting it). */
export async function linkAccountToProject(userId: string, projectId: string, accountId: string): Promise<void> {
  await assertProjectOwner(userId, projectId);
  const { error } = await supabaseAdmin()
    .from("project_accounts")
    .upsert({ project_id: projectId, social_account_id: accountId, user_id: userId }, { onConflict: "project_id,social_account_id", ignoreDuplicates: true });
  if (error) throw error;
}

/** For the Accounts page: which projects each account posts for. */
export async function projectsByAccount(userId: string): Promise<Record<string, { id: string; name: string }[]>> {
  const { data, error } = await supabaseAdmin()
    .from("project_accounts")
    .select("social_account_id, project:projects(id, name)")
    .eq("user_id", userId);
  if (error) throw error;
  const out: Record<string, { id: string; name: string }[]> = {};
  for (const row of (data ?? []) as unknown as { social_account_id: string; project: { id: string; name: string } | null }[]) {
    if (row.project) (out[row.social_account_id] ??= []).push(row.project);
  }
  return out;
}

export async function listProjectMedia(userId: string, projectId: string): Promise<ProjectMediaItem[]> {
  await assertProjectOwner(userId, projectId);
  const { data, error } = await supabaseAdmin()
    .from("project_media")
    .select("*, media:media_assets(*)")
    .eq("project_id", projectId)
    .order("position");
  if (error) throw error;
  const rows = ((data ?? []) as (ProjectMediaRow & { media: MediaAssetRow | null })[]).filter(
    (r): r is ProjectMediaRow & { media: MediaAssetRow } => !!r.media && r.media.user_id === userId,
  );
  const urls = await signedReadUrls(rows.map((r) => r.media.storage_path));
  return rows.map((r) => ({ ...r, url: urls[r.media.storage_path] ?? null }));
}

export interface ProjectMediaInput {
  mediaAssetId: string;
  role: ProjectMediaRole;
  shows?: string;
  tags?: string[];
}

/** Replaces the project's screens, logo and photos, in order. */
export async function setProjectMedia(userId: string, projectId: string, items: ProjectMediaInput[]): Promise<void> {
  await assertProjectOwner(userId, projectId);
  const db = supabaseAdmin();
  const ids = [...new Set(items.map((i) => i.mediaAssetId))];
  if (ids.length) {
    const { data, error } = await db.from("media_assets").select("id").eq("user_id", userId).in("id", ids);
    if (error) throw error;
    if ((data ?? []).length !== ids.length) throw new Error("Some of that media wasn't found");
  }
  const { error: delErr } = await db.from("project_media").delete().eq("project_id", projectId);
  if (delErr) throw delErr;
  const seen = new Set<string>();
  const rows = items
    .filter((i) => !seen.has(i.mediaAssetId) && seen.add(i.mediaAssetId))
    .map((i, position) => ({
      project_id: projectId,
      media_asset_id: i.mediaAssetId,
      role: i.role,
      shows: i.shows?.trim() ?? "",
      tags: i.tags ?? [],
      position,
    }));
  if (rows.length) {
    const { error } = await db.from("project_media").insert(rows);
    if (error) throw error;
  }
}
