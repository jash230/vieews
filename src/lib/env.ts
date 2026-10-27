import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const env = {
  appUrl: () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  tokenEncryptionKey: () => required("TOKEN_ENCRYPTION_KEY"),
  google: () => ({
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
  }),
  instagram: () => ({
    clientId: required("INSTAGRAM_APP_ID"),
    clientSecret: required("INSTAGRAM_APP_SECRET"),
  }),
  tiktok: () => ({
    clientKey: required("TIKTOK_CLIENT_KEY"),
    clientSecret: required("TIKTOK_CLIENT_SECRET"),
  }),
};
