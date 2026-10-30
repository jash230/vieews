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
  /** Signature file TikTok asks you to host to verify the /media/tt/ URL prefix (photo posts). */
  tiktokUrlVerification: () => {
    const file = process.env.TIKTOK_URL_VERIFICATION_FILE;
    const content = process.env.TIKTOK_URL_VERIFICATION_CONTENT;
    return file && content ? { file, content } : null;
  },
};

/** Env vars each platform needs before its OAuth flow can start, and where SETUP.md covers them. */
export const PLATFORM_ENV = {
  youtube: { vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], setupStep: 4 },
  instagram: { vars: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"], setupStep: 5 },
  tiktok: { vars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], setupStep: 6 },
} as const;

export const isPlatformConfigured = (platform: keyof typeof PLATFORM_ENV) =>
  PLATFORM_ENV[platform].vars.every((name) => !!process.env[name]);
