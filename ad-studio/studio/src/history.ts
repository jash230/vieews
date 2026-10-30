import { z } from "zod";

/** What every ad stores in its Vieews post `meta`, so later runs can avoid repeats and learn. */
export const adMetaSchema = z.object({
  studio: z.literal("ad-studio"),
  adId: z.string().min(1),
  app: z.string().min(1),
  format: z.string().min(1),
  /** The pain or desire this ad is about. */
  angle: z.string().min(1),
  hookPattern: z.string().min(1),
  /** The exact on-screen hook. */
  hook: z.string().min(1),
  tone: z.string().min(1),
  persona: z.string().optional(),
  setting: z.string().optional(),
  /** adId of the winning ad this one varies. */
  variantOf: z.string().optional(),
  aiImages: z.number().int().min(0).default(0),
  neurons: z.number().min(0).default(0),
  /** Which platform version this post is (a slideshow ad becomes 3 posts sharing an adId). */
  part: z.enum(["all", "tiktok", "instagram", "youtube"]).default("all"),
});
export type AdMeta = z.infer<typeof adMetaSchema>;

export interface Metrics {
  views: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface HistoryEntry extends AdMeta {
  createdAt: string;
  postIds: string[];
  /** Summed across the ad's posts, once Vieews reports metrics. */
  metrics?: Metrics;
}

const postSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  meta: z.unknown(),
  metrics: z.object({ views: z.number(), likes: z.number().optional(), comments: z.number().optional(), shares: z.number().optional() }).optional(),
});

/** Turns list_posts output (any JSON array of posts) into one entry per ad, newest first. */
export function historyFromPosts(raw: unknown): HistoryEntry[] {
  const posts = Array.isArray(raw) ? raw : Array.isArray((raw as { posts?: unknown })?.posts) ? (raw as { posts: unknown[] }).posts : [];
  const byAd = new Map<string, HistoryEntry>();
  for (const p of posts) {
    const post = postSchema.safeParse(p);
    if (!post.success) continue;
    const meta = adMetaSchema.safeParse(post.data.meta);
    if (!meta.success) continue;
    const existing = byAd.get(meta.data.adId);
    if (!existing) {
      byAd.set(meta.data.adId, { ...meta.data, createdAt: post.data.created_at, postIds: [post.data.id], metrics: post.data.metrics });
      continue;
    }
    existing.postIds.push(post.data.id);
    if (post.data.created_at < existing.createdAt) existing.createdAt = post.data.created_at;
    if (post.data.metrics) existing.metrics = addMetrics(existing.metrics, post.data.metrics);
  }
  return [...byAd.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function addMetrics(a: Metrics | undefined, b: Metrics): Metrics {
  if (!a) return { ...b };
  return {
    views: a.views + b.views,
    likes: (a.likes ?? 0) + (b.likes ?? 0),
    comments: (a.comments ?? 0) + (b.comments ?? 0),
    shares: (a.shares ?? 0) + (b.shares ?? 0),
  };
}

export const engagementOf = (m: Metrics) => (m.views ? ((m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0)) / m.views : 0);

/** Calendar day of an instant in a time zone, e.g. "2026-10-30". */
export function dayIn(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
