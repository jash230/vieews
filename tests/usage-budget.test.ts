import { beforeEach, describe, expect, it, vi } from "vitest";

// Rows the ledger returns, and the cutoff the query asked for.
let rows: { kind: string; cost_usd: number | string }[] = [];
let since: string | null = null;
const table = () => {
  const q = {
    select: () => q,
    eq: () => q,
    gte: async (_col: string, value: string) => {
      since = value;
      return { data: rows, error: null };
    },
  };
  return q;
};
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: table }) }));

const { aiBudgetSpent, DAILY_AI_BUDGET_USD } = await import("@/lib/usage/service");

beforeEach(() => {
  rows = [];
  since = null;
});

describe("aiBudgetSpent", () => {
  it("lets an account with no usage through", async () => {
    expect(await aiBudgetSpent("u")).toBe(false);
  });

  it("lets an account under the budget through", async () => {
    rows = [{ kind: "llm", cost_usd: DAILY_AI_BUDGET_USD / 2 }];
    expect(await aiBudgetSpent("u")).toBe(false);
  });

  it("stops an account once its usage adds up to the budget", async () => {
    // Postgres numerics arrive as strings.
    rows = [
      { kind: "llm", cost_usd: String(DAILY_AI_BUDGET_USD / 2) },
      { kind: "llm", cost_usd: String(DAILY_AI_BUDGET_USD / 2) },
    ];
    expect(await aiBudgetSpent("u")).toBe(true);
  });

  it("only counts the last 24 hours", async () => {
    const now = new Date("2026-11-12T12:00:00Z");
    await aiBudgetSpent("u", now);
    expect(since).toBe("2026-11-11T12:00:00.000Z");
  });
});
