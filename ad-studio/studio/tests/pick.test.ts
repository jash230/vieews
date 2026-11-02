import { describe, expect, it } from "vitest";
import { FORMATS, NEURONS_PER_IMAGE } from "../src/catalog";
import { comboKey, formatsFor, median, neuronsUsedToday, pick, winnersOf } from "../src/pick";
import { entry, makeKit } from "./fixtures";

const now = new Date("2026-10-30T15:00:00Z");
const base = { kit: makeKit(), history: [], now, seed: 7, neuronsLeft: 9000 };

describe("pick", () => {
  it("is deterministic for a seed", () => {
    expect(pick(base)).toEqual(pick(base));
    expect(pick({ ...base, seed: 8 }).candidates.map((c) => c.format)).not.toEqual([]);
  });

  it("only offers formats the kit can make", () => {
    const formats = formatsFor(makeKit(), 9000).map((f) => f.id);
    expect(formats).not.toContain("S2"); // needs a visible before/after
    expect(formatsFor(makeKit({ beforeAfter: true }), 9000).map((f) => f.id)).toContain("S2");
    expect(formatsFor(makeKit({ formats: { deny: ["V2"], weights: {} } }), 9000).map((f) => f.id)).not.toContain("V2");
    const oneScreen = makeKit({ screens: [makeKit().screens[0]], magicMoment: { description: "x", screens: ["screens/scan.png"] } });
    expect(formatsFor(oneScreen, 9000).every((f) => f.needs.screens <= 1)).toBe(true);
  });

  it("drops formats that need AI images when the free image budget is gone", () => {
    const formats = formatsFor(makeKit(), NEURONS_PER_IMAGE - 1);
    expect(formats.length).toBeGreaterThan(0);
    expect(formats.every((f) => f.needs.aiImages === 0)).toBe(true);
  });

  it("never repeats the last format", () => {
    for (const format of ["V1", "S1", "S3"]) {
      const result = pick({ ...base, history: [entry({ format })] });
      expect(result.candidates.map((c) => c.format)).not.toContain(format);
    }
  });

  it("favors formats this app hasn't tried yet", () => {
    const tried = FORMATS.filter((f) => f.id !== "S3").map((f, i) => entry({ format: f.id, angle: `a${i}` }));
    const result = pick({ ...base, history: tried, seed: 3 });
    expect(result.candidates[0].format).toBe("S3");
    expect(result.candidates[0].why).toContain("not tried for this app yet");
  });

  it("skips a format × angle × hook pattern × tone used in the last 30 days", () => {
    const kit = makeKit({ pains: ["only pain"], desires: ["money"] });
    const used = ["funny", "earnest", "dramatic", "aesthetic", "blunt"].flatMap((tone) =>
      ["only pain", "money"].map((angle) => entry({ format: "S3", angle, hookPattern: "relatable-story", tone, createdAt: "2026-10-20T10:00:00Z" })),
    );
    const result = pick({ ...base, kit, history: [entry({ format: "V1" }), ...used] });
    const s3 = result.candidates.find((c) => c.format === "S3");
    if (s3) expect(s3.hookPattern).not.toBe("relatable-story");
    const keys = new Set(used.map(comboKey));
    expect(result.candidates.every((c) => !keys.has(comboKey(c)))).toBe(true);
  });

  it("rotates to the least recently used angle", () => {
    const history = [entry({ format: "S1", angle: "chasing roommates for money" }), entry({ format: "S5", angle: "awkward bill splitting at dinner" })];
    const result = pick({ ...base, history });
    expect(["forgetting who paid", "belonging", "money"]).toContain(result.candidates[0].angle);
  });

  it("lists every used hook so the writer avoids them", () => {
    const result = pick({ ...base, history: [entry({ hook: "Stop splitting bills like this" })] });
    expect(result.usedHooks).toContain("Stop splitting bills like this");
  });

  it("counts today's ads in the app's time zone", () => {
    const history = [entry({ createdAt: "2026-10-30T03:00:00Z" }), entry({ createdAt: "2026-10-30T14:00:00Z" })];
    expect(pick({ ...base, history, timeZone: "UTC" }).adsToday).toBe(2);
    expect(pick({ ...base, history, timeZone: "America/Los_Angeles" }).adsToday).toBe(1);
  });

  it("exploits a winner: same format and hook pattern, new angle", () => {
    const history = [
      entry({ format: "S3", metrics: { views: 1000 } }),
      ...Array.from({ length: 5 }, () => entry({ format: "V2", metrics: { views: 900 } })),
      entry({ adId: "winner", format: "S1", hookPattern: "warning-flip", angle: "forgetting who paid", metrics: { views: 50_000, likes: 3000 } }),
    ];
    const exploits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => pick({ ...base, history, seed }).candidates.find((c) => c.mode === "exploit"));
    const found = exploits.filter(Boolean);
    expect(found.length).toBeGreaterThan(3); // ~70% of runs
    for (const c of found) {
      expect(c).toMatchObject({ format: "S1", hookPattern: "warning-flip", variantOf: "winner" });
    }
  });
});

describe("winners", () => {
  it("needs 3× the median, or 10K views with 3% engagement", () => {
    const history = [
      ...[100, 120, 90, 110, 100].map((views) => entry({ metrics: { views } })),
      entry({ adId: "big", metrics: { views: 400 } }),
      entry({ adId: "viral-but-dead", metrics: { views: 12_000, likes: 10 } }),
    ];
    expect(median([1, 3, 2])).toBe(2);
    const ids = winnersOf(history).map((w) => w.adId);
    expect(ids).toContain("big");
    expect(ids).toContain("viral-but-dead"); // 3× median (110) still applies
    expect(winnersOf([entry({ metrics: { views: 12_000, likes: 10 } })])).toHaveLength(0);
    expect(winnersOf([entry({ metrics: { views: 12_000, likes: 500 } })])).toHaveLength(1);
  });

  it("totals neurons spent today across apps (UTC)", () => {
    const history = [entry({ neurons: 300, createdAt: "2026-10-30T01:00:00Z" }), entry({ app: "other", neurons: 200, createdAt: "2026-10-30T09:00:00Z" }), entry({ neurons: 999, createdAt: "2026-10-29T23:00:00Z" })];
    expect(neuronsUsedToday(history, now)).toBe(500);
  });
});
