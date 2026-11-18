import "server-only";
import { getValidAccessToken } from "@/lib/accounts/service";
import { IG_GRAPH } from "@/lib/platforms/instagram";
import { ttJson } from "@/lib/platforms/tiktok";
import { expectOk, PlatformError } from "@/lib/platforms/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Platform, SocialAccountRow } from "@/lib/types";

/** Lifetime totals for one account; null where the platform doesn't share that number with Vieews. */
export interface AccountStats {
  followers: number | null;
  views: number | null;
  likes: number | null;
  posts: number | null;
}
export type Metric = keyof AccountStats;
export const METRICS: Metric[] = ["followers", "views", "likes", "posts"];

export type StatsProblem = "reauth" | "permission" | "error";

export interface AccountStatsView {
  id: string;
  platform: Platform;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  stats: AccountStats | null;
  problem: StatsProblem | null;
}

const TIMEOUT_MS = 8000;
// YouTube sends counts as strings.
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

/** Reads an account's totals with the scopes it was connected with; null when its token can't read any. */
export const STATS_FETCHERS: Record<Platform, (token: string, scopes: string[]) => Promise<AccountStats | null>> = {
  async youtube(token, scopes) {
    // Channels connected before Vieews asked for youtube.readonly can't read stats until they reconnect.
    if (!scopes.some((s) => s.endsWith("/youtube.readonly"))) return null;
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true", {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const s = (await (await expectOk(res, "YouTube channel stats")).json()).items?.[0]?.statistics ?? {};
    return { followers: s.hiddenSubscriberCount ? null : num(s.subscriberCount), views: num(s.viewCount), likes: null, posts: num(s.videoCount) };
  },
  async instagram(token) {
    // shortcut: views and likes need instagram_business_manage_insights, which Vieews doesn't request; add it once Meta approves it.
    const params = new URLSearchParams({ fields: "followers_count,media_count", access_token: token });
    const res = await fetch(`${IG_GRAPH}/me?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const j = await (await expectOk(res, "Instagram profile stats")).json();
    return { followers: num(j.followers_count), views: null, likes: null, posts: num(j.media_count) };
  },
  async tiktok(token, scopes) {
    // shortcut: needs user.info.stats in the TikTok app and SCOPES; views would also need video.list.
    if (!scopes.includes("user.info.stats")) return null;
    const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count", {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const u = (await ttJson(res, "TikTok user stats")).data?.user ?? {};
    return { followers: num(u.follower_count), views: null, likes: num(u.likes_count), posts: num(u.video_count) };
  },
};

/** Sums each metric over the accounts that report it; null when none do. */
export function totalStats(list: (AccountStats | null)[]): AccountStats {
  const total: AccountStats = { followers: null, views: null, likes: null, posts: null };
  for (const s of list) {
    if (!s) continue;
    for (const m of METRICS) {
      const v = s[m];
      if (v != null) total[m] = (total[m] ?? 0) + v;
    }
  }
  return total;
}

/** Every connected account with its live totals. One failing account never hides the others. */
export async function listAccountStats(userId: string): Promise<AccountStatsView[]> {
  const { data, error } = await supabaseAdmin().from("social_accounts").select("*").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return Promise.all(
    ((data ?? []) as SocialAccountRow[]).map(async (a) => {
      // Only fields safe for the browser: the row also holds the encrypted tokens.
      const view = { id: a.id, platform: a.platform, name: a.display_name ?? a.username ?? "", username: a.username, avatarUrl: a.avatar_url };
      if (a.status === "needs_reauth") return { ...view, stats: null, problem: "reauth" as const };
      try {
        const stats = await STATS_FETCHERS[a.platform](await getValidAccessToken(a), a.scopes ?? []);
        return { ...view, stats, problem: stats ? null : ("permission" as const) };
      } catch (err) {
        console.error(`stats for ${a.platform} account ${a.id}`, err);
        return { ...view, stats: null, problem: err instanceof PlatformError && err.opts.reauth ? ("reauth" as const) : ("error" as const) };
      }
    }),
  );
}

export interface UsageTotals {
  posts: number;
  uploads: number;
  clips: number;
  videosClipped: number;
}

/** What the user has done with Vieews, all time and across projects. */
export async function usageTotals(userId: string): Promise<UsageTotals> {
  const db = supabaseAdmin();
  const [posts, uploads, jobs] = await Promise.all([
    db.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["published", "partial"]),
    db.from("post_targets").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "published"),
    // shortcut: PostgREST returns at most 1000 rows, so clips undercount past 1000 finished videos; move the sum into SQL then.
    db.from("clip_jobs").select("clips_done").eq("user_id", userId).eq("status", "ready"),
  ]);
  for (const r of [posts, uploads, jobs]) if (r.error) throw r.error;
  const done = (jobs.data ?? []) as { clips_done: number | null }[];
  return { posts: posts.count ?? 0, uploads: uploads.count ?? 0, clips: done.reduce((n, j) => n + (j.clips_done ?? 0), 0), videosClipped: done.length };
}
