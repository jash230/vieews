import "server-only";
import { randomUUID } from "node:crypto";
import { signToken, verifyToken } from "@/lib/crypto";
import { env } from "@/lib/env";
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

const MAX_IMPORT_BYTES = 1024 * 1024 * 1024;

/** Downloads a public URL into storage (for agents that have a link rather than a local file). */
export async function importMediaFromUrl(userId: string, sourceUrl: string): Promise<MediaAssetRow> {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("Only https:// URLs can be imported");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(url.hostname)) {
    throw new Error("Private network addresses can't be imported");
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const size = Number(res.headers.get("content-length") ?? 0);
  if (size > MAX_IMPORT_BYTES) throw new Error("File is larger than the 1 GB import limit");
  const asset = await createMediaAsset(userId, { mime, sizeBytes: size });
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_IMPORT_BYTES) throw new Error("File is larger than the 1 GB import limit");
  const { error } = await supabaseAdmin().storage.from(MEDIA_BUCKET).upload(asset.storage_path, body, { contentType: mime, upsert: true });
  if (error) throw error;
  return finalizeMediaAsset(userId, asset.id);
}
