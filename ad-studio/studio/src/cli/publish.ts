import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { buildCaptions } from "../captions";
import { loadConfig, type Config } from "../config";
import { adMetaSchema } from "../history";
import { loadKit } from "../kit";
import { connectVieews, type Vieews } from "../vieews";
import { main, parseArgs, str } from "./util";

// npm run publish -- --run runs/<id> [--dry-run]
// Uploads the rendered ad to Vieews and posts it to every active account:
//   slides → TikTok photo post (9:16) + Instagram carousel (4:5) + YouTube Short (the video version)
//   video  → one post to TikTok, Instagram Reels and YouTube Shorts
// Every post carries campaign "ad-studio:<app>" and the ad's meta, which later runs read.

const publishSchema = z.object({
  app: z.string(),
  adId: z.string(),
  caption: z.object({ hook: z.string().min(1), body: z.string().optional(), hashtags: z.array(z.string()).default([]) }),
  /** Realistic AI-generated people or scenes: turns on TikTok's and YouTube's AI labels. */
  aiPeople: z.boolean(),
  meta: adMetaSchema.omit({ studio: true, adId: true, app: true, part: true }),
});

const renderSchema = z.object({
  kind: z.enum(["slides", "video"]),
  ok: z.boolean(),
  problems: z.array(z.string()),
  files: z.object({ tiktok: z.array(z.string()), instagram: z.array(z.string()), video: z.string().nullable() }),
  video: z.object({ durationS: z.number(), width: z.number(), height: z.number() }),
});

type Account = { id: string; platform: "youtube" | "instagram" | "tiktok"; username: string | null; status: string };
const IG_CAROUSEL_MAX = 10;
const PRIVACY_PREFERENCE = ["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"];

async function upload(vieews: Vieews, file: string, info: { mime: string; width: number; height: number; durationS?: number }): Promise<string> {
  const sizeBytes = statSync(file).size;
  const created = await vieews.call<{ asset_id: string; upload_url: string }>("create_media_upload", { ...info, sizeBytes });
  const res = await fetch(created.upload_url, { method: "PUT", headers: { "Content-Type": info.mime, "x-upsert": "true" }, body: readFileSync(file) });
  if (!res.ok) throw new Error(`Upload of ${file} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  await vieews.call("finalize_media_upload", { assetId: created.asset_id, width: info.width, height: info.height, durationS: info.durationS });
  return created.asset_id;
}

async function tiktokPrivacy(vieews: Vieews, accountId: string, config: Config): Promise<string> {
  if (config.tiktokPrivacy === "SELF_ONLY") return "SELF_ONLY";
  const req = await vieews.call<{ tiktok_creator_info?: { privacyLevelOptions: string[] } }>("get_platform_requirements", { tiktokAccountId: accountId });
  const allowed = req.tiktok_creator_info?.privacyLevelOptions ?? ["SELF_ONLY"];
  return PRIVACY_PREFERENCE.find((p) => allowed.includes(p)) ?? allowed[0];
}

type PostSummary = { id: string; status: string; targets: { platform: string; status: string; url: string | null; error: string | null }[] };

async function waitForPosts(vieews: Vieews, ids: string[], timeoutMs = 10 * 60_000): Promise<PostSummary[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const posts = await Promise.all(ids.map((postId) => vieews.call<PostSummary>("get_post", { postId })));
    if (posts.every((p) => !["publishing", "scheduled"].includes(p.status)) || Date.now() > deadline) return posts;
    await new Promise((r) => setTimeout(r, 15_000));
  }
}

await main(async () => {
  const args = parseArgs();
  const runDir = resolve(str(args, "run"));
  const dryRun = !!args["dry-run"];
  const config = loadConfig();
  const job = publishSchema.parse(JSON.parse(readFileSync(join(runDir, "publish.json"), "utf8")));
  const render = renderSchema.parse(JSON.parse(readFileSync(join(runDir, "out", "render.json"), "utf8")));
  if (!render.ok && !args.force) throw new Error(`The render has problems; fix them first:\n- ${render.problems.join("\n- ")}`);
  const { kit } = loadKit(job.app);

  const { caption, youtubeTitle } = buildCaptions({ ...job.caption, cta: kit.cta, hashtags: [...job.caption.hashtags, ...kit.hashtags] });
  const meta = (part: "all" | "tiktok" | "instagram" | "youtube") => ({ studio: "ad-studio", adId: job.adId, app: job.app, ...job.meta, part });
  const campaign = `ad-studio:${job.app}`;
  const slides = render.kind === "slides";
  const video = { mime: "video/mp4", width: render.video.width, height: render.video.height, durationS: render.video.durationS };

  if (dryRun) {
    return { dryRun: true, campaign, caption, youtubeTitle, kind: render.kind, files: render.files, meta: meta(slides ? "tiktok" : "all") };
  }

  const vieews = await connectVieews();
  try {
    const accounts = (await vieews.call<Account[]>("list_accounts")).filter(
      (a) => a.status === "active" && (config.accounts === "all" || config.accounts.includes(a.id)),
    );
    if (!accounts.length) throw new Error("No active accounts in Vieews. Connect one under Accounts.");
    const of = (p: Account["platform"]) => accounts.filter((a) => a.platform === p);

    const tiktokTargets = await Promise.all(
      of("tiktok").map(async (a) => ({
        accountId: a.id,
        options: {
          platform: "tiktok",
          tiktok: {
            privacyLevel: await tiktokPrivacy(vieews, a.id, config),
            disableComment: false,
            disableDuet: false,
            disableStitch: false,
            brandOrganic: true,
            brandedContent: false,
            isAigc: job.aiPeople,
            ...(slides && { autoAddMusic: true }),
          },
        },
      })),
    );
    const youtubeTargets = of("youtube").map((a) => ({
      accountId: a.id,
      options: { platform: "youtube", youtube: { title: youtubeTitle, privacy: config.youtubePrivacy, containsSyntheticMedia: job.aiPeople, tags: kit.hashtags.slice(0, 10) } },
    }));
    const instagramTargets = (format: "post" | "reel") =>
      of("instagram").map((a) => ({ accountId: a.id, options: { platform: "instagram", instagram: format === "reel" ? { format, shareToFeed: true } : { format } } }));

    const posts: { part: string; postId: string }[] = [];
    const create = async (part: "all" | "tiktok" | "instagram" | "youtube", media: { mediaAssetId?: string; mediaAssetIds?: string[] }, targets: unknown[]) => {
      if (!targets.length) return;
      const post = await vieews.call<{ id: string }>("create_post", { ...media, caption, campaign, meta: meta(part), targets });
      posts.push({ part, postId: post.id });
    };

    if (slides) {
      if (tiktokTargets.length) {
        const ids = [];
        for (const f of render.files.tiktok) ids.push(await upload(vieews, f, { mime: "image/jpeg", width: 1080, height: 1920 }));
        await create("tiktok", ids.length > 1 ? { mediaAssetIds: ids } : { mediaAssetId: ids[0] }, tiktokTargets);
      }
      if (of("instagram").length) {
        const ids = [];
        for (const f of render.files.instagram.slice(0, IG_CAROUSEL_MAX)) ids.push(await upload(vieews, f, { mime: "image/jpeg", width: 1080, height: 1350 }));
        await create("instagram", ids.length > 1 ? { mediaAssetIds: ids } : { mediaAssetId: ids[0] }, instagramTargets("post"));
      }
      if (youtubeTargets.length && render.files.video) {
        await create("youtube", { mediaAssetId: await upload(vieews, render.files.video, video) }, youtubeTargets);
      }
    } else {
      if (!render.files.video) throw new Error("No video was rendered");
      const assetId = await upload(vieews, render.files.video, video);
      await create("all", { mediaAssetId: assetId }, [...tiktokTargets, ...instagramTargets("reel"), ...youtubeTargets]);
    }

    const final = await waitForPosts(vieews, posts.map((p) => p.postId));
    const result = {
      campaign,
      adId: job.adId,
      posts: final.map((p) => ({ postId: p.id, status: p.status, targets: p.targets.map((t) => ({ platform: t.platform, status: t.status, url: t.url, error: t.error })) })),
    };
    writeFileSync(join(runDir, "out", "publish-result.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await vieews.close();
  }
});
