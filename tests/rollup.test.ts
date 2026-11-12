import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}), MEDIA_BUCKET: "media" }));
vi.mock("@/lib/posts/start", () => ({ startPublishPost: vi.fn(), startRetryTarget: vi.fn() }));

const { publishedAtOf, rollupStatus } = await import("@/lib/posts/service");

describe("rollupStatus", () => {
  it("summarizes target statuses", () => {
    expect(rollupStatus(["published", "published"])).toBe("published");
    expect(rollupStatus(["published", "uploading"])).toBe("publishing");
    expect(rollupStatus(["published", "failed"])).toBe("partial");
    expect(rollupStatus(["failed", "failed"])).toBe("failed");
    expect(rollupStatus(["canceled", "canceled"])).toBe("canceled");
    expect(rollupStatus(["published", "canceled"])).toBe("published");
  });
});

describe("publishedAtOf", () => {
  it("is when the last target went out, not when the status was re-derived", () => {
    expect(
      publishedAtOf([
        { status: "published", finished_at: "2026-11-01T10:00:00Z" },
        { status: "published", finished_at: "2026-11-01T10:05:00Z" },
        // A later failure (e.g. a stale upload timing out) doesn't move it.
        { status: "failed", finished_at: "2026-11-01T11:00:00Z" },
      ]),
    ).toBe("2026-11-01T10:05:00Z");
    expect(publishedAtOf([{ status: "failed", finished_at: "2026-11-01T11:00:00Z" }])).toBeNull();
  });
});
