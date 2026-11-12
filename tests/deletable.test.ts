import { describe, expect, it } from "vitest";
import { canDeletePost } from "@/lib/posts/deletable";

const now = Date.parse("2026-11-09T12:00:00Z");
const ago = (min: number) => new Date(now - min * 60_000).toISOString();

describe("canDeletePost", () => {
  it("allows finished posts", () => {
    expect(canDeletePost({ status: "published", updated_at: ago(1) }, now)).toBe(true);
  });

  it("blocks a post that changed recently", () => {
    expect(canDeletePost({ status: "publishing", updated_at: ago(5) }, now)).toBe(false);
  });

  it("blocks a quiet post while an upload is still within its time budget", () => {
    const post = { status: "publishing" as const, updated_at: ago(30), targets: [{ status: "processing" as const, started_at: ago(30) }] };
    expect(canDeletePost(post, now)).toBe(false);
  });

  it("allows a post whose upload has been running longer than any real upload can", () => {
    const post = { status: "publishing" as const, updated_at: ago(90), targets: [{ status: "uploading" as const, started_at: ago(90) }] };
    expect(canDeletePost(post, now)).toBe(true);
  });

  it("allows a stalled post with nothing in flight", () => {
    const post = { status: "publishing" as const, updated_at: ago(30), targets: [{ status: "pending" as const, started_at: null }] };
    expect(canDeletePost(post, now)).toBe(true);
  });
});
