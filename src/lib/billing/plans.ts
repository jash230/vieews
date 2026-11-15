import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Subscriptions run on Clerk Billing. The paid plans are created in the Clerk dashboard with these slugs;
// everyone without one is on Free.

/** Daily limits, over a rolling 24 hours. An upload is one post, however many accounts it goes to. */
export const PLANS = {
  free: { name: "Free", uploadsPerDay: 1, clipsPerDay: 0 },
  pro: { name: "Pro", uploadsPerDay: 5, clipsPerDay: 5 }, // $20/month
  max: { name: "Max", uploadsPerDay: 15, clipsPerDay: 15 }, // $50/month
} as const;

export type PlanSlug = keyof typeof PLANS;

/** Usage ref for one post, counted toward the upload limit. */
export const UPLOAD_REF = "upload";

/** Shown in the app when a limit stops an action; the UI offers the plans page. */
export class PlanLimitError extends Error {}

interface SubscriptionItem {
  status: string;
  periodEnd: number | null;
  plan: { slug: string } | null;
}

/** The best paid plan among the items that still give access. Exported for tests. */
export function planFromItems(items: SubscriptionItem[], now = Date.now()): PlanSlug {
  // A canceled plan keeps working until the end of the period that was paid for.
  const live = items.filter((i) => i.status === "active" || (i.status === "canceled" && (i.periodEnd ?? 0) > now));
  const slugs = new Set(live.map((i) => i.plan?.slug));
  return slugs.has("max") ? "max" : slugs.has("pro") ? "pro" : "free";
}

export async function planOf(userId: string): Promise<PlanSlug> {
  try {
    const sub = await (await clerkClient()).billing.getUserBillingSubscription(userId);
    return planFromItems(sub.subscriptionItems);
  } catch (err) {
    // No subscription yet (or Billing isn't switched on): Free.
    if ((err as { status?: number }).status !== 404) console.error("planOf failed", err);
    return "free";
  }
}

const dayAgo = () => new Date(Date.now() - 24 * 60 * 60_000).toISOString();

export async function usedToday(userId: string, what: "clips" | "uploads"): Promise<number> {
  const db = supabaseAdmin();
  // Failed clip jobs don't count: the user got nothing from them. Uploads come from the usage ledger, so deleting a post doesn't refund one.
  const q =
    what === "clips"
      ? db.from("clip_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "failed").gte("created_at", dayAgo())
      : db.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("ref", UPLOAD_REF).gte("created_at", dayAgo());
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export function limitMessage(plan: PlanSlug, what: "clips" | "uploads"): string {
  if (what === "clips" && plan === "free") return "Finding clips needs a plan. Pick one to get your clips.";
  const limit = what === "clips" ? PLANS[plan].clipsPerDay : PLANS[plan].uploadsPerDay;
  const noun = what === "clips" ? `${limit} video${limit === 1 ? "" : "s"} to clip` : `${limit} upload${limit === 1 ? "" : "s"}`;
  const upgrade = plan === "max" ? "" : ` Upgrade to ${plan === "free" ? "Pro" : "Max"} for more, or try`;
  return `You've used today's ${noun} on the ${PLANS[plan].name} plan.${upgrade || " Try"} again once the oldest one is 24 hours old.`;
}

/** Throws PlanLimitError when the user's plan has no room left today. Returns the plan. */
// shortcut: two requests at the same instant can both pass; fine at these volumes, use a DB constraint if it gets abused.
export async function assertWithinPlan(userId: string, what: "clips" | "uploads"): Promise<PlanSlug> {
  const plan = await planOf(userId);
  const limit = what === "clips" ? PLANS[plan].clipsPerDay : PLANS[plan].uploadsPerDay;
  if (limit === 0 || (await usedToday(userId, what)) >= limit) throw new PlanLimitError(limitMessage(plan, what));
  return plan;
}
