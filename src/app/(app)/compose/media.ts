"use client";

import { useCallback, useRef, useState } from "react";
import { finishUploadAction, startUploadAction } from "../actions";

export interface MediaMeta {
  width: number | null;
  height: number | null;
  durationS: number | null;
  thumbnail: Blob | null;
}

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

/** PUTs a file to a Supabase signed upload URL, reporting progress. */
function putToSignedUrl(url: string, body: Blob, onProgress: (fraction: number) => void, register: (xhr: XMLHttpRequest) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", body.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (${xhr.status})`;
      try {
        message = JSON.parse(xhr.responseText).message ?? message;
      } catch {
        // Not JSON.
      }
      reject(new Error(xhr.status === 413 || /maximum allowed size|too large/i.test(message) ? "This file is bigger than your Supabase storage upload limit." : message));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and retry."));
    xhr.onabort = () => reject(new DOMException("Upload canceled", "AbortError"));
    xhr.send(body);
  });
}

export function useMediaUpload() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const current = useRef<XMLHttpRequest | null>(null);

  const cancel = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState({ status: "idle" });
  }, []);

  const upload = useCallback(async (file: File, meta: MediaMeta) => {
    current.current?.abort();
    setState({ status: "uploading", progress: 0 });

    // The server creates the asset and hands back one-time upload links.
    const started = await startUploadAction({ mime: file.type, sizeBytes: file.size, width: meta.width, height: meta.height, durationS: meta.durationS });
    if (!started.ok) return setState({ status: "error", error: started.error });
    const { assetId, uploadUrl, thumbnailPath, thumbnailUploadUrl } = started.data;
    const register = (xhr: XMLHttpRequest) => (current.current = xhr);

    try {
      await putToSignedUrl(uploadUrl, file, (progress) => setState({ status: "uploading", progress }), register);

      let thumbPath: string | null = null;
      if (meta.thumbnail) {
        // Thumbnail is optional; a failure here shouldn't block the post.
        thumbPath = await putToSignedUrl(thumbnailUploadUrl, meta.thumbnail, () => {}, register).then(() => thumbnailPath, () => null);
      }

      const done = await finishUploadAction(assetId, thumbPath);
      if (!done.ok) throw new Error(done.error);
      setState({ status: "done", assetId });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState({ status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      current.current = null;
    }
  }, []);

  return { state, upload, cancel };
}
