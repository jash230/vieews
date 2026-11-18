import "server-only";
import { env } from "@/lib/env";

export const oauthCookie = (platform: string) => `vw_oauth_${platform}`;
export const oauthCookiePath = (platform: string) => `/api/connect/${platform}`;
// shortcut: TikTok's production app only allows the vieews.vercel.app callback (it 307s to vieews.dev, query intact);
// switch to env.appUrl() once a TikTok app revision adds the vieews.dev URI.
export const callbackUrl = (platform: string) =>
  `${platform === "tiktok" ? "https://vieews.vercel.app" : env.appUrl()}/api/connect/${platform}/callback`;
