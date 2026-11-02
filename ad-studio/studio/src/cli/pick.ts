import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config";
import { dayIn, historyFromPosts, type HistoryEntry } from "../history";
import { loadKit, STUDIO_ROOT } from "../kit";
import { neuronsUsedToday, pick } from "../pick";
import { connectVieews, listPostsSince } from "../vieews";
import { main, parseArgs } from "./util";

const HISTORY_DAYS = 45;

// npm run pick [-- --app <slug>] [--history posts.json] [--seed N]
// Chooses the app that's furthest behind today, reads its ad history from Vieews,
// and prints fresh format × angle × hook-pattern × tone candidates plus a new run folder.
await main(async () => {
  const args = parseArgs();
  const config = loadConfig();
  if (config.paused) return { skip: "paused in ad-studio/config.json" };

  const now = new Date();
  let posts: unknown;
  if (typeof args.history === "string") {
    posts = JSON.parse(readFileSync(args.history, "utf8"));
  } else {
    const vieews = await connectVieews();
    posts = await listPostsSince(vieews, new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString());
    await vieews.close();
  }
  const history: HistoryEntry[] = historyFromPosts(posts);

  const slugs = typeof args.app === "string" ? [args.app] : config.apps;
  if (!slugs.length) return { skip: "no apps enabled in ad-studio/config.json" };
  const today = dayIn(now, config.timezone);
  const progress = slugs.map((slug) => {
    const kit = loadKit(slug).kit;
    const done = history.filter((h) => h.app === slug && dayIn(h.createdAt, config.timezone) === today).length;
    return { slug, kit, done, ratio: kit.adsPerDay ? done / kit.adsPerDay : Infinity };
  });
  const next = progress.filter((p) => p.done < p.kit.adsPerDay).sort((a, b) => a.ratio - b.ratio)[0];
  if (!next) return { skip: "every app already has its ads for today", progress: progress.map(({ slug, done, kit }) => ({ slug, done, adsPerDay: kit.adsPerDay })) };

  const neuronsLeft = Math.max(0, config.dailyNeuronBudget - neuronsUsedToday(history, now));
  const seed = typeof args.seed === "string" ? Number(args.seed) : randomBytes(4).readUInt32LE();
  const result = pick({ kit: next.kit, history, now, seed, neuronsLeft, timeZone: config.timezone });

  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const adId = `${next.slug}-${stamp}-${randomBytes(2).toString("hex")}`.toLowerCase();
  const runDir = join(STUDIO_ROOT, "runs", adId);
  mkdirSync(runDir, { recursive: true });

  return {
    app: next.slug,
    adId,
    runDir,
    seed,
    neuronsLeft,
    ...result,
    usedHooks: result.usedHooks.slice(0, 80),
  };
});
