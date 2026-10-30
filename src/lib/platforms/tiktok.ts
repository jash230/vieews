import { env } from "@/lib/env";
import type { TikTokOptions } from "@/lib/types";
import { fetchRange, form, scopesFrom } from "./http";
import { LIMITS } from "./limits";
import { expectOk, expiresSoon, PlatformError, type PlatformAdapter, type PublishContext } from "./types";

const API = "https://open.tiktokapis.com/v2";
const SCOPES = ["user.info.basic", "video.publish", "video.upload"];
const MB = 1024 * 1024;
const MAX_STATUS_CHECKS = 40;

export interface TikTokCreatorInfo {
  creatorUsername: string;
  creatorNickname: string;
  creatorAvatarUrl: string | null;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
}

async function ttJson(res: Response, what: string) {
  const json = await res.json().catch(() => ({}));
  const code = json.error?.code;
  if (!res.ok || (code && code !== "ok")) {
    const retryable = res.status >= 500 || res.status === 429 || code === "rate_limit_exceeded";
    throw new PlatformError(`${what} failed: ${json.error?.message || code || res.status}`, {
      retryable,
      status: res.status,
      reauth: code === "access_token_invalid" || res.status === 401,
    });
  }
  return json;
}

/**
 * TikTok chunk rules: chunks are 5–64 MB; files under 5 MB go in one chunk;
 * the last chunk absorbs the remainder (so it may be up to 128 MB).
 */
export function tiktokChunkPlan(size: number, preferred = 10 * MB): { chunkSize: number; totalChunks: number } {
  if (size <= 5 * MB) return { chunkSize: size, totalChunks: 1 };
  const chunkSize = Math.min(Math.max(preferred, 5 * MB), 64 * MB);
  return { chunkSize, totalChunks: Math.max(1, Math.floor(size / chunkSize)) };
}

export function chunkRange(index: number, plan: { chunkSize: number; totalChunks: number }, size: number) {
  const start = index * plan.chunkSize;
  const end = index === plan.totalChunks - 1 ? size - 1 : start + plan.chunkSize - 1;
  return { start, end };
}

export async function getCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const res = await fetch(`${API}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
  });
  const { data } = await ttJson(res, "TikTok creator info");
  return {
    creatorUsername: data.creator_username,
    creatorNickname: data.creator_nickname,
    creatorAvatarUrl: data.creator_avatar_url ?? null,
    privacyLevelOptions: data.privacy_level_options ?? [],
    commentDisabled: !!data.comment_disabled,
    duetDisabled: !!data.duet_disabled,
    stitchDisabled: !!data.stitch_disabled,
    maxVideoPostDurationSec: data.max_video_post_duration_sec ?? 600,
  };
}

export const tiktok: PlatformAdapter = {
  platform: "tiktok",
  label: "TikTok",
  usesPkce: false,

  authorizeUrl({ redirectUri, state }) {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.search = new URLSearchParams({
      client_key: env.tiktok().clientKey,
      scope: SCOPES.join(","),
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    }).toString();
    return url.toString();
  },

  async exchangeCode(code, { redirectUri }) {
    const { clientKey, clientSecret } = env.tiktok();
    const res = await fetch(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    const json = await expectOk(res, "TikTok token exchange").then((r) => r.json());
    if (json.error) throw new PlatformError(`TikTok token exchange: ${json.error_description ?? json.error}`, { retryable: false });
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
      refreshExpiresIn: json.refresh_expires_in,
      scopes: scopesFrom(json.scope, ","),
    };
  },

  needsRefresh: (account) => expiresSoon(account.expires_at, 10 * 60_000),

  async refresh(_account, refreshToken) {
    if (!refreshToken) throw new PlatformError("No TikTok refresh token stored", { retryable: false, reauth: true });
    const { clientKey, clientSecret } = env.tiktok();
    const res = await fetch(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      throw new PlatformError(`TikTok refresh failed: ${json.error_description ?? json.error ?? res.status}`, {
        retryable: res.status >= 500,
        reauth: res.status < 500,
      });
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
      refreshExpiresIn: json.refresh_expires_in,
      scopes: scopesFrom(json.scope, ","),
    };
  },

  async getProfile(accessToken) {
    const res = await fetch(`${API}/user/info/?fields=open_id,display_name,avatar_url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { data } = await ttJson(res, "TikTok profile lookup");
    const user = data.user;
    // Username isn't in user.info.basic; creator_info has it.
    let username: string | null = null;
    try {
      username = (await getCreatorInfo(accessToken)).creatorUsername;
    } catch {
      // Not fatal: video.publish may still be pending approval in the dev portal.
    }
    return { platformAccountId: user.open_id, username, displayName: user.display_name ?? null, avatarUrl: user.avatar_url ?? null };
  },

  async publish(ctx) {
    if (ctx.options.platform !== "tiktok") throw new Error("Wrong options for TikTok");
    if (ctx.media.kind === "image") return publishPhotos(ctx);
    const o = ctx.options.tiktok;
    const size = ctx.media.size_bytes;
    const plan = tiktokChunkPlan(size);

    const init = await ctx.run("tiktok-init", async () => {
      const token = await ctx.accessToken();
      // TikTok requires a fresh creator_info check before every post.
      const info = await getCreatorInfo(token);
      if (!info.privacyLevelOptions.includes(o.privacyLevel)) {
        throw new PlatformError(`TikTok no longer allows "${o.privacyLevel}" for this account. Options: ${info.privacyLevelOptions.join(", ")}`, { retryable: false });
      }
      if (ctx.media.duration_s && ctx.media.duration_s > info.maxVideoPostDurationSec) {
        throw new PlatformError(`Video is longer than this account's ${info.maxVideoPostDurationSec}s limit`, { retryable: false });
      }
      const res = await fetch(`${API}/post/publish/video/init/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          post_info: {
            title: ctx.caption,
            privacy_level: o.privacyLevel,
            disable_comment: o.disableComment || info.commentDisabled,
            disable_duet: o.disableDuet || info.duetDisabled,
            disable_stitch: o.disableStitch || info.stitchDisabled,
            brand_content_toggle: o.brandedContent,
            brand_organic_toggle: o.brandOrganic,
            is_aigc: o.isAigc ?? false,
          },
          source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: plan.chunkSize, total_chunk_count: plan.totalChunks },
        }),
      });
      const { data } = await ttJson(res, "TikTok upload init");
      return { publishId: data.publish_id as string, uploadUrl: data.upload_url as string, username: info.creatorUsername };
    });

    await ctx.setStatus("uploading");
    await ctx.run("tiktok-upload", async () => {
      const source = await ctx.mediaUrl();
      for (let i = 0; i < plan.totalChunks; i++) {
        const { start, end } = chunkRange(i, plan, size);
        const chunk = await fetchRange(source, start, end);
        const res = await fetch(init.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": ctx.media.mime, "Content-Length": String(chunk.byteLength), "Content-Range": `bytes ${start}-${end}/${size}` },
          body: chunk,
        });
        if (res.status !== 201 && res.status !== 206) await expectOk(res, `TikTok chunk ${i + 1}/${plan.totalChunks}`);
      }
      return true;
    });

    return waitForPublish(ctx, init.publishId, init.username);
  },
};

/** Builds the photo-post request body. Exported for tests. */
export function photoPostBody(o: TikTokOptions, info: TikTokCreatorInfo, caption: string, photoUrls: string[]) {
  const firstLine = caption.split("\n")[0]?.trim() ?? "";
  return {
    post_info: {
      title: [...firstLine].slice(0, LIMITS.tiktok.photoTitleMax).join(""),
      description: caption,
      privacy_level: o.privacyLevel,
      disable_comment: o.disableComment || info.commentDisabled,
      auto_add_music: o.autoAddMusic ?? true,
      brand_content_toggle: o.brandedContent,
      brand_organic_toggle: o.brandOrganic,
    },
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: photoUrls },
    post_mode: "DIRECT_POST",
    media_type: "PHOTO",
    is_aigc: o.isAigc ?? false,
  };
}

/** Photo posts (one photo or a carousel): TikTok pulls the images from our verified domain. */
async function publishPhotos(ctx: PublishContext) {
  if (ctx.options.platform !== "tiktok") throw new Error("Wrong options for TikTok");
  const o = ctx.options.tiktok;
  const init = await ctx.run("tiktok-photo-init", async () => {
    const token = await ctx.accessToken();
    const info = await getCreatorInfo(token);
    if (!info.privacyLevelOptions.includes(o.privacyLevel)) {
      throw new PlatformError(`TikTok no longer allows "${o.privacyLevel}" for this account. Options: ${info.privacyLevelOptions.join(", ")}`, { retryable: false });
    }
    const res = await fetch(`${API}/post/publish/content/init/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(photoPostBody(o, info, ctx.caption, ctx.appItemUrls())),
    });
    const { data } = await ttJson(res, "TikTok photo post");
    return { publishId: data.publish_id as string, username: info.creatorUsername };
  });
  return waitForPublish(ctx, init.publishId, init.username);
}

async function waitForPublish(ctx: PublishContext, publishId: string, username: string) {
  await ctx.setStatus("processing");
  const kind = ctx.media.kind === "image" ? "photo" : "video";
  for (let i = 0; i < MAX_STATUS_CHECKS; i++) {
    const status = await ctx.run(`tiktok-status-${i}`, async () => {
      const res = await fetch(`${API}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await ctx.accessToken()}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ publish_id: publishId }),
      });
      const { data } = await ttJson(res, "TikTok publish status");
      // (sic) TikTok's field name is misspelled.
      const ids: string[] = data.publicaly_available_post_id ?? [];
      return { status: data.status as string, failReason: (data.fail_reason as string | undefined) ?? null, postId: ids[0] ? String(ids[0]) : null };
    });
    if (status.status === "PUBLISH_COMPLETE") {
      return {
        remoteId: status.postId ?? publishId,
        remoteUrl: status.postId && username ? `https://www.tiktok.com/@${username}/${kind}/${status.postId}` : null,
      };
    }
    if (status.status === "FAILED") throw new PlatformError(`TikTok rejected the post: ${status.failReason ?? "unknown reason"}`, { retryable: false });
    await ctx.sleep(`tiktok-wait-${i}`, "15s");
  }
  throw new PlatformError("TikTok is still processing after 10 minutes. Check the TikTok app.", { retryable: false });
}
