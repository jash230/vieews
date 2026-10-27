"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { finishUploadAction, startUploadAction } from "../actions";

export interface MediaMeta {
  width: number | null;
  height: number | null;
  durationS: number | null;
  thumbnail: Blob | null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
/** Supabase's resumable endpoint requires exactly 6 MB chunks. */
const CHUNK = 6 * 1024 * 1024;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
}

function drawThumb(source: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, 540 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas);
}

/** Reads dimensions/duration and grabs a poster frame in the browser. */
export async function readMediaMeta(file: File, url: string): Promise<MediaMeta> {
  if (file.type.startsWith("image/")) {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight, durationS: null, thumbnail: await drawThumb(img, img.naturalWidth, img.naturalHeight) };
  }
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("This video can't be read by your browser. Try an MP4 (H.264)."));
  });
  const meta = { width: video.videoWidth || null, height: video.videoHeight || null, durationS: Number.isFinite(video.duration) ? video.duration : null };
  let thumbnail: Blob | null = null;
  try {
    video.currentTime = Math.min(1, (meta.durationS ?? 0) / 2);
    await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
    if (meta.width && meta.height) thumbnail = await drawThumb(video, meta.width, meta.height);
  } catch {
    // Thumbnail is optional.
  }
  return { ...meta, thumbnail };
}

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "done"; assetId: string }
  | { status: "error"; error: string };

export function useMediaUpload() {
  const { session } = useSession();
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const current = useRef<tus.Upload | null>(null);

  const cancel = useCallback(() => {
    current.current?.abort(true);
    current.current = null;
    setState({ status: "idle" });
  }, []);

  const upload = useCallback(
    async (file: File, meta: MediaMeta) => {
      current.current?.abort(true);
      if (!session) return setState({ status: "error", error: "You're signed out. Refresh and sign in again." });
      setState({ status: "uploading", progress: 0 });

      const started = await startUploadAction({ mime: file.type, sizeBytes: file.size, width: meta.width, height: meta.height, durationS: meta.durationS });
      if (!started.ok) return setState({ status: "error", error: started.error });
      const { assetId, storagePath } = started.data;
      const token = () => session.getToken();

      try {
        await new Promise<void>((resolve, reject) => {
          const up = new tus.Upload(file, {
            endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
            retryDelays: [0, 2000, 5000, 10000, 20000],
            chunkSize: CHUNK,
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            headers: { apikey: SUPABASE_KEY, "x-upsert": "true" },
            metadata: { bucketName: "media", objectName: storagePath, contentType: file.type, cacheControl: "3600" },
            // Clerk tokens are short-lived, so attach a fresh one to every chunk.
            onBeforeRequest: async (req) => {
              req.setHeader("authorization", `Bearer ${await token()}`);
            },
            onProgress: (sent, total) => setState({ status: "uploading", progress: total ? sent / total : 0 }),
            onError: reject,
            onSuccess: () => resolve(),
          });
          current.current = up;
          up.start();
        });

        let thumbPath: string | null = null;
        if (meta.thumbnail) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { accessToken: async () => (await token()) ?? null });
          const path = storagePath.replace(/\.[^.]+$/, ".thumb.jpg");
          const { error } = await supabase.storage.from("media").upload(path, meta.thumbnail, { contentType: "image/jpeg", upsert: true });
          if (!error) thumbPath = path;
        }

        const done = await finishUploadAction(assetId, thumbPath);
        if (!done.ok) throw new Error(done.error);
        setState({ status: "done", assetId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setState({ status: "error", error: /413|Payload too large|maximum allowed size/i.test(message) ? "This file is bigger than your Supabase storage upload limit." : message });
      } finally {
        current.current = null;
      }
    },
    [session],
  );

  return { state, upload, cancel };
}
