import { describe, expect, it } from "vitest";
import { validateTarget, type MediaInfo } from "@/lib/platforms/limits";

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

  it("rejects images on YouTube and TikTok", () => {
    expect(validateTarget(photo, "", { platform: "youtube", youtube: { title: "t", privacy: "public" } }).some((i) => i.field === "media")).toBe(true);
    expect(validateTarget(photo, "", { platform: "tiktok", tiktok }).some((i) => i.field === "media")).toBe(true);
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
