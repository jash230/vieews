import "server-only";
import { costOf, type TokenUsage } from "@/lib/ai/models";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UsageKind = "llm" | "image" | "video" | "render" | "tts" | "transcribe";

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

/** Most one account may spend on AI in any 24 hours. Haiku turns cost well under a cent, so this is hundreds of messages. */
export const DAILY_AI_BUDGET_USD = 0.5;

/** Usage refs that belong to clipping, which has its own budget. */
export const CLIP_REF_PREFIX = "clip";

/** Clipping cost allowed per video the plan includes (sandbox, transcription, AI). A 2-hour video costs about $0.80. */
export const CLIP_USD_PER_VIDEO = 1;

/** True once the account has used up its AI budget for the last 24 hours. Clipping doesn't count toward it. */
export async function aiBudgetSpent(userId: string, limitUsd = DAILY_AI_BUDGET_USD, now = new Date()): Promise<boolean> {
  const { totalUsd } = await usageSummary(userId, new Date(now.getTime() - 24 * 60 * 60_000), { excludeRefPrefix: CLIP_REF_PREFIX });
  return totalUsd >= limitUsd;
}

/** True once the account has spent `limitUsd` on clipping in the last 24 hours. */
export async function clipBudgetSpent(userId: string, limitUsd: number, now = new Date()): Promise<boolean> {
  const { totalUsd } = await usageSummary(userId, new Date(now.getTime() - 24 * 60 * 60_000), { refPrefix: CLIP_REF_PREFIX });
  return totalUsd >= limitUsd;
}

export interface UsageSummary {
  totalUsd: number;
  byKind: Partial<Record<UsageKind, number>>;
}

export async function usageSummary(
  userId: string,
  since: Date,
  filter: { refPrefix?: string; excludeRefPrefix?: string } = {},
): Promise<UsageSummary> {
  const { data, error } = await supabaseAdmin()
    .from("usage_events")
    .select("kind, cost_usd, ref")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  const byKind: UsageSummary["byKind"] = {};
  let totalUsd = 0;
  for (const row of data ?? []) {
    const ref = typeof row.ref === "string" ? row.ref : "";
    if (filter.refPrefix && !ref.startsWith(filter.refPrefix)) continue;
    if (filter.excludeRefPrefix && ref.startsWith(filter.excludeRefPrefix)) continue;
    const cost = Number(row.cost_usd);
    totalUsd += cost;
    byKind[row.kind as UsageKind] = (byKind[row.kind as UsageKind] ?? 0) + cost;
  }
  return { totalUsd, byKind };
}
