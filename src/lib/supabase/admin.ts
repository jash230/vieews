import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Service-role client. Bypasses RLS, so every query must filter by user_id itself.
 * Used by server components, server actions, Inngest jobs and the MCP route.
 */
export function supabaseAdmin(): SupabaseClient {
  client ??= createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const MEDIA_BUCKET = "media";
