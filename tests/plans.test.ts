import { describe, expect, it } from "vitest";
import { limitMessage, planFromItems } from "@/lib/billing/plans";

const item = (slug: string, status: string, periodEnd: number | null = null) => ({ status, periodEnd, plan: { slug } });

describe("planFromItems", () => {
  const now = 1_000_000;

  it("is free with no paid plan", () => {
    expect(planFromItems([], now)).toBe("free");
    expect(planFromItems([item("free_user", "active")], now)).toBe("free");
  });

  it("picks the best live paid plan", () => {
    expect(planFromItems([item("pro", "active")], now)).toBe("pro");
    expect(planFromItems([item("pro", "active"), item("max", "upcoming")], now)).toBe("pro");
    expect(planFromItems([item("pro", "ended"), item("max", "active")], now)).toBe("max");
  });

  it("keeps a canceled plan until its paid period ends", () => {
    expect(planFromItems([item("max", "canceled", now + 1)], now)).toBe("max");
    expect(planFromItems([item("max", "canceled", now - 1)], now)).toBe("free");
    expect(planFromItems([item("pro", "past_due")], now)).toBe("free");
  });
});

describe("limitMessage", () => {
  it("asks free users to pick a plan before clipping", () => {
    expect(limitMessage("free", "clips")).toMatch(/needs a plan/);
  });

  it("offers the next plan up, except on Max", () => {
    expect(limitMessage("pro", "uploads")).toMatch(/5 uploads on the Pro plan\. Upgrade to Max/);
    expect(limitMessage("max", "clips")).not.toMatch(/Upgrade/);
  });
});
