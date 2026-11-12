import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { adapters } from "@/lib/platforms";
import { PlatformError, type PlatformProfile, type TokenSet } from "@/lib/platforms/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PUBLIC_ACCOUNT_COLUMNS, type Platform, type PublicAccount, type SocialAccountRow } from "@/lib/types";

const inSeconds = (s?: number | null) => (s ? new Date(Date.now() + s * 1000).toISOString() : null);

export async function listAccounts(userId: string): Promise<PublicAccount[]> {
  const { data, error } = await supabaseAdmin()
    .from("social_accounts")
    .select(PUBLIC_ACCOUNT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as PublicAccount[];
}

export async function getAccount(userId: string, accountId: string): Promise<SocialAccountRow> {
  const { data, error } = await supabaseAdmin()
    .from("social_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", accountId)
    .single();
  if (error || !data) throw new Error("Account not found");
  return data as SocialAccountRow;
}

/** Saves (or refreshes) a connected account and returns its id. */
export async function saveConnectedAccount(userId: string, platform: Platform, tokens: TokenSet, profile: PlatformProfile): Promise<string> {
  const key = env.tokenEncryptionKey();
  const { data, error } = await supabaseAdmin()
    .from("social_accounts")
    .upsert(
      {
        user_id: userId,
        platform,
        platform_account_id: profile.platformAccountId,
        username: profile.username,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        access_token_enc: encryptSecret(tokens.accessToken, key),
        refresh_token_enc: tokens.refreshToken ? encryptSecret(tokens.refreshToken, key) : null,
        expires_at: inSeconds(tokens.expiresIn),
        refresh_expires_at: inSeconds(tokens.refreshExpiresIn),
        scopes: tokens.scopes ?? [],
        status: "active",
        last_error: null,
      },
      { onConflict: "user_id,platform,platform_account_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function disconnectAccount(userId: string, accountId: string) {
  const db = supabaseAdmin();
  // Its post targets cascade away, so re-derive those posts' status afterwards (or they'd stay "publishing").
  // Only this user's account: otherwise a guessed id would re-derive someone else's posts.
  const { data: owned, error: ownErr } = await db.from("social_accounts").select("id").eq("user_id", userId).eq("id", accountId).maybeSingle();
  if (ownErr) throw ownErr;
  if (!owned) return;
  // Only posts still on their way out. Finished posts keep the status they went out with: re-deriving
  // a published post whose only target was this account would turn it "canceled" (no targets left).
  const { data: affected, error: affErr } = await db
    .from("post_targets")
    .select("post_id, post:posts!inner(status)")
    .eq("user_id", userId)
    .eq("social_account_id", accountId)
    .in("post.status", ["scheduled", "publishing"]);
  if (affErr) throw affErr;
  const { error } = await db.from("social_accounts").delete().eq("user_id", userId).eq("id", accountId);
  if (error) throw error;
  const { refreshPostStatus } = await import("@/lib/posts/service");
  for (const postId of new Set((affected ?? []).map((t) => t.post_id as string))) {
    await refreshPostStatus(postId).catch((err) => console.error(err));
  }
}

export async function markNeedsReauth(accountId: string, message: string) {
  await supabaseAdmin().from("social_accounts").update({ status: "needs_reauth", last_error: message }).eq("id", accountId);
}

/** Returns a usable access token, refreshing and persisting it first if needed. */
export async function getValidAccessToken(account: SocialAccountRow): Promise<string> {
  const key = env.tokenEncryptionKey();
  const adapter = adapters[account.platform];
  const accessToken = decryptSecret(account.access_token_enc, key);
  if (!adapter.needsRefresh(account)) return accessToken;

  const refreshToken = account.refresh_token_enc ? decryptSecret(account.refresh_token_enc, key) : null;
  let next: TokenSet;
  try {
    next = await adapter.refresh(account, refreshToken, accessToken);
  } catch (err) {
    if (err instanceof PlatformError && err.opts.reauth) {
      // Two runs refreshing at once (two posts due together, or the composer and a publish): the
      // other one may have rotated the refresh token first. Use its fresh token instead of asking
      // the user to reconnect an account that works.
      const fresh = await refreshedElsewhere(account);
      if (fresh) return fresh;
      await markNeedsReauth(account.id, err.message);
    }
    throw err;
  }
  const patch = {
    access_token_enc: encryptSecret(next.accessToken, key),
    refresh_token_enc: next.refreshToken ? encryptSecret(next.refreshToken, key) : account.refresh_token_enc,
    expires_at: inSeconds(next.expiresIn),
    refresh_expires_at: next.refreshExpiresIn ? inSeconds(next.refreshExpiresIn) : account.refresh_expires_at,
    status: "active" as const,
    last_error: null,
  };
  const { error } = await supabaseAdmin().from("social_accounts").update(patch).eq("id", account.id);
  if (error) throw error;
  Object.assign(account, patch, { updated_at: new Date().toISOString() });
  return next.accessToken;
}

/** The account's token when another run refreshed it since `account` was read, else null. */
async function refreshedElsewhere(account: SocialAccountRow): Promise<string | null> {
  const { data } = await supabaseAdmin().from("social_accounts").select("*").eq("id", account.id).maybeSingle();
  const latest = data as SocialAccountRow | null;
  if (!latest || latest.access_token_enc === account.access_token_enc || adapters[account.platform].needsRefresh(latest)) return null;
  Object.assign(account, latest);
  return decryptSecret(latest.access_token_enc, env.tokenEncryptionKey());
}
