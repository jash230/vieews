import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, pkceChallenge } from "@/lib/crypto";

const key = randomBytes(32).toString("base64");

describe("token encryption", () => {
  it("round-trips", () => {
    const enc = encryptSecret("ya29.secret-token", key);
    expect(enc).not.toContain("secret");
    expect(decryptSecret(enc, key)).toBe("ya29.secret-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });

  it("rejects tampered ciphertext", () => {
    const parts = encryptSecret("hello", key).split(".");
    parts[3] = Buffer.from("jello").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });

  it("rejects the wrong key", () => {
    const enc = encryptSecret("hello", key);
    expect(() => decryptSecret(enc, randomBytes(32).toString("base64"))).toThrow();
  });

  it("rejects keys that aren't 32 bytes", () => {
    expect(() => encryptSecret("x", "c2hvcnQ=")).toThrow(/32 bytes/);
  });

  it("computes RFC 7636 PKCE challenges", () => {
    // Example from RFC 7636 appendix B.
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
