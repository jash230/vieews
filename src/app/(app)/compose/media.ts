"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** Creates the asset, uploads the file (and optional thumbnail), and marks it ready. Returns the asset id. */
async function uploadOne(file: File, meta: MediaMeta, onProgress: (fraction: number) => void, register: (xhr: XMLHttpRequest) => void) {
  // The server creates the asset and hands back one-time upload links.
  const started = await startUploadAction({ mime: file.type, sizeBytes: file.size, width: meta.width, height: meta.height, durationS: meta.durationS });
  if (!started.ok) throw new Error(started.error);
  const { assetId, uploadUrl, thumbnailPath, thumbnailUploadUrl } = started.data;

  await putToSignedUrl(uploadUrl, file, onProgress, register);

  let thumbPath: string | null = null;
  if (meta.thumbnail) {
    // Thumbnail is optional; a failure here shouldn't block the post.
    thumbPath = await putToSignedUrl(thumbnailUploadUrl, meta.thumbnail, () => {}, register).then(() => thumbnailPath, () => null);
  }

  const done = await finishUploadAction(assetId, thumbPath);
  if (!done.ok) throw new Error(done.error);
  return assetId;
}

export interface UploadItem {
  key: string;
  file: File;
  previewUrl: string;
  meta: MediaMeta;
  state: UploadState;
}

/** Uploads several files at once (a video, or the photos of a carousel), keeping their order. */
export function useMediaUploads() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
  const previewUrls = useRef(new Set<string>());

  // Stop uploads and free previews when the composer goes away.
  useEffect(() => {
    const open = xhrs.current;
    const urls = previewUrls.current;
    return () => {
      for (const xhr of open.values()) xhr.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const setState = useCallback((key: string, state: UploadState) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, state } : i)));
  }, []);

  const start = useCallback(
    async (item: Pick<UploadItem, "key" | "file" | "meta">) => {
      setState(item.key, { status: "uploading", progress: 0 });
      try {
        const assetId = await uploadOne(
          item.file,
          item.meta,
          (progress) => setState(item.key, { status: "uploading", progress }),
          (xhr) => xhrs.current.set(item.key, xhr),
        );
        setState(item.key, { status: "done", assetId });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState(item.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
      } finally {
        xhrs.current.delete(item.key);
      }
    },
    [setState],
  );

  const add = useCallback(
    (added: Omit<UploadItem, "state">[]) => {
      for (const i of added) previewUrls.current.add(i.previewUrl);
      setItems((prev) => [...prev, ...added.map((i) => ({ ...i, state: { status: "uploading", progress: 0 } as const }))]);
      for (const item of added) void start(item);
    },
    [start],
  );

  const remove = useCallback((key: string) => {
    xhrs.current.get(key)?.abort();
    setItems((prev) => {
      const gone = prev.find((i) => i.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.previewUrl);
        previewUrls.current.delete(gone.previewUrl);
      }
      return prev.filter((i) => i.key !== key);
    });
  }, []);

  const clear = useCallback(() => {
    for (const xhr of xhrs.current.values()) xhr.abort();
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
    setItems([]);
  }, []);

  /** Moves an item one place earlier (the first photo is the cover). */
  const moveUp = useCallback((key: string) => {
    setItems((prev) => {
      const at = prev.findIndex((i) => i.key === key);
      if (at <= 0) return prev;
      const next = [...prev];
      [next[at - 1], next[at]] = [next[at], next[at - 1]];
      return next;
    });
  }, []);

  const retry = useCallback((item: UploadItem) => void start(item), [start]);

  return { items, add, remove, clear, moveUp, retry };
}
