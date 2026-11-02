import { describe, expect, it } from "vitest";
import { bucketByDay, monthRange, monthWeeks, parseMonth } from "@/lib/posts/calendar";

// Built from local times so the tests pass in any time zone.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const post = (id: string, scheduled: string | null, created = local(2026, 10, 1)) => ({ id, scheduled_for: scheduled, created_at: created });

describe("posts calendar", () => {
  it("parses ?month= and falls back to the current month", () => {
    const now = new Date(2026, 9, 30, 15);
    expect(parseMonth("2026-11", now)).toEqual(new Date(2026, 10, 1));
    expect(parseMonth("nope", now)).toEqual(new Date(2026, 9, 1));
    expect(parseMonth(undefined, now)).toEqual(new Date(2026, 9, 1));
  });

  it("covers the month in whole weeks", () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    const sunday = monthWeeks(new Date(2026, 10, 1), 0);
    expect(sunday[0][0].key).toBe("2026-11-01");
    expect(sunday.at(-1)!.at(-1)!.key).toBe("2026-12-05");
    expect(sunday.every((w) => w.length === 7)).toBe(true);

    const monday = monthWeeks(new Date(2026, 10, 1), 1);
    expect(monday[0][0]).toMatchObject({ key: "2026-10-26", inMonth: false });
    expect(monday[0][6]).toMatchObject({ key: "2026-11-01", inMonth: true });

    // February 2026 starts on a Sunday and has 28 days: exactly four rows.
    expect(monthWeeks(new Date(2026, 1, 1), 0)).toHaveLength(4);
  });

  it("pads the query range a day past both ends of the grid", () => {
    const { from, to } = monthRange(new Date(2026, 10, 1), 0);
    expect(new Date(from)).toEqual(new Date(2026, 9, 31));
    expect(new Date(to)).toEqual(new Date(2026, 11, 7));
  });

  it("buckets posts by local day, earliest first, scheduled time over creation time", () => {
    const days = bucketByDay([
      post("late", local(2026, 11, 3, 18)),
      post("early", local(2026, 11, 3, 9)),
      post("now", null, local(2026, 11, 4, 10)),
      post("night", local(2026, 11, 4, 23), local(2026, 11, 2)),
    ]);
    expect(days.get("2026-11-03")!.map((p) => p.id)).toEqual(["early", "late"]);
    expect(days.get("2026-11-04")!.map((p) => p.id)).toEqual(["now", "night"]);
    expect(days.has("2026-11-02")).toBe(false);
  });
});
