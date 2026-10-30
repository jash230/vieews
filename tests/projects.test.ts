import { describe, expect, it } from "vitest";
import { emptyKit, kitGaps, projectKitSchema } from "@/lib/projects/kit";
import { slugify, uniqueSlug } from "@/lib/projects/service";

describe("project slugs", () => {
  it("turns names into url-safe slugs", () => {
    expect(slugify("Tally: Split Bills!")).toBe("tally-split-bills");
    expect(slugify("Café Crème")).toBe("cafe-creme");
    expect(slugify("🔥🔥")).toBe("app");
  });

  it("adds a number when the slug is taken", () => {
    expect(uniqueSlug("tally", [])).toBe("tally");
    expect(uniqueSlug("tally", ["tally", "tally-2"])).toBe("tally-3");
  });
});

describe("project kit", () => {
  it("fills every field so a half-finished draft can be saved", () => {
    const kit = projectKitSchema.parse({ oneLiner: "Split receipts" });
    expect(kit.claims).toEqual({ allowed: [], banned: [] });
    expect(kit.magicMoment).toEqual({ description: "", mediaIds: [] });
    expect(kit.brand.font).toBe("tiktok-sans");
  });

  it("rejects brand colors that aren't hex", () => {
    expect(projectKitSchema.safeParse({ brand: { primary: "red" } }).success).toBe(false);
  });

  it("lists what an ad still needs", () => {
    expect(kitGaps(emptyKit(), 0)).toEqual(["one-line pitch", "audience", "pains", "claims ads may make", "call to action", "screenshots"]);
    const done = projectKitSchema.parse({
      oneLiner: "x",
      audience: "y",
      pains: ["z"],
      claims: { allowed: ["Free on iOS"] },
      cta: "Search Tally",
    });
    expect(kitGaps(done, 3)).toEqual([]);
  });
});
