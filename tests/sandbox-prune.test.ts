import { describe, expect, it, vi } from "vitest";

const deleted: string[] = [];
const HOUR = 60 * 60_000;
const NOW = 100 * HOUR;

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    list: async () => ({
      sandboxes: [
        { name: "old-script", createdAt: NOW - 5 * HOUR },
        { name: "clip-stale", createdAt: NOW - 3 * HOUR - 1 },
        { name: "clip-live", createdAt: NOW - 2 * HOUR },
      ],
    }),
    get: async ({ name }: { name: string }) => ({ delete: async () => void deleted.push(name) }),
  },
}));

const { pruneStaleSandboxes } = await import("@/lib/clips/sandbox");

describe("pruneStaleSandboxes", () => {
  it("deletes sandboxes older than 3 hours and keeps newer ones", async () => {
    await pruneStaleSandboxes(NOW);
    expect(deleted.sort()).toEqual(["clip-stale", "old-script"]);
  });
});
