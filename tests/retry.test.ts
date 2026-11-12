import { beforeEach, describe, expect, it, vi } from "vitest";

// post_targets row t1; updates apply only when every eq() filter matches, like Postgres would.
const target = { id: "t1", user_id: "u1", post_id: "p1", status: "failed" };
const post = { id: "p1", user_id: "u1", status: "failed", scheduled_for: null, items: [], media: null, targets: [] };

function from(name: string) {
  const filters: [string, unknown][] = [];
  let patch: Record<string, unknown> | null = null;
  const row = name === "post_targets" ? target : post;
  const matches = () => filters.every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  const q = {
    select: () => q,
    update: (p: Record<string, unknown>) => ((patch = p), q),
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    single: async () => ({ data: matches() ? { ...row } : null, error: null }),
    then: (resolve: (v: unknown) => void) => {
      const hit = matches();
      if (hit && patch) Object.assign(row, patch);
      resolve({ data: hit ? [{ id: row.id }] : [], error: null });
    },
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from }), MEDIA_BUCKET: "media" }));
const startRetryTarget = vi.fn();
vi.mock("@/lib/posts/start", () => ({ startPublishPost: vi.fn(), startRetryTarget }));

const { retryTarget } = await import("@/lib/posts/service");

beforeEach(() => {
  target.status = "failed";
  startRetryTarget.mockReset();
});

describe("retryTarget", () => {
  it("puts a failed target back in line and starts it", async () => {
    await retryTarget("u1", "t1");
    expect(target.status).toBe("pending");
    expect(startRetryTarget).toHaveBeenCalledOnce();
  });

  it("doesn't reset a target a concurrent retry already claimed", async () => {
    // This call reads "failed" synchronously; then the first retry's run claims the target before
    // this call's update lands.
    const run = retryTarget("u1", "t1");
    target.status = "uploading";
    await expect(run).rejects.toThrow("already being retried");
    expect(target.status).toBe("uploading");
    expect(startRetryTarget).not.toHaveBeenCalled();
  });
});
