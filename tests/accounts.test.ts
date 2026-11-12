import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@/lib/crypto";
import { PlatformError } from "@/lib/platforms/types";
import type { SocialAccountRow } from "@/lib/types";

const key = randomBytes(32).toString("base64");
process.env.TOKEN_ENCRYPTION_KEY = key;

// The stored row, as the database has it now, and every update written to it.
let stored: SocialAccountRow;
const updates: Record<string, unknown>[] = [];
const table = () => {
  const q = {
    select: () => q,
    eq: () => q,
    update: (patch: Record<string, unknown>) => {
      updates.push(patch);
      return { eq: async () => ({ error: null }) };
    },
    maybeSingle: async () => ({ data: { ...stored }, error: null }),
  };
  return q;
};
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: table }), MEDIA_BUCKET: "media" }));

const refresh = vi.fn();
vi.mock("@/lib/platforms", () => ({
  adapters: { tiktok: { needsRefresh: (a: SocialAccountRow) => new Date(a.expires_at!).getTime() - Date.now() < 10 * 60_000, refresh } },
}));

const { getValidAccessToken } = await import("@/lib/accounts/service");

const soon = () => new Date(Date.now() + 60_000).toISOString();
const later = () => new Date(Date.now() + 24 * 60 * 60_000).toISOString();
const account = (token: string, expiresAt: string) =>
  ({ id: "acc", platform: "tiktok", access_token_enc: encryptSecret(token, key), refresh_token_enc: encryptSecret("rt", key), expires_at: expiresAt }) as SocialAccountRow;

beforeEach(() => {
  updates.length = 0;
  refresh.mockReset();
});

describe("getValidAccessToken", () => {
  it("uses the token another run just refreshed instead of flagging the account for reconnecting", async () => {
    const mine = account("old", soon());
    stored = account("new", later());
    refresh.mockRejectedValue(new PlatformError("invalid refresh token", { retryable: false, reauth: true }));
    expect(await getValidAccessToken(mine)).toBe("new");
    expect(updates.some((u) => u.status === "needs_reauth")).toBe(false);
  });

  it("flags the account when nobody else refreshed it", async () => {
    const mine = account("old", soon());
    stored = { ...mine };
    refresh.mockRejectedValue(new PlatformError("invalid refresh token", { retryable: false, reauth: true }));
    await expect(getValidAccessToken(mine)).rejects.toThrow("invalid refresh token");
    expect(updates).toContainEqual(expect.objectContaining({ status: "needs_reauth" }));
  });
});
