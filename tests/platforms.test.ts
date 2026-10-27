import { afterEach, describe, expect, it, vi } from "vitest";
import { instagram } from "@/lib/platforms/instagram";
import { chunkRange, tiktok, tiktokChunkPlan } from "@/lib/platforms/tiktok";
import { nextOffset, youtube, YT_CHUNK_BYTES } from "@/lib/platforms/youtube";
import { fakeCtx, json, mockFetch, rangeHandler } from "./helpers";

const MB = 1024 * 1024;
afterEach(() => vi.unstubAllGlobals());

describe("YouTube", () => {
  it("parses resumable Range headers", () => {
    expect(nextOffset("bytes=0-8388607")).toBe(8388608);
    expect(nextOffset(null)).toBe(0);
  });

  it("opens a resumable session and uploads in 256 KiB-aligned chunks", async () => {
    expect(YT_CHUNK_BYTES % (256 * 1024)).toBe(0);
    const size = YT_CHUNK_BYTES * 2 + 123;
    let received = 0;
    const calls = mockFetch([
      [/uploadType=resumable/, () => new Response(null, { status: 200, headers: { location: "https://upload.example/session" } })],
      [/storage\.example/, rangeHandler(size)],
      [
        /upload\.example\/session/,
        (_u, init) => {
          const range = new Headers(init.headers).get("content-range")!;
          if (range.startsWith("bytes */")) return new Response(null, { status: 308 });
          received += (init.body as ArrayBuffer).byteLength;
          if (received < size) return new Response(null, { status: 308, headers: { range: `bytes=0-${received - 1}` } });
          return json({ id: "vid123" });
        },
      ],
    ]);
    const { ctx, steps, statuses } = fakeCtx({ media: { size_bytes: size }, options: { platform: "youtube", youtube: { title: "Hello", privacy: "unlisted" } } });
    const result = await youtube.publish(ctx);

    expect(result).toEqual({ remoteId: "vid123", remoteUrl: "https://www.youtube.com/watch?v=vid123" });
    expect(steps).toEqual(["youtube-init", "youtube-upload"]);
    expect(statuses).toEqual(["uploading"]);
    expect(received).toBe(size);
    const init = JSON.parse(String(calls[0].init.body));
    expect(init.snippet.title).toBe("Hello");
    expect(init.status.privacyStatus).toBe("unlisted");
    const puts = calls.filter((c) => c.url.includes("session") && c.init.method === "PUT").map((c) => new Headers(c.init.headers).get("content-range"));
    expect(puts).toEqual([`bytes */${size}`, `bytes 0-${YT_CHUNK_BYTES - 1}/${size}`, `bytes ${YT_CHUNK_BYTES}-${2 * YT_CHUNK_BYTES - 1}/${size}`, `bytes ${2 * YT_CHUNK_BYTES}-${size - 1}/${size}`]);
  });

  it("resumes from where YouTube says it is", async () => {
    const size = YT_CHUNK_BYTES + 10;
    const calls = mockFetch([
      [/uploadType=resumable/, () => new Response(null, { headers: { location: "https://upload.example/s" } })],
      [/storage\.example/, rangeHandler(size)],
      [/upload\.example\/s/, (_u, init) => (new Headers(init.headers).get("content-range")!.startsWith("bytes */") ? new Response(null, { status: 308, headers: { range: `bytes=0-${YT_CHUNK_BYTES - 1}` } }) : json({ id: "v" }))],
    ]);
    const { ctx } = fakeCtx({ media: { size_bytes: size }, options: { platform: "youtube", youtube: { title: "t", privacy: "public" } } });
    await youtube.publish(ctx);
    const ranges = calls.filter((c) => c.url.includes("upload.example") && c.init.method === "PUT").map((c) => new Headers(c.init.headers).get("content-range"));
    expect(ranges).toEqual([`bytes */${size}`, `bytes ${YT_CHUNK_BYTES}-${size - 1}/${size}`]);
  });
});

describe("Instagram", () => {
  it("creates a reel container, waits for processing, then publishes", async () => {
    let checks = 0;
    const calls = mockFetch([
      [(u, i) => u.endsWith("/17841/media") && i.method === "POST", () => json({ id: "container1" })],
      [/container1\?/, () => json({ status_code: ++checks < 3 ? "IN_PROGRESS" : "FINISHED" })],
      [/media_publish/, () => json({ id: "media9" })],
      [/media9\?/, () => json({ permalink: "https://www.instagram.com/reel/abc/" })],
    ]);
    const { ctx, steps } = fakeCtx({ options: { platform: "instagram", instagram: { format: "reel", shareToFeed: false } }, caption: "new reel" });
    const result = await instagram.publish(ctx);

    expect(result).toEqual({ remoteId: "media9", remoteUrl: "https://www.instagram.com/reel/abc/" });
    const body = new URLSearchParams(String(calls[0].init.body));
    expect(Object.fromEntries(body)).toMatchObject({ media_type: "REELS", video_url: "https://storage.example/media.mp4", caption: "new reel", share_to_feed: "false" });
    expect(steps).toEqual(["instagram-container", "instagram-status-0", "instagram-wait-0", "instagram-status-1", "instagram-wait-1", "instagram-status-2", "instagram-publish"]);
  });

  it("sends stories without a caption", async () => {
    const calls = mockFetch([
      [(u, i) => u.endsWith("/media") && i.method === "POST", () => json({ id: "c" })],
      [/\/c\?/, () => json({ status_code: "FINISHED" })],
      [/media_publish/, () => json({ id: "m" })],
      [/\/m\?/, () => json({})],
    ]);
    const { ctx } = fakeCtx({ media: { kind: "image", mime: "image/jpeg" }, options: { platform: "instagram", instagram: { format: "story" } } });
    await instagram.publish(ctx);
    const body = Object.fromEntries(new URLSearchParams(String(calls[0].init.body)));
    expect(body.media_type).toBe("STORIES");
    expect(body.image_url).toBeDefined();
    expect(body.caption).toBeUndefined();
  });

  it("fails without retry when processing errors", async () => {
    mockFetch([
      [(u, i) => u.endsWith("/media") && i.method === "POST", () => json({ id: "c" })],
      [/\/c\?/, () => json({ status_code: "ERROR", status: "Unsupported codec" })],
    ]);
    const { ctx } = fakeCtx({ options: { platform: "instagram", instagram: { format: "reel" } } });
    await expect(instagram.publish(ctx)).rejects.toMatchObject({ message: expect.stringMatching(/Unsupported codec/), opts: { retryable: false } });
  });
});

describe("TikTok", () => {
  it("plans chunks within TikTok's rules", () => {
    expect(tiktokChunkPlan(3 * MB)).toEqual({ chunkSize: 3 * MB, totalChunks: 1 });
    expect(tiktokChunkPlan(25 * MB)).toEqual({ chunkSize: 10 * MB, totalChunks: 2 });
    const plan = tiktokChunkPlan(25 * MB);
    expect(chunkRange(1, plan, 25 * MB)).toEqual({ start: 10 * MB, end: 25 * MB - 1 }); // last chunk takes the remainder
    expect(tiktokChunkPlan(7 * MB)).toEqual({ chunkSize: 10 * MB, totalChunks: 1 });
  });

  const creator = { creator_username: "zaza", creator_nickname: "Zaza", privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"], comment_disabled: true, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 600 };
  const ok = (data: unknown) => json({ data, error: { code: "ok", message: "" } });
  const opts = { privacyLevel: "SELF_ONLY", disableComment: false, disableDuet: true, disableStitch: false, brandOrganic: false, brandedContent: false };

  it("checks creator info, uploads chunks and polls until published", async () => {
    const size = 12 * MB;
    let polls = 0;
    const calls = mockFetch([
      [/creator_info/, () => ok(creator)],
      [/video\/init/, () => ok({ publish_id: "p1", upload_url: "https://tt-upload.example/u" })],
      [/storage\.example/, rangeHandler(size)],
      [/tt-upload\.example/, () => new Response(null, { status: 201 })],
      [/status\/fetch/, () => ok(++polls < 2 ? { status: "PROCESSING_UPLOAD" } : { status: "PUBLISH_COMPLETE", publicaly_available_post_id: [7300] })],
    ]);
    const { ctx, statuses } = fakeCtx({ media: { size_bytes: size }, options: { platform: "tiktok", tiktok: opts }, caption: "tt caption" });
    const result = await tiktok.publish(ctx);

    expect(result).toEqual({ remoteId: "7300", remoteUrl: "https://www.tiktok.com/@zaza/video/7300" });
    expect(statuses).toEqual(["uploading", "processing"]);
    const init = JSON.parse(String(calls.find((c) => c.url.includes("video/init"))!.init.body));
    expect(init.post_info).toMatchObject({ title: "tt caption", privacy_level: "SELF_ONLY", disable_comment: true, disable_duet: true });
    expect(init.source_info).toEqual({ source: "FILE_UPLOAD", video_size: size, chunk_size: 10 * MB, total_chunk_count: 1 });
    const put = calls.find((c) => c.url.includes("tt-upload"))!;
    expect(new Headers(put.init.headers).get("content-range")).toBe(`bytes 0-${size - 1}/${size}`);
  });

  it("refuses a privacy level the account no longer offers", async () => {
    mockFetch([[/creator_info/, () => ok({ ...creator, privacy_level_options: ["SELF_ONLY"] })]]);
    const { ctx } = fakeCtx({ options: { platform: "tiktok", tiktok: { ...opts, privacyLevel: "PUBLIC_TO_EVERYONE" } } });
    await expect(tiktok.publish(ctx)).rejects.toMatchObject({ opts: { retryable: false } });
  });
});
