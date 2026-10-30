import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

// Fetches URLs that users (or the copilot) hand us without letting them reach our own network:
// every hop's host must resolve only to public addresses, and redirects are followed by hand.
// A host could still re-resolve between our check and fetch's own lookup (DNS rebinding);
// the redirect and literal-IP checks close the common paths.

export type Lookup = (hostname: string) => Promise<{ address: string }[]>;

const defaultLookup: Lookup = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

function isPrivateV4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const v4 = ipv4Parts(addr);
  if (v4) return isPrivateV4(v4);
  if (isIP(addr) !== 6) return true;
  if (addr === "::" || addr === "::1") return true;
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  const first = parseInt(addr.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xff00) === 0xff00 // multicast
  );
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export async function assertPublicUrl(url: URL, lookup: Lookup = defaultLookup): Promise<void> {
  if (url.protocol !== "https:") throw new UnsafeUrlError("Only https:// links can be fetched");
  if (url.username || url.password) throw new UnsafeUrlError("Links with credentials can't be fetched");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("Private network addresses can't be fetched");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host).catch(() => []);
  if (!addresses.length) throw new UnsafeUrlError(`Couldn't find ${host}`);
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError("Private network addresses can't be fetched");
}

/** fetch() for untrusted links: public https only, at most `maxRedirects` checked hops. */
export async function safeFetch(
  input: string | URL,
  init: RequestInit = {},
  opts: { maxRedirects?: number; lookup?: Lookup } = {},
): Promise<Response> {
  let url = new URL(input);
  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url, opts.lookup);
    const res = await fetch(url, { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    if (hop >= (opts.maxRedirects ?? 5)) throw new UnsafeUrlError("Too many redirects");
    url = new URL(location, url);
  }
}

/** Reads a body, giving up as soon as it passes `maxBytes` instead of trusting content-length. */
export async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error(`File is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`File is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
