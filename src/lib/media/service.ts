import "server-only";
import { randomUUID } from "node:crypto";
import { signToken, verifyToken } from "@/lib/crypto";
import { CLEANUP_RULES, DAY_MS, isPurgeable, type MediaUsageAsset, type PostUsage } from "@/lib/media/cleanup";
import { env } from "@/lib/env";
import { UPLOAD_MAX_BYTES } from "@/lib/media/shrink-plan";
import { readCapped, safeFetch } from "@/lib/net/safe-fetch";
import { MEDIA_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { SUPPORTED_MIME } from "@/lib/platforms/limits";
import type { MediaAssetRow, MediaKind } from "@/lib/types";

const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function kindForMime(mime: string): MediaKind | null {
  if ((SUPPORTED_MIME.video as readonly string[]).includes(mime)) return "video";
  if ((SUPPORTED_MIME.image as readonly string[]).includes(mime)) return "image";
  return null;
}

export interface NewMediaInput {
  mime: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationS?: number | null;
}

/** Creates a pending asset row and returns where to upload it. */
export async function createMediaAsset(userId: string, input: NewMediaInput): Promise<MediaAssetRow> {
  const kind = kindForMime(input.mime);
  if (!kind) throw new Error(`Unsupported file type ${input.mime}. Use MP4/MOV video or JPEG/PNG/WebP images.`);
  const id = randomUUID();
  const { data, error } = await supabaseAdmin()
    .from("media_assets")
    .insert({
      id,
      user_id: userId,
      storage_path: `${userId}/${id}.${EXT[input.mime]}`,
      kind,
      mime: input.mime,
      size_bytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_s: input.durationS ?? null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MediaAssetRow;
}

export async function getMediaAsset(userId: string, assetId: string): Promise<MediaAssetRow> {
  const { data, error } = await supabaseAdmin().from("media_assets").select("*").eq("user_id", userId).eq("id", assetId).single();
  if (error || !data) throw new Error("Media not found");
  return data as MediaAssetRow;
}

/** Confirms the object exists in storage, records its real size, and marks the asset ready. */
export async function finalizeMediaAsset(
  userId: string,
  assetId: string,
  patch: { thumbnailPath?: string | null; width?: number | null; height?: number | null; durationS?: number | null } = {},
): Promise<MediaAssetRow> {
  const asset = await getMediaAsset(userId, assetId);
  const db = supabaseAdmin();
  const { data: info, error: infoError } = await db.storage.from(MEDIA_BUCKET).info(asset.storage_path);
  if (infoError || !info) throw new Error("Upload not found in storage yet. Finish uploading the file first.");
  if (patch.thumbnailPath && patch.thumbnailPath !== thumbnailPathFor(asset)) throw new Error("Invalid thumbnail path");
  const { data, error } = await db
    .from("media_assets")
    .update({
      status: "ready",
      size_bytes: info.size ?? asset.size_bytes,
      thumbnail_path: patch.thumbnailPath ?? asset.thumbnail_path,
      width: patch.width ?? asset.width,
      height: patch.height ?? asset.height,
      duration_s: patch.durationS ?? asset.duration_s,
    })
    .eq("id", assetId)
    .select("*")
    .single();
  if (error) throw error;
  return data as MediaAssetRow;
}

/** One-time URL the browser or an agent can PUT the raw file to (valid for 2 hours). */
export async function createSignedUploadUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw error ?? new Error("Couldn't create upload URL");
  return data.signedUrl;
}

export function createSignedUpload(asset: MediaAssetRow) {
  return createSignedUploadUrl(asset.storage_path);
}

export function thumbnailPathFor(asset: MediaAssetRow) {
  return asset.storage_path.replace(/\.[^.]+$/, ".thumb.jpg");
}

export async function signedReadUrl(path: string, expiresInS = 60 * 60): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresInS);
  if (error || !data) throw error ?? new Error("Couldn't sign media URL");
  return data.signedUrl;
}

export async function signedReadUrls(paths: string[], expiresInS = 60 * 60): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUrls(unique, expiresInS);
  return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

/** Path prefix that serves media from this app's own domain (verified with TikTok for photo posts). */
export const APP_MEDIA_PREFIX = "/media/tt/";
const APP_MEDIA_PURPOSE = "app-media-url";

interface AppMediaToken {
  /** storage path */
  p: string;
  /** mime */
  m: string;
  /** expiry, epoch seconds */
  e: number;
}

/** Signed, expiring URL on this app's domain that streams one stored file. */
export function appMediaUrl(asset: Pick<MediaAssetRow, "storage_path" | "mime">, expiresInS = 60 * 60): string {
  const token = signToken(
    { p: asset.storage_path, m: asset.mime, e: Math.floor(Date.now() / 1000) + expiresInS } satisfies AppMediaToken,
    env.tokenEncryptionKey(),
    APP_MEDIA_PURPOSE,
  );
  return `${env.appUrl()}${APP_MEDIA_PREFIX}${token}.${EXT[asset.mime] ?? "bin"}`;
}

/** Reads a token from appMediaUrl; null when it's forged or expired. */
export function readAppMediaToken(token: string): { storagePath: string; mime: string } | null {
  const payload = verifyToken<AppMediaToken>(token.replace(/\.[a-z0-9]+$/i, ""), env.tokenEncryptionKey(), APP_MEDIA_PURPOSE);
  if (!payload || payload.e < Date.now() / 1000) return null;
  return { storagePath: payload.p, mime: payload.m };
}

/** Deletes the stored file (not the row or thumbnail) once nothing needs it anymore. */
export async function purgeMediaFile(asset: Pick<MediaAssetRow, "id" | "storage_path">): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
  if (error) throw error;
  await db.from("media_assets").update({ purged_at: new Date().toISOString() }).eq("id", asset.id);
}

// Storage takes at most UPLOAD_MAX_BYTES per file, so a bigger download would only fail at upload.
const MAX_IMPORT_BYTES = UPLOAD_MAX_BYTES;

/** Downloads a public URL into storage (for agents that have a link rather than a local file). */
export async function importMediaFromUrl(userId: string, sourceUrl: string, maxBytes = MAX_IMPORT_BYTES): Promise<MediaAssetRow> {
  const res = await safeFetch(sourceUrl);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!kindForMime(mime)) throw new Error(`Unsupported file type ${mime || "unknown"}. Use MP4/MOV video or JPEG/PNG/WebP images.`);
  const body = await readCapped(res, maxBytes);
  const asset = await createMediaAsset(userId, { mime, sizeBytes: body.byteLength });
  const { error } = await supabaseAdmin().storage.from(MEDIA_BUCKET).upload(asset.storage_path, body, { contentType: mime, upsert: true });
  if (error) throw error;
  return finalizeMediaAsset(userId, asset.id);
}

/**
 * Frees storage (Supabase's free plan has 1 GB): deletes the stored file once every post using it is
 * done. The media row and its thumbnail stay so the post history still renders. Returns how many.
 */
export async function purgeFinishedMedia(): Promise<number> {
  // Assets still in use are never marked purged, so page past them instead of re-reading the same oldest batch.
  let purged = 0;
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const batch = await purgeFinishedBatch(after);
    purged += batch.purged;
    if (!batch.last) break;
    after = batch.last;
  }
  return purged;
}

const PURGE_BATCH = 500;

async function purgeFinishedBatch(after: string | null): Promise<{ purged: number; last: string | null }> {
  const db = supabaseAdmin();
  let query = db
    .from("media_assets")
    .select("id, storage_path, status, created_at")
    .is("purged_at", null)
    .lt("created_at", new Date(Date.now() - CLEANUP_RULES.orphanAfterDays * DAY_MS).toISOString());
  if (after) query = query.gt("created_at", after);
  const { data: assets } = await query.order("created_at").limit(PURGE_BATCH);
  if (!assets?.length) return { purged: 0, last: null };
  const { data: links } = await db
    .from("post_media")
    .select("media_asset_id, post:posts(status, published_at, updated_at, media_asset_id)")
    .in("media_asset_id", assets.map((a) => a.id));
  // Covers of posts made before post_media existed.
  const { data: covers } = await db
    .from("posts")
    .select("status, published_at, updated_at, media_asset_id")
    .in("media_asset_id", assets.map((a) => a.id));
  // Project icons and screenshots aren't posts but still need their files.
  const [{ data: projectMedia }, { data: icons }] = await Promise.all([
    db.from("project_media").select("media_asset_id").in("media_asset_id", assets.map((a) => a.id)),
    db.from("projects").select("icon_asset_id").in("icon_asset_id", assets.map((a) => a.id)),
  ]);
  const kept = new Set<string>([
    ...(projectMedia ?? []).map((r) => r.media_asset_id as string),
    ...(icons ?? []).map((r) => r.icon_asset_id as string),
  ]);
  const usage = new Map<string, PostUsage[]>();
  const add = (id: string, p: PostUsage | null) => p && usage.set(id, [...(usage.get(id) ?? []), p]);
  for (const l of links ?? []) add(l.media_asset_id as string, l.post as unknown as PostUsage);
  for (const c of covers ?? []) add(c.media_asset_id as string, c as PostUsage);

  const purgeable = assets.filter((a) => !kept.has(a.id as string) && isPurgeable(a as MediaUsageAsset, usage.get(a.id) ?? [], new Date()));
  for (const asset of purgeable) {
    await purgeMediaFile({ id: asset.id as string, storage_path: asset.storage_path as string }).catch((err) => console.error(err));
  }
  return { purged: purgeable.length, last: assets.length === PURGE_BATCH ? (assets[assets.length - 1].created_at as string) : null };
}
