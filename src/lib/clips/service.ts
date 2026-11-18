import "server-only";
import { createMediaAsset, finalizeMediaAsset, getMediaAsset, purgeMediaFile, signedReadUrl, signedReadUrls, thumbnailPathFor } from "@/lib/media/service";
import { MEDIA_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { CLIP_CANCELLED as CANCELLED, type ClipJobRow, type ClipJobStatus, type ClipRow, type MediaAssetRow } from "@/lib/types";
import { assertWithinPlan, PLANS } from "@/lib/billing/plans";
import { clipBudgetSpent, CLIP_USD_PER_VIDEO, recordUsage } from "@/lib/usage/service";
import { buildAss, wordsInRange } from "./captions";
import { prepareScript, renderScript, transcribeScript, type Source } from "./render";
import { createJobSandbox, destroyJobSandbox, jobSandbox, readBytes, readText, SANDBOX_USD_PER_MIN, startPhase, waitPhase } from "./sandbox";
import { findClips } from "./select";
import { DEEPGRAM_USD_PER_MIN, parseDeepgram } from "./transcript";

/** A failure the user should read as is; the workflow doesn't retry it. */
export class ClipError extends Error {}

const db = () => supabaseAdmin();

// ---------------------------------------------------------------- jobs, for the app

export interface NewClipJob {
  projectId: string | null;
  sourceUrl?: string | null;
  sourceAssetId?: string | null;
}

/** The video ID of a YouTube link in any of its shapes (watch, youtu.be, shorts, live, embed), else null. */
export function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const id = host === "youtu.be" ? url.pathname.slice(1) : host === "youtube.com" ? (url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1]) : null;
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

export function parseSourceUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ClipError("That doesn't look like a link. Paste the full address, starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ClipError("Only http and https links work.");
  // One spelling per YouTube video, so a repeat of the same video finds the earlier job's transcript (see cachedTranscript).
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  // Dropbox's documented switch from its preview page to the file itself.
  if (/(^|\.)dropbox\.com$/i.test(url.hostname)) url.searchParams.set("dl", "1");
  return url.toString();
}

export async function createClipJob(userId: string, input: NewClipJob): Promise<ClipJobRow> {
  const sourceUrl = input.sourceUrl ? parseSourceUrl(input.sourceUrl) : null;
  if (!sourceUrl && !input.sourceAssetId) throw new ClipError("Paste a video link or upload a video first.");
  if (input.sourceAssetId) {
    const asset = await getMediaAsset(userId, input.sourceAssetId);
    if (asset.kind !== "video" || asset.status !== "ready") throw new ClipError("Pick a video that has finished uploading.");
  }
  if (!process.env.DEEPGRAM_API_KEY) throw new ClipError("Clipping isn't set up yet: DEEPGRAM_API_KEY is missing.");
  const plan = await assertWithinPlan(userId, "clips");
  // A cost backstop on top of the video count, for very long videos.
  if (await clipBudgetSpent(userId, PLANS[plan].clipsPerDay * CLIP_USD_PER_VIDEO)) {
    throw new ClipError("You've hit today's clipping allowance. It frees up over the next 24 hours.");
  }
  const { data, error } = await db()
    .from("clip_jobs")
    .insert({
      user_id: userId,
      project_id: input.projectId,
      source_url: sourceUrl,
      source_asset_id: input.sourceAssetId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClipJobRow;
}

const JOB_LIST_COLUMNS =
  "id, user_id, project_id, source_url, source_asset_id, status, error, target_length_s, source_title, source_duration_s, sandbox_name, clips_total, clips_done, created_at, updated_at";

export async function listClipJobs(userId: string, projectId: string | null, limit = 30): Promise<Omit<ClipJobRow, "transcript">[]> {
  let q = db().from("clip_jobs").select(JOB_LIST_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Omit<ClipJobRow, "transcript">[];
}

export async function getClipJob(userId: string, jobId: string): Promise<Omit<ClipJobRow, "transcript"> | null> {
  const { data, error } = await db().from("clip_jobs").select(JOB_LIST_COLUMNS).eq("user_id", userId).eq("id", jobId).maybeSingle();
  if (error) throw error;
  return data as Omit<ClipJobRow, "transcript"> | null;
}

export interface ClipView extends ClipRow {
  asset: Pick<MediaAssetRow, "id" | "status" | "purged_at" | "width" | "height" | "duration_s"> | null;
  videoUrl: string | null;
  posterUrl: string | null;
}

/** A job's clips, best first, with signed URLs to preview them. */
export async function listClips(userId: string, jobId: string): Promise<ClipView[]> {
  const { data, error } = await db()
    .from("clips")
    .select("*, asset:media_assets(id, status, purged_at, width, height, duration_s, storage_path, thumbnail_path)")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .order("score", { ascending: false });
  if (error) throw error;
  type Row = ClipRow & { asset: (ClipView["asset"] & { storage_path: string; thumbnail_path: string | null }) | null };
  const rows = (data ?? []) as Row[];
  const live = rows.filter((r) => r.asset && r.asset.status === "ready" && !r.asset.purged_at);
  const urls = await signedReadUrls(live.flatMap((r) => [r.asset!.storage_path, r.asset!.thumbnail_path ?? ""]), 6 * 60 * 60);
  return rows.map(({ asset, ...clip }) => {
    const usable = asset && asset.status === "ready" && !asset.purged_at;
    return {
      ...clip,
      start_s: Number(clip.start_s),
      end_s: Number(clip.end_s),
      asset: asset ? { id: asset.id, status: asset.status, purged_at: asset.purged_at, width: asset.width, height: asset.height, duration_s: asset.duration_s } : null,
      videoUrl: usable ? (urls[asset.storage_path] ?? null) : null,
      posterUrl: usable && asset.thumbnail_path ? (urls[asset.thumbnail_path] ?? null) : null,
    };
  });
}

/** What the composer needs to start a post from a clip. */
export async function clipForCompose(userId: string, clipId: string) {
  const { data, error } = await db().from("clips").select("id, title, caption, media_asset_id").eq("user_id", userId).eq("id", clipId).maybeSingle();
  if (error) throw error;
  if (!data?.media_asset_id) return null;
  const asset = await getMediaAsset(userId, data.media_asset_id).catch(() => null);
  if (!asset || asset.status !== "ready" || asset.purged_at) return null;
  return {
    assetId: asset.id,
    videoUrl: await signedReadUrl(asset.storage_path, 6 * 60 * 60),
    width: asset.width,
    height: asset.height,
    durationS: asset.duration_s === null ? null : Number(asset.duration_s),
    sizeBytes: asset.size_bytes,
    title: data.title as string,
    caption: data.caption as string,
  };
}

export async function discardClip(userId: string, clipId: string): Promise<{ jobId: string }> {
  const { data, error } = await db().from("clips").select("id, job_id, media_asset_id").eq("user_id", userId).eq("id", clipId).single();
  if (error || !data) throw new ClipError("Clip not found.");
  if (data.media_asset_id) {
    const asset = await getMediaAsset(userId, data.media_asset_id).catch(() => null);
    // A clip already used in a post keeps its file until the post's cleanup removes it.
    const { count } = await db().from("post_media").select("post_id", { count: "exact", head: true }).eq("media_asset_id", data.media_asset_id);
    const { count: legacy } = await db().from("posts").select("id", { count: "exact", head: true }).eq("media_asset_id", data.media_asset_id);
    if (asset && !asset.purged_at && !count && !legacy) await purgeMediaFile(asset);
  }
  const { error: delErr } = await db().from("clips").delete().eq("id", clipId);
  if (delErr) throw delErr;
  return { jobId: data.job_id as string };
}

/** Stops a running job: marks it cancelled and deletes its sandbox, so the workflow's next step ends it (see loadJob). */
export async function cancelClipJob(userId: string, jobId: string): Promise<void> {
  const { data, error } = await db()
    .from("clip_jobs")
    .update({ status: "failed", error: CANCELLED, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", jobId)
    .not("status", "in", "(ready,failed)")
    .select("sandbox_name, created_at, project_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ClipError("This job already finished.");
  if (data.sandbox_name) {
    await destroyJobSandbox(data.sandbox_name);
    const minutes = (Date.now() - new Date(data.created_at).getTime()) / 60_000;
    void recordUsage({ userId, projectId: data.project_id, kind: "video", provider: "vercel-sandbox", units: minutes, costUsd: minutes * SANDBOX_USD_PER_MIN, ref: "clip-sandbox" });
  }
}

// ---------------------------------------------------------------- the pipeline, for workflow steps

async function loadJob(jobId: string): Promise<ClipJobRow> {
  const { data, error } = await db().from("clip_jobs").select("*").eq("id", jobId).single();
  if (error || !data) throw new ClipError("This clip job no longer exists.");
  // A ClipError is fatal, so a cancelled job's workflow stops at its next step; finishJob then leaves the row alone.
  if (data.error === CANCELLED) throw new ClipError(CANCELLED);
  return data as ClipJobRow;
}

async function patchJob(jobId: string, patch: Partial<Omit<ClipJobRow, "id" | "user_id">>) {
  const { error } = await db().from("clip_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", jobId);
  if (error) throw error;
}

async function setStatus(jobId: string, status: ClipJobStatus) {
  await patchJob(jobId, { status });
}

/** Turns the end of a failed phase's log into something a person can act on. */
export function explainFailure(phase: string, log: string): string {
  if (/TOO_LONG|does not pass filter/i.test(log)) return "This video is over 2 hours. Clip a shorter one, or trim it and upload the file.";
  if (/curl: \(63\)|larger than max-filesize/i.test(log)) return "This file is over 4 GB. Export a smaller version and try again.";
  // yt-dlp's 403 comes after the video was found, so the site refused our server, not the link.
  if (/confirm you.?re not a bot|HTTP Error 4(03|29)|blocked/i.test(log)) {
    return "The site blocked the download from our servers. Download the video yourself and upload the file instead.";
  }
  // Never a bare "age": every YouTube log has "Downloading webpage".
  if (/Private video|members-only|This video is unavailable|Video unavailable|login required|confirm your age|age.restricted/i.test(log)) {
    return "This video is private, age-restricted or unavailable. Use a public link, or upload the file.";
  }
  if (/Unsupported URL/i.test(log)) return "That link isn't a video we can open. Try a direct video link or upload the file.";
  if (/DOWNLOAD_FAILED|HTTP Error|curl: \(\d+\)/i.test(log) && phase === "prepare") return "Couldn't download this video. Check the link is public, or upload the file instead.";
  if (phase === "transcribe") return "Couldn't transcribe the audio. Try again in a few minutes.";
  if (phase.startsWith("render")) return "Couldn't render this clip.";
  return "Couldn't process this video. Try again, or upload the file instead.";
}

/**
 * An earlier job's transcript of the same YouTube video, from any user: a repeat link then skips the audio download and the transcription.
 * YouTube only, because a video ID always names the same video, while any other link can be pointed at a new file.
 * shortcut: a video trimmed in YouTube's editor after it was cached gets captions that are off; add a max age if that shows up.
 */
async function cachedTranscript(job: ClipJobRow): Promise<Pick<ClipJobRow, "transcript" | "source_title" | "source_duration_s"> | null> {
  if (!job.source_url || !youtubeId(new URL(job.source_url))) return null;
  const { data } = await db()
    .from("clip_jobs")
    .select("transcript, source_title, source_duration_s")
    .eq("source_url", job.source_url)
    .neq("id", job.id)
    .not("transcript", "is", null)
    // A live or over-2-hour video was cut to its last 2 hours, which move while it's live.
    .is("source_offset_s", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.transcript?.length ? (data as Pick<ClipJobRow, "transcript" | "source_title" | "source_duration_s">) : null;
}

/** What a link download needs in the sandbox: the WARP profile and the fallback proxy, whichever are set. */
function linkEnv(): Record<string, string> {
  const { WARP_PROFILE_B64, YTDLP_PROXY } = process.env;
  return { ...(WARP_PROFILE_B64 ? { WARP_PROFILE_B64 } : {}), ...(YTDLP_PROXY ? { YTDLP_PROXY } : {}) };
}

/** Starts the sandbox and the download. Returns true when the transcript came from an earlier job, so there is nothing to transcribe. */
export async function startPrepare(jobId: string): Promise<boolean> {
  const job = await loadJob(jobId);
  await setStatus(jobId, "downloading");
  let source: Source;
  if (job.source_asset_id) {
    const asset = await getMediaAsset(job.user_id, job.source_asset_id);
    if (asset.purged_at) throw new ClipError("The uploaded video has been cleaned up. Upload it again.");
    source = { kind: "file", url: await signedReadUrl(asset.storage_path, 2 * 60 * 60) };
  } else {
    source = { kind: "link", url: job.source_url! };
  }
  const sandbox = await createJobSandbox(jobId);
  await patchJob(jobId, { sandbox_name: sandbox.name });
  const cached = source.kind === "link" ? await cachedTranscript(job) : null;
  if (cached) await patchJob(jobId, cached);
  await startPhase(sandbox, "prepare", prepareScript(source, !!cached), source.kind === "link" ? linkEnv() : undefined);
  return !!cached;
}

/** Waits a bounded time for a phase. Throws ClipError when it failed. */
export async function waitForPhase(jobId: string, phase: string): Promise<boolean> {
  const job = await loadJob(jobId);
  if (!job.sandbox_name) throw new ClipError("The video worker never started. Try again.");
  const state = await waitPhase(await jobSandbox(job.sandbox_name), phase);
  if (!state.done) return false;
  if (!state.ok) {
    console.error(`clip ${jobId} phase ${phase} failed:\n${state.log}`);
    throw new ClipError(explainFailure(phase, state.log));
  }
  if (phase === "prepare" && !job.source_asset_id) {
    console.log(`clip ${jobId} download route: ${(await readText(await jobSandbox(job.sandbox_name), "route.txt")).trim() || "proxy-or-direct"}`);
  }
  return true;
}

export async function startTranscribe(jobId: string): Promise<void> {
  const job = await loadJob(jobId);
  const sandbox = await jobSandbox(job.sandbox_name!);
  const duration = Number((await readText(sandbox, "duration.txt")).trim()) || null;
  const title = (await readText(sandbox, "title.txt")).trim().split("\n")[0]?.slice(0, 200) || null;
  // Only a live or over-2-hour link writes offset.txt (see prepareScript).
  const offset = job.source_asset_id ? "" : (await readText(sandbox, "offset.txt")).trim();
  await patchJob(jobId, { status: "transcribing", source_duration_s: duration, source_title: title, ...(offset ? { source_offset_s: Number(offset) } : {}) });
  await startPhase(sandbox, "transcribe", transcribeScript(), { DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ?? "" });
}

export async function finishTranscribe(jobId: string): Promise<void> {
  const job = await loadJob(jobId);
  const sandbox = await jobSandbox(job.sandbox_name!);
  const words = parseDeepgram(JSON.parse(await readText(sandbox, "transcript.json")));
  await patchJob(jobId, { transcript: words });
  const minutes = Number(job.source_duration_s ?? 0) / 60;
  void recordUsage({ userId: job.user_id, projectId: job.project_id, kind: "transcribe", provider: "deepgram", model: "nova-3", units: minutes, costUsd: minutes * DEEPGRAM_USD_PER_MIN, ref: "clip-transcribe" });
}

export interface PlannedClip {
  id: string;
  n: number;
}

/** Has the AI pick the moments and saves them as clips waiting to render. */
export async function pickClips(jobId: string): Promise<PlannedClip[]> {
  const job = await loadJob(jobId);
  await setStatus(jobId, "finding");
  // A retried step must not add a second set of clips.
  const { data: existing } = await db().from("clips").select("id, start_s").eq("job_id", jobId).order("start_s");
  if (existing?.length) return existing.map((c, n) => ({ id: c.id as string, n }));

  const candidates = await findClips(job.user_id, job.project_id, job.transcript ?? [], { title: job.source_title });
  if (!candidates.length) throw new ClipError("The AI didn't find any moments strong enough to clip in this video.");
  const ordered = [...candidates].sort((a, b) => a.start - b.start);
  const { data, error } = await db()
    .from("clips")
    .insert(
      ordered.map((c) => ({
        job_id: jobId,
        user_id: job.user_id,
        start_s: c.start,
        end_s: c.end,
        title: c.title,
        hook: c.hook,
        caption: c.caption,
        score: c.score,
        reason: c.reason,
      })),
    )
    .select("id, start_s")
    .order("start_s");
  if (error) throw error;
  await patchJob(jobId, { status: "rendering", clips_total: data.length, clips_done: 0 });
  return data.map((c, n) => ({ id: c.id as string, n }));
}

async function loadClip(clipId: string): Promise<ClipRow> {
  const { data, error } = await db().from("clips").select("*").eq("id", clipId).single();
  if (error || !data) throw new ClipError("Clip not found.");
  return { ...(data as ClipRow), start_s: Number(data.start_s), end_s: Number(data.end_s) };
}

export async function startRender(jobId: string, clipId: string, n: number): Promise<void> {
  const [job, clip] = await Promise.all([loadJob(jobId), loadClip(clipId)]);
  const ass = buildAss(wordsInRange(job.transcript ?? [], clip.start_s, clip.end_s));
  // A link job has only the audio in the sandbox, so the render fetches this moment's picture itself.
  const link = job.source_asset_id ? undefined : (job.source_url ?? undefined);
  const off = link ? Number(job.source_offset_s ?? 0) : 0;
  await startPhase(await jobSandbox(job.sandbox_name!), `render-${n}`, renderScript(n, clip.start_s + off, clip.end_s + off, link), link ? linkEnv() : undefined, [{ path: `clip-${n}.ass`, content: ass }]);
}

/** Uploads a rendered clip and its poster frame to storage, and links it to the clip. */
export async function finishRender(jobId: string, clipId: string, n: number): Promise<void> {
  const [job, clip] = await Promise.all([loadJob(jobId), loadClip(clipId)]);
  if (clip.media_asset_id) return;
  const sandbox = await jobSandbox(job.sandbox_name!);
  const video = await readBytes(sandbox, `clip-${n}.mp4`);
  if (!video?.byteLength) throw new ClipError("The rendered clip was empty.");
  const durationS = clip.end_s - clip.start_s;
  const asset = await createMediaAsset(job.user_id, { mime: "video/mp4", sizeBytes: video.byteLength, width: 1080, height: 1920, durationS });
  const storage = db().storage.from(MEDIA_BUCKET);
  const { error } = await storage.upload(asset.storage_path, video, { contentType: "video/mp4", upsert: true });
  if (error) throw error;
  let thumbnailPath: string | null = null;
  const poster = await readBytes(sandbox, `clip-${n}.jpg`);
  if (poster?.byteLength) {
    const path = thumbnailPathFor(asset);
    const { error: thumbErr } = await storage.upload(path, poster, { contentType: "image/jpeg", upsert: true });
    if (!thumbErr) thumbnailPath = path;
  }
  await finalizeMediaAsset(job.user_id, asset.id, { thumbnailPath, width: 1080, height: 1920, durationS });
  const { error: linkErr } = await db().from("clips").update({ media_asset_id: asset.id }).eq("id", clipId);
  if (linkErr) throw linkErr;
  await bumpDone(jobId);
}

async function bumpDone(jobId: string) {
  const { count } = await db().from("clips").select("id", { count: "exact", head: true }).eq("job_id", jobId).not("media_asset_id", "is", null);
  await patchJob(jobId, { clips_done: count ?? 0 });
}

/** Removes a clip that failed to render, so the review page only shows playable clips. */
export async function dropClip(jobId: string, clipId: string, reason: string): Promise<void> {
  console.error(`clip ${clipId} dropped: ${reason}`);
  await db().from("clips").delete().eq("id", clipId).is("media_asset_id", null);
  const { count } = await db().from("clips").select("id", { count: "exact", head: true }).eq("job_id", jobId);
  await patchJob(jobId, { clips_total: count ?? 0 });
}

/** Marks the job finished, tears the sandbox down and records what it cost. */
export async function finishJob(jobId: string, error: string | null): Promise<void> {
  const job = await loadJob(jobId).catch(() => null);
  if (!job) return;
  let finalError = error;
  if (!finalError) {
    const { count } = await db().from("clips").select("id", { count: "exact", head: true }).eq("job_id", jobId).not("media_asset_id", "is", null);
    if (!count) finalError = "None of the clips could be rendered. Try again.";
  }
  await patchJob(jobId, { status: finalError ? "failed" : "ready", error: finalError, transcript: finalError ? null : job.transcript });
  if (job.sandbox_name) {
    await destroyJobSandbox(job.sandbox_name);
    const minutes = (Date.now() - new Date(job.created_at).getTime()) / 60_000;
    void recordUsage({ userId: job.user_id, projectId: job.project_id, kind: "video", provider: "vercel-sandbox", units: minutes, costUsd: minutes * SANDBOX_USD_PER_MIN, ref: "clip-sandbox" });
  }
}
