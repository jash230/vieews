import { describe, expect, it } from "vitest";
import { CLEANUP_RULES, DAY_MS, isPurgeable, type PostUsage } from "@/lib/media/cleanup";
import { createPostSchema, mediaIdsOf } from "@/lib/posts/schema";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = { accountId: id(9), options: { platform: "instagram", instagram: { format: "post" } } } as const;

describe("createPostSchema", () => {
  it("takes one media id or an ordered list, not both", () => {
    expect(createPostSchema.safeParse({ mediaAssetId: id(1), targets: [target] }).success).toBe(true);
    expect(createPostSchema.safeParse({ mediaAssetIds: [id(1), id(2)], targets: [target] }).success).toBe(true);
    expect(createPostSchema.safeParse({ targets: [target] }).success).toBe(false);
    expect(createPostSchema.safeParse({ mediaAssetId: id(1), mediaAssetIds: [id(2)], targets: [target] }).success).toBe(false);
  });

  it("keeps campaign and meta", () => {
    const parsed = createPostSchema.parse({
      mediaAssetIds: [id(1), id(2)],
      campaign: " ad-studio:myapp ",
      meta: { format: "S1", hook: "Stop doing this" },
      targets: [target],
    });
    expect(parsed.campaign).toBe("ad-studio:myapp");
    expect(parsed.meta).toEqual({ format: "S1", hook: "Stop doing this" });
    expect(mediaIdsOf(parsed)).toEqual([id(1), id(2)]);
  });

  it("caps meta at 16 KB", () => {
    const big = { notes: "x".repeat(17 * 1024) };
    expect(createPostSchema.safeParse({ mediaAssetId: id(1), meta: big, targets: [target] }).success).toBe(false);
  });
});

describe("media cleanup", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  const asset = { id: "a", status: "ready" as const, created_at: ago(30) };
  const post = (status: PostUsage["status"], days: number): PostUsage => ({ status, published_at: status === "published" ? ago(days) : null, updated_at: ago(days) });

  it("keeps files of posts that haven't finished", () => {
    expect(isPurgeable(asset, [post("scheduled", 30)], now)).toBe(false);
    expect(isPurgeable(asset, [post("publishing", 30)], now)).toBe(false);
  });

  it("frees published posts after a few days", () => {
    expect(isPurgeable(asset, [post("published", CLEANUP_RULES.publishedAfterDays - 1)], now)).toBe(false);
    expect(isPurgeable(asset, [post("published", CLEANUP_RULES.publishedAfterDays)], now)).toBe(true);
  });

  it("keeps failed posts long enough to retry", () => {
    expect(isPurgeable(asset, [post("failed", 5)], now)).toBe(false);
    expect(isPurgeable(asset, [post("partial", CLEANUP_RULES.settledAfterDays)], now)).toBe(true);
  });

  it("waits for every post that shares the file", () => {
    expect(isPurgeable(asset, [post("published", 10), post("scheduled", 10)], now)).toBe(false);
  });

  it("frees uploads no post uses", () => {
    expect(isPurgeable({ ...asset, created_at: ago(1) }, [], now)).toBe(false);
    expect(isPurgeable({ ...asset, created_at: ago(CLEANUP_RULES.orphanAfterDays) }, [], now)).toBe(true);
  });
});
