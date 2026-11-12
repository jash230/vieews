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

/** The eight 16-bit groups of an IPv6 address (handles "::" and a dotted IPv4 tail), or null. */
function ipv6Groups(addr: string): number[] | null {
  let text = addr.split("%")[0];
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const v4 = ipv4Parts(tail[1]);
    if (!v4) return null;
    text = text.slice(0, -tail[1].length) + `${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":").map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)) : []);
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill(0), ...rest];
  return groups.length === 8 && groups.every((n) => Number.isInteger(n)) ? groups : null;
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const v4 = ipv4Parts(addr);
  if (v4) return isPrivateV4(v4);
  if (isIP(addr) !== 6) return true;
  const g = ipv6Groups(addr);
  if (!g) return true;
  if (g.every((x) => x === 0) || (g.slice(0, 7).every((x) => x === 0) && g[7] === 1)) return true; // :: and ::1
  // Addresses that carry an IPv4 address inside: mapped/compatible (::ffff:a.b.c.d, ::a.b.c.d,
  // which URL parsing rewrites to hex like ::ffff:7f00:1), NAT64 (64:ff9b::/96) and 6to4 (2002::/16).
  const v4From = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0 || g[5] === 0xffff)) return isPrivateV4(v4From(g[6], g[7]));
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateV4(v4From(g[6], g[7]));
  if (g[0] === 0x2002) return isPrivateV4(v4From(g[1], g[2]));
  const first = g[0];
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
