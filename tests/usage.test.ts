import { describe, expect, it } from "vitest";
import { costOf } from "@/lib/ai/models";

describe("costOf", () => {
  it("prices Sonnet 5.5 input, output and cache tokens", () => {
    // 1M input ($2) + 100K output ($1) + 200K cache write ($0.50) + 1M cache read ($0.20)
    const usage = { input_tokens: 1_000_000, output_tokens: 100_000, cache_creation_input_tokens: 200_000, cache_read_input_tokens: 1_000_000 };
    expect(costOf("claude-sonnet-5-5", usage)).toBeCloseTo(3.7, 6);
  });

  it("prices Haiku 5.5 drafts at cents", () => {
    expect(costOf("claude-haiku-5-5", { input_tokens: 20_000, output_tokens: 2_000 })).toBeCloseTo(0.003, 6);
  });

  it("never under-counts an unknown model", () => {
    const usage = { input_tokens: 1000, output_tokens: 1000 };
    expect(costOf("claude-something-new", usage)).toBe(costOf("claude-opus-5-5", usage));
  });
});
