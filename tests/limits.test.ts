import { describe, expect, it } from "vitest";
import { validateItems, validateMedia, validateTarget, type MediaInfo } from "@/lib/platforms/limits";

const MB = 1024 * 1024;
const reel: MediaInfo = { kind: "video", mime: "video/mp4", sizeBytes: 40 * MB, width: 1080, height: 1920, durationS: 30 };
const photo: MediaInfo = { kind: "image", mime: "image/jpeg", sizeBytes: 2 * MB, width: 1080, height: 1350 };
const tiktok = { privacyLevel: "SELF_ONLY", disableComment: false, disableDuet: false, disableStitch: false, brandOrganic: false, brandedContent: false };

describe("validateTarget", () => {
  it("accepts a normal vertical reel everywhere", () => {
    expect(validateTarget(reel, "hi #test", { platform: "youtube", youtube: { title: "My short", privacy: "public" } })).toEqual([]);
    expect(validateTarget(reel, "hi", { platform: "instagram", instagram: { format: "reel" } })).toEqual([]);
    expect(validateTarget(reel, "hi", { platform: "tiktok", tiktok })).toEqual([]);
  });

  it("requires a YouTube title without angle brackets", () => {
    expect(validateTarget(reel, "", { platform: "youtube", youtube: { title: " ", privacy: "public" } })[0].field).toBe("title");
    expect(validateTarget(reel, "", { platform: "youtube", youtube: { title: "a<b", privacy: "public" } })[0].message).toMatch(/< or >/);
    expect(validateTarget(reel, "", { platform: "youtube", youtube: { title: "x".repeat(101), privacy: "public" } })[0].message).toMatch(/101\/100/);
  });

  it("rejects images on YouTube; takes JPEG or WebP photos on TikTok", () => {
    expect(validateTarget(photo, "", { platform: "youtube", youtube: { title: "t", privacy: "public" } }).some((i) => i.field === "media")).toBe(true);
    expect(validateTarget(photo, "", { platform: "tiktok", tiktok })).toEqual([]);
    expect(validateTarget({ ...photo, mime: "image/webp" }, "", { platform: "tiktok", tiktok })).toEqual([]);
    expect(validateTarget({ ...photo, mime: "image/png" }, "", { platform: "tiktok", tiktok })[0].message).toMatch(/JPEG or WebP/);
    expect(validateTarget({ ...photo, sizeBytes: 21 * MB }, "", { platform: "tiktok", tiktok })[0].message).toMatch(/20 MB/);
  });

  it("enforces Instagram format, hashtag and JPEG rules", () => {
    expect(validateTarget(photo, "", { platform: "instagram", instagram: { format: "reel" } })[0].message).toMatch(/Reels need a video/);
    expect(validateTarget({ ...photo, mime: "image/png" }, "", { platform: "instagram", instagram: { format: "post" } })[0].message).toMatch(/JPEG/);
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    expect(validateTarget(reel, tags, { platform: "instagram", instagram: { format: "reel" } })[0].message).toMatch(/30 hashtags/);
    expect(validateTarget({ ...photo, width: 1000, height: 2000 }, "", { platform: "instagram", instagram: { format: "post" } })[0].message).toMatch(/4:5/);
  });

  it("limits Instagram stories to 60 seconds", () => {
    expect(validateTarget({ ...reel, durationS: 61 }, "", { platform: "instagram", instagram: { format: "story" } })).toHaveLength(1);
  });

  it("uses the TikTok account's max duration", () => {
    const long = { ...reel, durationS: 200 };
    expect(validateTarget(long, "", { platform: "tiktok", tiktok }, { tiktokMaxDurationS: 180 })[0].message).toMatch(/3 min/);
    expect(validateTarget(long, "", { platform: "tiktok", tiktok }, { tiktokMaxDurationS: 600 })).toEqual([]);
  });

  it("blocks private branded content on TikTok", () => {
    expect(validateTarget(reel, "", { platform: "tiktok", tiktok: { ...tiktok, brandedContent: true } })[0].field).toBe("options");
  });
});

describe("carousels", () => {
  const slides = (n: number, m: Partial<MediaInfo> = {}) => Array.from({ length: n }, () => ({ ...photo, ...m }));
  const igPost = { platform: "instagram", instagram: { format: "post" } } as const;

  it("accepts photo carousels on TikTok and Instagram", () => {
    expect(validateMedia(slides(6), "", { platform: "tiktok", tiktok })).toEqual([]);
    expect(validateMedia(slides(6), "", igPost)).toEqual([]);
  });

  it("enforces per-platform photo counts", () => {
    expect(validateItems(slides(11), igPost)[0].message).toMatch(/2–10 photos/);
    expect(validateItems(slides(36), { platform: "tiktok", tiktok })[0].message).toMatch(/35 photos/);
    expect(validateItems(slides(1), igPost)).toEqual([]);
  });

  it("rejects mixed media, YouTube carousels and non-post Instagram formats", () => {
    expect(validateItems([photo, reel], { platform: "tiktok", tiktok })[0].message).toMatch(/only contain photos/);
    expect(validateItems(slides(3), { platform: "youtube", youtube: { title: "t", privacy: "public" } })[0].message).toMatch(/YouTube/);
    expect(validateItems(slides(3), { platform: "instagram", instagram: { format: "story" } })[0].message).toMatch(/as a Post/);
  });

  it("reports a problem shared by every slide once", () => {
    const issues = validateMedia(slides(5, { mime: "image/png" }), "", igPost);
    expect(issues.filter((i) => /JPEG/.test(i.message))).toHaveLength(1);
  });
});
