import { env } from "@/lib/env";
import { form, scopesFrom } from "./http";
import { expectOk, expiresSoon, PlatformError, type PlatformAdapter } from "./types";

export const IG_GRAPH = "https://graph.instagram.com/v23.0";
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];
const DAY = 24 * 60 * 60 * 1000;
/** Containers usually finish in under a minute; give up after ~15 minutes. */
const MAX_STATUS_CHECKS = 30;

async function igJson(res: Response, what: string) {
  const json = await (await expectOk(res, what)).json();
  if (json.error) throw new PlatformError(`${what}: ${json.error.message}`, { retryable: false });
  return json;
}

export const instagram: PlatformAdapter = {
  platform: "instagram",
  label: "Instagram",
  usesPkce: false,

  authorizeUrl({ redirectUri, state }) {
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: env.instagram().clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(","),
      state,
    }).toString();
    return url.toString();
  },

  async exchangeCode(code, { redirectUri }) {
    const { clientId, clientSecret } = env.instagram();
    // Instagram appends "#_" to the code in the redirect.
    const cleanCode = code.replace(/#_$/, "");
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: form({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code: cleanCode }),
    });
    const short = await igJson(shortRes, "Instagram token exchange");
    const shortToken = short.access_token ?? short.data?.[0]?.access_token;
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: clientSecret, access_token: shortToken })}`,
    );
    const long = await igJson(longRes, "Instagram long-lived token");
    return { accessToken: long.access_token, refreshToken: null, expiresIn: long.expires_in, scopes: scopesFrom(short.permissions ?? SCOPES.join(","), ",") };
  },

  // Long-lived tokens last 60 days and can be refreshed once they're 24h old.
  needsRefresh: (account) =>
    expiresSoon(account.expires_at, 7 * DAY) && Date.now() - new Date(account.updated_at).getTime() > DAY,

  async refresh(_account, _refreshToken, accessToken) {
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken })}`);
    if (res.status === 400 || res.status === 401) {
      throw new PlatformError("Instagram token expired", { retryable: false, reauth: true });
    }
    const json = await igJson(res, "Instagram token refresh");
    return { accessToken: json.access_token, refreshToken: null, expiresIn: json.expires_in };
  },

  async getProfile(accessToken) {
    const res = await fetch(`${IG_GRAPH}/me?${new URLSearchParams({ fields: "user_id,username,name,profile_picture_url,account_type", access_token: accessToken })}`);
    const me = await igJson(res, "Instagram profile lookup");
    if (me.account_type && !["BUSINESS", "MEDIA_CREATOR"].includes(me.account_type)) {
      throw new PlatformError("Switch this Instagram account to a Professional (Business or Creator) account first.", { retryable: false });
    }
    return {
      platformAccountId: String(me.user_id ?? me.id),
      username: me.username ?? null,
      displayName: me.name ?? me.username ?? null,
      avatarUrl: me.profile_picture_url ?? null,
    };
  },

  async publish(ctx) {
    if (ctx.options.platform !== "instagram") throw new Error("Wrong options for Instagram");
    const { format, shareToFeed } = ctx.options.instagram;
    const igUserId = ctx.account.platform_account_id;

    const containerId = await ctx.run("instagram-container", async () => {
      const params: Record<string, string> = { access_token: await ctx.accessToken() };
      if (ctx.items.length > 1) {
        // Carousel: one child container per photo, then a parent that lists them in order.
        const children: string[] = [];
        for (const url of await ctx.itemUrls()) {
          const res = await fetch(`${IG_GRAPH}/${igUserId}/media`, {
            method: "POST",
            body: form({ image_url: url, is_carousel_item: "true", access_token: params.access_token }),
          });
          children.push((await igJson(res, `Instagram carousel item ${children.length + 1}`)).id as string);
        }
        const res = await fetch(`${IG_GRAPH}/${igUserId}/media`, {
          method: "POST",
          body: form({ ...params, media_type: "CAROUSEL", children: children.join(","), caption: ctx.caption }),
        });
        return (await igJson(res, "Instagram carousel container")).id as string;
      }
      const url = await ctx.mediaUrl();
      if (format === "story") {
        params.media_type = "STORIES";
        params[ctx.media.kind === "video" ? "video_url" : "image_url"] = url;
      } else if (format === "reel") {
        params.media_type = "REELS";
        params.video_url = url;
        params.share_to_feed = String(shareToFeed ?? true);
        params.caption = ctx.caption;
      } else {
        params.image_url = url;
        params.caption = ctx.caption;
      }
      const res = await fetch(`${IG_GRAPH}/${igUserId}/media`, { method: "POST", body: form(params) });
      return (await igJson(res, "Instagram media container")).id as string;
    });

    await ctx.setStatus("processing");
    for (let i = 0; i < MAX_STATUS_CHECKS; i++) {
      const status = await ctx.run(`instagram-status-${i}`, async () => {
        const res = await fetch(`${IG_GRAPH}/${containerId}?${new URLSearchParams({ fields: "status_code,status", access_token: await ctx.accessToken() })}`);
        const json = await igJson(res, "Instagram container status");
        return { code: json.status_code as string, detail: (json.status as string | undefined) ?? null };
      });
      if (status.code === "FINISHED") break;
      if (status.code === "ERROR" || status.code === "EXPIRED") {
        throw new PlatformError(`Instagram couldn't process the media (${status.code}${status.detail ? `: ${status.detail}` : ""})`, { retryable: false });
      }
      if (i === MAX_STATUS_CHECKS - 1) throw new PlatformError("Instagram is still processing after 15 minutes", { retryable: false });
      await ctx.sleep(`instagram-wait-${i}`, "30s");
    }

    return ctx.run("instagram-publish", async () => {
      const token = await ctx.accessToken();
      const res = await fetch(`${IG_GRAPH}/${igUserId}/media_publish`, { method: "POST", body: form({ creation_id: containerId, access_token: token }) });
      const mediaId = (await igJson(res, "Instagram publish")).id as string;
      const linkRes = await fetch(`${IG_GRAPH}/${mediaId}?${new URLSearchParams({ fields: "permalink", access_token: token })}`);
      const permalink = linkRes.ok ? ((await linkRes.json()).permalink as string | undefined) : undefined;
      return { remoteId: mediaId, remoteUrl: permalink ?? null };
    });
  },
};
