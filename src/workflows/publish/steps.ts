import type { Advance, PublishPlan, StepMemo } from "@/lib/posts/publish";

// Steps load the publishing code lazily: the workflow bundle replaces these bodies and has no
// Node.js, so a top-level import would drag Supabase and "server-only" into it.

export async function planStep(postId: string): Promise<PublishPlan> {
  "use step";
  const { planPublish } = await import("@/lib/posts/publish");
  return planPublish(postId);
}

export async function claimStep(targetId: string): Promise<boolean> {
  "use step";
  const { claimTarget } = await import("@/lib/posts/publish");
  return claimTarget(targetId);
}

export async function advanceStep(targetId: string, memo: StepMemo): Promise<Advance> {
  "use step";
  const { advanceTarget } = await import("@/lib/posts/publish");
  return advanceTarget(targetId, memo);
}

export async function failTargetStep(targetId: string, message: string): Promise<void> {
  "use step";
  const { failTarget } = await import("@/lib/posts/publish");
  await failTarget(targetId, message);
}

export async function failPendingStep(postId: string, message: string): Promise<void> {
  "use step";
  const { failPendingTargets } = await import("@/lib/posts/publish");
  await failPendingTargets(postId, message);
}
