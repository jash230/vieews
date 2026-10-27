import { env } from "@/lib/env";
import { fetchRange, form, scopesFrom } from "./http";
import { expectOk, expiresSoon, PlatformError, type PlatformAdapter } from "./types";
import { pkceChallenge } from "@/lib/crypto";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
/** Must be a multiple of 256 KiB. */
export const YT_CHUNK_BYTES = 32 * 256 * 1024; // 8 MiB

export const youtube: PlatformAdapter = {
  platform: "youtube",
  label: "YouTube",
  usesPkce: true,

  authorizeUrl({ redirectUri, state, codeVerifier }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: env.google().clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: "S256",
    }).toString();
    return url.toString();
  },

  async exchangeCode(code, { redirectUri, codeVerifier }) {
    const { clientId, clientSecret } = env.google();
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: form({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });
    const json = await (await expectOk(res, "Google token exchange")).json();
    if (!json.refresh_token) {
      throw new PlatformError("Google didn't return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.", { retryable: false });
    }
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in, scopes: scopesFrom(json.scope) };
  },

  needsRefresh: (account) => expiresSoon(account.expires_at, 5 * 60_000),

  async refresh(_account, refreshToken) {
    if (!refreshToken) throw new PlatformError("No refresh token stored", { retryable: false, reauth: true });
    const { clientId, clientSecret } = env.google();
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: form({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    if (res.status === 400 || res.status === 401) {
      throw new PlatformError("Google refresh token was revoked or expired", { retryable: false, reauth: true });
    }
    const json = await (await expectOk(res, "Google token refresh")).json();
    // Google keeps the same refresh token unless it rotates one in the response.
    return { accessToken: json.access_token, refreshToken: json.refresh_token ?? refreshToken, expiresIn: json.expires_in, scopes: scopesFrom(json.scope) };
  },

  async getProfile(accessToken) {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await (await expectOk(res, "YouTube channel lookup")).json();
    const channel = json.items?.[0];
    if (!channel) throw new PlatformError("This Google account has no YouTube channel. Create one first.", { retryable: false });
    return {
      platformAccountId: channel.id,
      username: channel.snippet.customUrl ?? null,
      displayName: channel.snippet.title ?? null,
      avatarUrl: channel.snippet.thumbnails?.default?.url ?? null,
    };
  },

  async publish(ctx) {
    if (ctx.options.platform !== "youtube") throw new Error("Wrong options for YouTube");
    const opts = ctx.options.youtube;
    const total = ctx.media.size_bytes;

    const uploadUrl = await ctx.run("youtube-init", async () => {
      const res = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await ctx.accessToken()}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(total),
          "X-Upload-Content-Type": ctx.media.mime,
        },
        body: JSON.stringify({
          snippet: {
            title: opts.title.trim(),
            description: opts.description ?? ctx.caption,
            tags: opts.tags?.length ? opts.tags : undefined,
            categoryId: "22",
          },
          status: { privacyStatus: opts.privacy, selfDeclaredMadeForKids: opts.madeForKids ?? false },
        }),
      });
      await expectOk(res, "YouTube upload session");
      const location = res.headers.get("location");
      if (!location) throw new PlatformError("YouTube didn't return an upload URL");
      return location;
    });

    await ctx.setStatus("uploading");
    const videoId = await ctx.run("youtube-upload", () => uploadResumable(uploadUrl, total, ctx.media.mime, () => ctx.mediaUrl()));
    return {
      remoteId: videoId,
      remoteUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  },
};

/** Uploads in chunks, resuming from whatever YouTube already has (so step retries continue). */
export async function uploadResumable(uploadUrl: string, total: number, mime: string, mediaUrl: () => Promise<string>): Promise<string> {
  let offset = await queryOffset(uploadUrl, total);
  const source = await mediaUrl();
  while (true) {
    if (offset === "done") throw new PlatformError("YouTube already has this upload but its video id was lost. Check YouTube Studio before retrying.", { retryable: false });
    const start = offset;
    const end = Math.min(start + YT_CHUNK_BYTES, total) - 1;
    const chunk = await fetchRange(source, start, end);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": String(chunk.byteLength), "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Type": mime },
      body: chunk,
    });
    if (res.status === 200 || res.status === 201) {
      const json = await res.json();
      return json.id as string;
    }
    if (res.status !== 308) await expectOk(res, "YouTube chunk upload");
    offset = nextOffset(res.headers.get("range"));
  }
}

async function queryOffset(uploadUrl: string, total: number): Promise<number | "done"> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Length": "0", "Content-Range": `bytes */${total}` } });
  if (res.status === 200 || res.status === 201) return "done";
  if (res.status === 308) return nextOffset(res.headers.get("range"));
  await expectOk(res, "YouTube upload status");
  return 0;
}

/** "bytes=0-1234" → 1235; no header → 0. */
export function nextOffset(range: string | null): number {
  const match = range?.match(/bytes=\d+-(\d+)/);
  return match ? Number(match[1]) + 1 : 0;
}
