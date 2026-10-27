import type { MediaAssetRow, Platform, SocialAccountRow, TargetOptions } from "@/lib/types";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  /** Seconds until the access token expires. */
  expiresIn?: number | null;
  refreshExpiresIn?: number | null;
  scopes?: string[];
}

export interface PlatformProfile {
  platformAccountId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthorizeParams {
  redirectUri: string;
  state: string;
  codeVerifier: string;
}

export interface PublishContext {
  account: SocialAccountRow;
  media: MediaAssetRow;
  caption: string;
  options: TargetOptions;
  /** Durable step: result is memoized across retries; keep secrets out of return values. */
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
  sleep(id: string, duration: string): Promise<void>;
  accessToken(): Promise<string>;
  /** Short-lived signed URL the platform (or this server) can download the media from. */
  mediaUrl(): Promise<string>;
  /** Persist progress so the UI can show it. */
  setStatus(status: "uploading" | "processing"): Promise<void>;
}

export interface PublishResult {
  remoteId: string;
  remoteUrl: string | null;
}

export interface PlatformAdapter {
  platform: Platform;
  label: string;
  /** False when the provider does not support PKCE for web apps. */
  usesPkce: boolean;
  authorizeUrl(params: AuthorizeParams): string;
  exchangeCode(code: string, params: Omit<AuthorizeParams, "state">): Promise<TokenSet>;
  refresh(account: SocialAccountRow, refreshToken: string | null, accessToken: string): Promise<TokenSet>;
  /** Whether the stored token should be refreshed now. */
  needsRefresh(account: SocialAccountRow): boolean;
  getProfile(accessToken: string, tokens: TokenSet): Promise<PlatformProfile>;
  publish(ctx: PublishContext): Promise<PublishResult>;
}

export class PlatformError extends Error {
  constructor(
    message: string,
    readonly opts: { retryable: boolean; status?: number; reauth?: boolean } = { retryable: true },
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

/** Throws PlatformError for non-2xx responses; 4xx (except 408/429) are not retried. */
export async function expectOk(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  const body = await res.text().catch(() => "");
  const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
  throw new PlatformError(`${what} failed (${res.status}): ${body.slice(0, 500)}`, {
    retryable,
    status: res.status,
    reauth: res.status === 401,
  });
}

export function expiresSoon(expiresAt: string | null, withinMs: number): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() < withinMs;
}
