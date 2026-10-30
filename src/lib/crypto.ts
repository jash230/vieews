import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

function keyFrom(secret: string): Buffer {
  const raw = Buffer.from(secret, "base64");
  if (raw.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  }
  return raw;
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext>, each part base64url. */
export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function hmacKey(secret: string, purpose: string): Buffer {
  // Separate key per purpose so the encryption key is never used directly for signing.
  return createHmac("sha256", keyFrom(secret)).update(purpose).digest();
}

/** Compact signed token: <payload>.<signature>, both base64url. */
export function signToken(payload: Record<string, unknown>, secret: string, purpose: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", hmacKey(secret, purpose)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Returns the payload when the signature matches, otherwise null. */
export function verifyToken<T>(token: string, secret: string, purpose: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", hmacKey(secret, purpose)).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** PKCE S256 challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
