import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Advance, PublishPlan } from "@/lib/posts/publish";

// Without the Workflow compiler "use workflow" is a no-op, so the orchestration runs as plain code
// against fake steps and a sleep that only records what it was asked to wait for.
const sleeps: unknown[] = [];
vi.mock("workflow", () => ({ sleep: async (d: unknown) => void sleeps.push(d) }));

const steps = vi.hoisted(() => ({
  planStep: vi.fn<(postId: string) => Promise<PublishPlan>>(),
  claimStep: vi.fn<(targetId: string) => Promise<boolean>>(),
  advanceStep: vi.fn<(targetId: string, memo: Record<string, { v: unknown }>) => Promise<Advance>>(),
  failTargetStep: vi.fn<(targetId: string, message: string) => Promise<void>>(),
  failPendingStep: vi.fn<(postId: string, message: string) => Promise<void>>(),
}));
vi.mock("@/workflows/publish/steps", () => steps);

const { publishPostWorkflow, retryTargetWorkflow } = await import("@/workflows/publish");

const go = (...byAccount: string[][]): PublishPlan => ({ kind: "go", byAccount });
const err = (message: string, retryable: boolean): Advance => ({ kind: "error", memo: {}, message, retryable });

beforeEach(() => {
  sleeps.length = 0;
  vi.clearAllMocks();
  steps.claimStep.mockResolvedValue(true);
  steps.advanceStep.mockResolvedValue({ kind: "done", memo: {} });
});

describe("publishPostWorkflow", () => {
  it("sleeps until a scheduled post is due, then publishes it", async () => {
    steps.planStep.mockResolvedValueOnce({ kind: "wait", until: "2026-11-01T09:00:00.000Z" }).mockResolvedValueOnce(go(["t1"]));
    await publishPostWorkflow("p1");
    expect(sleeps).toEqual([new Date("2026-11-01T09:00:00.000Z")]);
    expect(steps.advanceStep).toHaveBeenCalledWith("t1", {});
  });

  it("stops when the post was canceled or deleted", async () => {
    steps.planStep.mockResolvedValue({ kind: "skip" });
    await publishPostWorkflow("p1");
    expect(steps.claimStep).not.toHaveBeenCalled();
  });

  it("does the adapter's sleeps and resumes with them marked done", async () => {
    steps.planStep.mockResolvedValue(go(["t1"]));
    steps.advanceStep
      .mockResolvedValueOnce({ kind: "sleep", memo: { container: { v: "c1" } }, id: "wait-0", duration: "30s" })
      .mockResolvedValueOnce({ kind: "done", memo: {} });
    await publishPostWorkflow("p1");
    expect(sleeps).toEqual(["30s"]);
    expect(steps.advanceStep).toHaveBeenLastCalledWith("t1", { container: { v: "c1" }, "wait-0": { v: true } });
    expect(steps.failTargetStep).not.toHaveBeenCalled();
  });

  it("retries a flaky upload with backoff, then fails it with the last error", async () => {
    steps.planStep.mockResolvedValue(go(["t1"]));
    steps.advanceStep.mockResolvedValue(err("socket hang up", true));
    await publishPostWorkflow("p1");
    expect(sleeps).toEqual(["15s", "30s", "60s"]);
    expect(steps.advanceStep).toHaveBeenCalledTimes(4);
    expect(steps.failTargetStep).toHaveBeenCalledWith("t1", "socket hang up");
  });

  it("fails right away on errors retrying can't fix", async () => {
    steps.planStep.mockResolvedValue(go(["t1"]));
    steps.advanceStep.mockResolvedValue(err("TikTok rejected the post", false));
    await publishPostWorkflow("p1");
    expect(sleeps).toEqual([]);
    expect(steps.failTargetStep).toHaveBeenCalledWith("t1", "TikTok rejected the post");
  });

  it("skips targets another run already claimed", async () => {
    steps.planStep.mockResolvedValue(go(["t1"]));
    steps.claimStep.mockResolvedValue(false);
    await publishPostWorkflow("p1");
    expect(steps.advanceStep).not.toHaveBeenCalled();
  });

  it("posts each account's targets one at a time, accounts side by side", async () => {
    steps.planStep.mockResolvedValue(go(["a1", "a2"], ["b1"]));
    const order: string[] = [];
    steps.advanceStep.mockImplementation(async (id) => {
      order.push(`${id}:start`);
      await new Promise((r) => setTimeout(r, id === "a1" ? 10 : 1));
      order.push(`${id}:end`);
      return { kind: "done", memo: {} };
    });
    await publishPostWorkflow("p1");
    expect(order.indexOf("a1:end")).toBeLessThan(order.indexOf("a2:start"));
    expect(order.indexOf("b1:start")).toBeLessThan(order.indexOf("a1:end"));
  });

  it("fails the pending targets when it can't even plan", async () => {
    steps.planStep.mockRejectedValue(new Error("database is down"));
    await publishPostWorkflow("p1");
    expect(steps.failPendingStep).toHaveBeenCalledWith("p1", "Couldn't start publishing: database is down");
  });

  it("fails a target whose step kept crashing", async () => {
    steps.planStep.mockResolvedValue(go(["t1"]));
    steps.advanceStep.mockRejectedValue(new Error("Step exceeded max retries"));
    await publishPostWorkflow("p1");
    expect(steps.failTargetStep).toHaveBeenCalledWith("t1", "Step exceeded max retries");
  });
});

describe("retryTargetWorkflow", () => {
  it("publishes the one target", async () => {
    await retryTargetWorkflow("t9");
    expect(steps.claimStep).toHaveBeenCalledWith("t9");
    expect(steps.advanceStep).toHaveBeenCalledWith("t9", {});
  });
});
