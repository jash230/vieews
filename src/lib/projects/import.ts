import { safeFetch, type Lookup } from "@/lib/net/safe-fetch";

// Turns a pasted App Store, Google Play or website link into the raw facts of an app listing.
// The parsers are pure so they can be tested against saved pages; fetchListing does the network.

export interface Listing {
  source: "appstore" | "play" | "web";
  storeUrl: string;
  name: string;
  description: string;
  developer: string | null;
  category: string | null;
  iconUrl: string | null;
  screenshotUrls: string[];
}

export type StoreLink =
  | { kind: "appstore"; id: string; country: string }
  | { kind: "play"; id: string }
  | { kind: "web"; url: URL };

const MAX_SCREENSHOTS = 10;

export function parseStoreLink(raw: string): StoreLink {
  const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.hostname === "apps.apple.com" || url.hostname === "itunes.apple.com") {
    const id = url.pathname.match(/\/id(\d+)/)?.[1];
    if (id) return { kind: "appstore", id, country: url.pathname.match(/^\/([a-z]{2})\//)?.[1] ?? "us" };
  }
  if (url.hostname === "play.google.com") {
    const id = url.searchParams.get("id");
    if (id) return { kind: "play", id };
  }
  return { kind: "web", url };
}

interface AppStoreResult {
  trackName?: string;
  description?: string;
  sellerName?: string;
  artistName?: string;
  primaryGenreName?: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
  trackViewUrl?: string;
}

/** Reads Apple's lookup API response (itunes.apple.com/lookup?id=…). */
export function parseAppStoreLookup(json: { resultCount?: number; results?: AppStoreResult[] }, fallbackUrl: string): Listing | null {
  const app = json.results?.[0];
  if (!app?.trackName) return null;
  const screens = app.screenshotUrls?.length ? app.screenshotUrls : (app.ipadScreenshotUrls ?? []);
  return {
    source: "appstore",
    storeUrl: app.trackViewUrl?.split("?")[0] ?? fallbackUrl,
    name: app.trackName,
    description: app.description ?? "",
    developer: app.sellerName ?? app.artistName ?? null,
    category: app.primaryGenreName ?? null,
    iconUrl: app.artworkUrl512 ?? app.artworkUrl100 ?? null,
    screenshotUrls: screens.slice(0, MAX_SCREENSHOTS),
  };
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** <meta property|name="key" content="…"> in either attribute order. */
function meta(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i"));
  return m ? decode(m[1]).trim() : null;
}

const absolute = (href: string, base: URL) => {
  try {
    const u = new URL(decode(href), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Reads a Google Play store page. Play has no public API, so this relies on its markup. */
export function parsePlayPage(html: string, storeUrl: string): Listing | null {
  const name = meta(html, "og:title")?.replace(/\s+-\s+Apps on Google Play$/i, "");
  if (!name) return null;
  const base = new URL(storeUrl);
  const screenshots = [...html.matchAll(/<img[^>]+>/gi)]
    .map((m) => m[0])
    .filter((tag) => /alt=["'][^"']*screenshot/i.test(tag))
    .map((tag) => tag.match(/src=["']([^"']+)["']/i)?.[1])
    .flatMap((src) => (src ? [absolute(src, base)] : []))
    .filter((u): u is string => !!u);
  return {
    source: "play",
    storeUrl,
    name,
    description: meta(html, "og:description") ?? meta(html, "description") ?? "",
    developer: html.match(/<a[^>]+href=["'][^"']*\/store\/apps\/dev(?:eloper)?\?id=[^"']*["'][^>]*>(?:<[^>]+>)*([^<]+)/i)?.[1]?.trim() ?? null,
    category: null,
    iconUrl: meta(html, "og:image"),
    screenshotUrls: [...new Set(screenshots)].slice(0, MAX_SCREENSHOTS),
  };
}

/** Reads any website's title, description, preview image and icon. */
export function parseWebPage(html: string, pageUrl: string): Listing {
  const base = new URL(pageUrl);
  const title = meta(html, "og:site_name") ?? meta(html, "og:title") ?? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const icons = [...html.matchAll(/<link[^>]+>/gi)]
    .map((m) => m[0])
    .filter((tag) => /rel=["'][^"']*(apple-touch-icon|icon)[^"']*["']/i.test(tag))
    .sort((a, b) => Number(/apple-touch-icon/i.test(b)) - Number(/apple-touch-icon/i.test(a)))
    .map((tag) => tag.match(/href=["']([^"']+)["']/i)?.[1])
    .flatMap((href) => (href ? [absolute(href, base)] : []))
    .filter((u): u is string => !!u);
  const image = meta(html, "og:image") ?? meta(html, "twitter:image");
  return {
    source: "web",
    storeUrl: pageUrl,
    name: title || base.hostname.replace(/^www\./, ""),
    description: meta(html, "og:description") ?? meta(html, "description") ?? "",
    developer: null,
    category: null,
    iconUrl: icons[0] ?? null,
    screenshotUrls: image ? [absolute(image, base)].filter((u): u is string => !!u) : [],
  };
}

const PAGE_LIMIT = 3 * 1024 * 1024;

async function getText(url: string, lookup?: Lookup): Promise<string> {
  const res = await safeFetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; VieewsBot/1.0)", "accept-language": "en" } }, { lookup });
  if (!res.ok) throw new Error(`Couldn't open that link (${res.status})`);
  const text = await res.text();
  return text.length > PAGE_LIMIT ? text.slice(0, PAGE_LIMIT) : text;
}

/** Fetches a pasted link and returns what it says about the app. */
export async function fetchListing(raw: string, lookup?: Lookup): Promise<Listing> {
  const link = parseStoreLink(raw);
  if (link.kind === "appstore") {
    const res = await safeFetch(`https://itunes.apple.com/lookup?id=${link.id}&country=${link.country}`, {}, { lookup });
    const listing = res.ok ? parseAppStoreLookup(await res.json(), raw) : null;
    if (!listing) throw new Error("That App Store app wasn't found. Check the link.");
    return listing;
  }
  if (link.kind === "play") {
    const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(link.id)}&hl=en&gl=us`;
    const listing = parsePlayPage(await getText(storeUrl, lookup), storeUrl);
    if (!listing) throw new Error("That Google Play app wasn't found. Check the link.");
    return listing;
  }
  return parseWebPage(await getText(link.url.toString(), lookup), link.url.toString());
}
