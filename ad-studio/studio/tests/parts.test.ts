import { describe, expect, it } from "vitest";
import { buildCaptions, CAPTION_LIMITS, clip } from "../src/captions";
import { FORMATS, HOOK_PATTERNS } from "../src/catalog";
import { historyFromPosts } from "../src/history";
import { kitProblems, kitSchema, splitFrontmatter } from "../src/kit";
import { adSpecSchema, captionPages, FPS, mediaPaths, totalFrames } from "../src/spec";
import { makeKit } from "./fixtures";

describe("catalog", () => {
  it("only references hook patterns that exist", () => {
    const ids = new Set(HOOK_PATTERNS.map((h) => h.id));
    for (const f of FORMATS) for (const h of f.hooks) expect(ids.has(h), `${f.id} → ${h}`).toBe(true);
  });
});

describe("captions", () => {
  it("builds hook, body, CTA and hashtags", () => {
    const { caption, youtubeTitle } = buildCaptions({ hook: "Stop splitting bills <like this>", body: "there's a 10-second way", cta: "Free on the App Store", hashtags: ["#college", "roommates", "college", "money tips"] });
    expect(caption).toBe("Stop splitting bills <like this>\n\nthere's a 10-second way\n\nFree on the App Store\n\n#college #roommates #moneytips");
    expect(youtubeTitle).toBe("Stop splitting bills like this");
  });

  it("stays inside platform limits", () => {
    const long = buildCaptions({ hook: "word ".repeat(60), body: "x".repeat(3000), cta: "cta", hashtags: Array.from({ length: 20 }, (_, i) => `t${i}`) });
    expect([...long.caption].length).toBeLessThanOrEqual(CAPTION_LIMITS.caption);
    expect([...long.youtubeTitle].length).toBeLessThanOrEqual(CAPTION_LIMITS.youtubeTitle);
    expect(clip("one two three four", 12)).toBe("one two…");
  });
});

describe("history", () => {
  const meta = { studio: "ad-studio", adId: "a1", app: "tally", format: "S1", angle: "x", hookPattern: "list", hook: "h", tone: "funny" };
  it("groups a slideshow's three posts into one ad and ignores other posts", () => {
    const history = historyFromPosts([
      { id: "p3", created_at: "2026-10-30T10:00:02Z", meta: { ...meta, part: "youtube" } },
      { id: "p2", created_at: "2026-10-30T10:00:01Z", meta: { ...meta, part: "instagram" } },
      { id: "p1", created_at: "2026-10-30T10:00:00Z", meta: { ...meta, part: "tiktok" } },
      { id: "manual", created_at: "2026-10-30T11:00:00Z", meta: {} },
    ]);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ adId: "a1", createdAt: "2026-10-30T10:00:00Z", postIds: ["p3", "p2", "p1"] });
  });
});

describe("kit", () => {
  it("parses frontmatter and reports missing files", () => {
    const { data, body } = splitFrontmatter("---\nname: X\n---\nNotes here");
    expect(data).toEqual({ name: "X" });
    expect(body).toBe("Notes here");
    const kit = makeKit();
    expect(kitProblems(kit, () => true)).toEqual([]);
    expect(kitProblems(kit, (p) => p !== "screens/home.png")).toEqual(["Missing screen file media/screens/home.png"]);
    expect(kitProblems({ ...kit, magicMoment: { description: "x", screens: ["screens/nope.png"] } }, () => true)[0]).toMatch(/isn't in screens/);
  });

  it("requires allowed claims", () => {
    expect(kitSchema.safeParse({ ...makeKit(), claims: { allowed: [] } }).success).toBe(false);
  });
});

describe("spec", () => {
  const spec = adSpecSchema.parse({
    id: "tally-1",
    kind: "video",
    scenes: [
      { type: "photo", src: "img/hook.jpg", text: { text: "POV: rent day" } },
      { type: "screen", src: "kit:screens/scan.png", durationS: 2, voice: { src: "vo/2.wav", text: "Snap the receipt", durationS: 3 } },
      { type: "text", background: "#000", text: { text: "done" } },
      { type: "text", background: "kit:screens/split.png", text: { text: "blurred" } },
    ],
  });

  it("lengthens a scene to fit its voiceover", () => {
    expect(totalFrames(spec)).toBe(Math.round(2.5 * FPS) + Math.round(3.35 * FPS) + Math.round(2.5 * FPS) * 2);
  });

  it("lists the media to stage", () => {
    expect(mediaPaths(spec).sort()).toEqual(["img/hook.jpg", "kit:screens/scan.png", "kit:screens/split.png", "vo/2.wav"]);
  });

  it("times caption pages across the voiceover", () => {
    const pages = captionPages("one two three four five", 2);
    expect(pages.map((p) => p.words.join(" "))).toEqual(["one two three", "four five"]);
    expect(pages[1].endS).toBeCloseTo(2);
  });
});
