import "server-only";
import { env } from "@/lib/env";

export const oauthCookie = (platform: string) => `vw_oauth_${platform}`;
export const oauthCookiePath = (platform: string) => `/api/connect/${platform}`;
export const callbackUrl = (platform: string) => `${env.appUrl()}/api/connect/${platform}/callback`;
