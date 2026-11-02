import { describe, expect, it, vi } from "vitest";

// One post_targets row; update() only applies when every eq() filter matches, like Postgres would.
const row = { id: "t1", status: "pending", attempts: 0 };
function table() {
  const filters: [string, unknown][] = [];
  let patch: Record<string, unknown> | null = null;
  const matches = () => filters.every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  const q = {
    select: () => q,
    update: (p: Record<string, unknown>) => ((patch = p), q),
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    single: async () => ({ data: matches() ? { ...row } : null }),
    then: (resolve: (v: unknown) => void) => {
      const hit = matches();
      if (hit && patch) Object.assign(row, patch);
      resolve({ data: hit ? [{ id: row.id }] : [] });
    },
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: table }), MEDIA_BUCKET: "media" }));
vi.mock("@/lib/posts/start", () => ({ startPublishPost: vi.fn(), startRetryTarget: vi.fn() }));

const { claimTarget, isStaleTarget, needsRestart, NonRetriableError, replaySteps } = await import("@/lib/posts/publish");
type StepRunner = import("@/lib/posts/publish").StepRunner;

describe("claimTarget", () => {
  it("lets exactly one publisher claim a pending target", async () => {
    expect(await claimTarget("t1")).toBe(true);
    expect(row).toMatchObject({ status: "uploading", attempts: 1 });
    expect(await claimTarget("t1")).toBe(false);
  });
});

describe("replaySteps", () => {
  // Shaped like the Instagram adapter: create, then poll with sleeps in between, then publish.
  const calls: string[] = [];
  const statuses = ["IN_PROGRESS", "FINISHED"];
  const adapter = async (steps: StepRunner) => {
    const container = await steps.run("container", async () => (calls.push("container"), "c1"));
    for (let i = 0; ; i++) {
      const status = await steps.run(`status-${i}`, async () => (calls.push(`status-${i}`), statuses[i]));
      if (status === "FINISHED") break;
      await steps.sleep(`wait-${i}`, "30s");
    }
    return steps.run("publish", async () => (calls.push("publish"), `${container}-live`));
  };

  it("stops at each unfinished sleep and never redoes a finished step", async () => {
    calls.length = 0;
    const first = await replaySteps({}, adapter);
    expect(first).toMatchObject({ kind: "sleep", id: "wait-0", duration: "30s" });
    expect(calls).toEqual(["container", "status-0"]);

    // The workflow sleeps, marks the sleep done and calls again with the memo.
    const second = await replaySteps({ ...first.memo, "wait-0": { v: true } }, adapter);
    expect(second.kind).toBe("done");
    expect(calls).toEqual(["container", "status-0", "status-1", "publish"]);
  });

  it("returns failures as data, keeping what already finished", async () => {
    let tries = 0;
    const flaky = async (steps: StepRunner) => {
      await steps.run("init", async () => "ok");
      await steps.run("upload", async () => {
        if (++tries === 1) throw new Error("socket hang up");
      });
    };
    const failed = await replaySteps({}, flaky);
    expect(failed).toMatchObject({ kind: "error", message: "socket hang up", retryable: true });
    expect(failed.memo).toEqual({ init: { v: "ok" } });
    expect((await replaySteps(failed.memo, flaky)).kind).toBe("done");
  });

  it("marks errors retrying can't fix", async () => {
    const res = await replaySteps({}, async () => {
      throw new NonRetriableError("Media was deleted");
    });
    expect(res).toMatchObject({ kind: "error", retryable: false });
  });
});

const now = new Date("2026-10-31T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

describe("isStaleTarget", () => {
  it("flags uploads that were killed mid-publish, not ones still running", () => {
    expect(isStaleTarget({ status: "uploading", started_at: ago(61) }, now)).toBe(true);
    expect(isStaleTarget({ status: "processing", started_at: ago(61) }, now)).toBe(true);
    expect(isStaleTarget({ status: "processing", started_at: ago(20) }, now)).toBe(false);
    expect(isStaleTarget({ status: "published", started_at: ago(600) }, now)).toBe(false);
  });
});

describe("needsRestart", () => {
  const pending = [{ status: "pending" as const }];
  it("restarts scheduled posts long past due", () => {
    expect(needsRestart({ status: "scheduled", scheduled_for: ago(11), updated_at: ago(600), targets: pending }, now)).toBe(true);
    expect(needsRestart({ status: "scheduled", scheduled_for: ago(2), updated_at: ago(600), targets: pending }, now)).toBe(false);
  });
  it("restarts publishing posts nobody picked up", () => {
    expect(needsRestart({ status: "publishing", scheduled_for: null, updated_at: ago(11), targets: pending }, now)).toBe(true);
    expect(needsRestart({ status: "publishing", scheduled_for: null, updated_at: ago(1), targets: pending }, now)).toBe(false);
  });
  it("waits while another target of the post is still uploading", () => {
    expect(needsRestart({ status: "publishing", scheduled_for: null, updated_at: ago(30), targets: [{ status: "processing" }, ...pending] }, now)).toBe(false);
  });
  it("leaves posts with nothing pending alone", () => {
    expect(needsRestart({ status: "publishing", scheduled_for: null, updated_at: ago(60), targets: [{ status: "uploading" }] }, now)).toBe(false);
  });
});
