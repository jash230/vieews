import "server-only";
import { costOf, type TokenUsage } from "@/lib/ai/models";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UsageKind = "llm" | "image" | "video" | "render" | "tts";

export interface UsageEvent {
  userId: string;
  projectId?: string | null;
  kind: UsageKind;
  provider: string;
  model?: string | null;
  units: number;
  costUsd: number;
  /** What it was for, e.g. "copilot" or "draft-kit". */
  ref?: string | null;
}

/** Writes one row to the ledger. Never throws: losing a row must not break the user's action. */
export async function recordUsage(e: UsageEvent): Promise<void> {
  const { error } = await supabaseAdmin().from("usage_events").insert({
    user_id: e.userId,
    project_id: e.projectId ?? null,
    kind: e.kind,
    provider: e.provider,
    model: e.model ?? null,
    units: e.units,
    cost_usd: Number(e.costUsd.toFixed(6)),
    ref: e.ref ?? null,
  });
  if (error) console.error("recordUsage failed", error);
}

/** Records one Claude response; units are total tokens. */
export function recordClaudeUsage(userId: string, projectId: string | null, model: string, usage: TokenUsage, ref: string) {
  const units = usage.input_tokens + usage.output_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return recordUsage({ userId, projectId, kind: "llm", provider: "anthropic", model, units, costUsd: costOf(model, usage), ref });
}

export interface UsageSummary {
  totalUsd: number;
  byKind: Partial<Record<UsageKind, number>>;
}

export async function usageSummary(userId: string, since: Date): Promise<UsageSummary> {
  const { data, error } = await supabaseAdmin()
    .from("usage_events")
    .select("kind, cost_usd")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  const byKind: UsageSummary["byKind"] = {};
  let totalUsd = 0;
  for (const row of data ?? []) {
    const cost = Number(row.cost_usd);
    totalUsd += cost;
    byKind[row.kind as UsageKind] = (byKind[row.kind as UsageKind] ?? 0) + cost;
  }
  return { totalUsd, byKind };
}
