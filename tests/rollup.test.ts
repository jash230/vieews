import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}), MEDIA_BUCKET: "media" }));
vi.mock("@/lib/posts/start", () => ({ startPublishPost: vi.fn(), startRetryTarget: vi.fn() }));

const { rollupStatus } = await import("@/lib/posts/service");

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
