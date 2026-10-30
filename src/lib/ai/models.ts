// Models Vieews calls and what they cost, in USD per million tokens (Anthropic first-party rates).
// Cache writes use the 5-minute TTL (1.25x input); cache reads are 0.1x input.

export const MODELS = {
  /** The copilot: tool use across a whole conversation. */
  copilot: "claude-sonnet-5-5",
  /** One-shot extraction, e.g. drafting a project from a store listing. */
  draft: "claude-haiku-5-5",
} as const;

interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  // Haiku 5.5's rates double past 100K prompt tokens; Vieews' prompts stay well under that.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Cost of one response in USD. Unknown models are priced as Opus so they never under-count. */
export function costOf(model: string, usage: TokenUsage): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead) /
    1_000_000
  );
}
