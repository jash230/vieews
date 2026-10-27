import "server-only";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PREFIX = "vw_";

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Returns the plaintext key once; only its hash is stored. */
export async function createApiKey(userId: string, name: string): Promise<{ key: string; row: ApiKeyRow }> {
  const key = `${PREFIX}${randomToken(32)}`;
  const { data, error } = await supabaseAdmin()
    .from("api_keys")
    .insert({ user_id: userId, name: name.trim() || "MCP key", key_prefix: key.slice(0, 10), key_hash: sha256Hex(key) })
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .single();
  if (error) throw error;
  return { key, row: data };
}

export async function revokeApiKey(userId: string, id: string) {
  const { error } = await supabaseAdmin().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function verifyApiKey(key: string | undefined): Promise<{ userId: string; keyId: string } | null> {
  if (!key?.startsWith(PREFIX)) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("api_keys").select("id, user_id").eq("key_hash", sha256Hex(key)).is("revoked_at", null).maybeSingle();
  if (!data) return null;
  await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { userId: data.user_id, keyId: data.id };
}
