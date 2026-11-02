import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchListing, parseAppStoreLookup, parsePlayPage, parseStoreLink, parseWebPage } from "@/lib/projects/import";
import { json, mockFetch } from "./helpers";

const publicLookup = async () => [{ address: "93.184.216.34" }];

afterEach(() => vi.unstubAllGlobals());

describe("parseStoreLink", () => {
  it("reads App Store ids and country", () => {
    expect(parseStoreLink("https://apps.apple.com/gb/app/tally-split/id1234567890?mt=8")).toEqual({ kind: "appstore", id: "1234567890", country: "gb" });
    expect(parseStoreLink("apps.apple.com/app/id987")).toEqual({ kind: "appstore", id: "987", country: "us" });
  });

  it("reads Google Play package names", () => {
    expect(parseStoreLink("https://play.google.com/store/apps/details?id=com.tally.app&hl=en")).toEqual({ kind: "play", id: "com.tally.app" });
  });

  it("treats anything else as a website, upgraded to https", () => {
    const link = parseStoreLink("http://tally.app/pricing");
    expect(link.kind).toBe("web");
    expect(link.kind === "web" && link.url.toString()).toBe("https://tally.app/pricing");
  });
});

describe("parseAppStoreLookup", () => {
  it("takes the name, icon and phone screenshots", () => {
    const listing = parseAppStoreLookup(
      {
        resultCount: 1,
        results: [
          {
            trackName: "Tally",
            description: "Split any receipt from a photo.",
            sellerName: "Tally Labs",
            primaryGenreName: "Finance",
            artworkUrl512: "https://is1.mzstatic.com/icon.png",
            screenshotUrls: ["https://is1.mzstatic.com/1.png", "https://is1.mzstatic.com/2.png"],
            ipadScreenshotUrls: ["https://is1.mzstatic.com/ipad.png"],
            trackViewUrl: "https://apps.apple.com/us/app/tally/id1?uo=4",
          },
        ],
      },
      "https://apps.apple.com/app/id1",
    );
    expect(listing).toMatchObject({
      source: "appstore",
      name: "Tally",
      developer: "Tally Labs",
      category: "Finance",
      iconUrl: "https://is1.mzstatic.com/icon.png",
      storeUrl: "https://apps.apple.com/us/app/tally/id1",
      screenshotUrls: ["https://is1.mzstatic.com/1.png", "https://is1.mzstatic.com/2.png"],
    });
  });

  it("falls back to iPad screenshots and returns null when the app is missing", () => {
    expect(parseAppStoreLookup({ results: [{ trackName: "X", ipadScreenshotUrls: ["https://a/1.png"] }] }, "u")?.screenshotUrls).toEqual(["https://a/1.png"]);
    expect(parseAppStoreLookup({ resultCount: 0, results: [] }, "u")).toBeNull();
  });
});

describe("parsePlayPage", () => {
  it("reads og tags and screenshot images", () => {
    const html = `<html><head>
      <meta property="og:title" content="Tally &amp; Co - Apps on Google Play">
      <meta property="og:description" content="Split receipts fast.">
      <meta property="og:image" content="https://play-lh.googleusercontent.com/icon">
      </head><body>
      <img src="https://play-lh.googleusercontent.com/s1=w526" alt="Screenshot image">
      <img src="https://play-lh.googleusercontent.com/s2=w526" alt="Screenshot image">
      <img src="https://play-lh.googleusercontent.com/avatar" alt="Developer avatar">
      </body></html>`;
    const listing = parsePlayPage(html, "https://play.google.com/store/apps/details?id=com.tally");
    expect(listing).toMatchObject({
      name: "Tally & Co",
      description: "Split receipts fast.",
      iconUrl: "https://play-lh.googleusercontent.com/icon",
      screenshotUrls: ["https://play-lh.googleusercontent.com/s1=w526", "https://play-lh.googleusercontent.com/s2=w526"],
    });
  });
});

describe("parseWebPage", () => {
  it("prefers the site name, apple-touch-icon and og:image", () => {
    const html = `<title>Home | Tally</title>
      <meta content="Tally" property="og:site_name">
      <meta name="description" content="Receipts, split.">
      <link rel="icon" href="/favicon.ico">
      <link rel="apple-touch-icon" href="/apple-icon.png">
      <meta property="og:image" content="/og.png">`;
    expect(parseWebPage(html, "https://tally.app/")).toMatchObject({
      name: "Tally",
      description: "Receipts, split.",
      iconUrl: "https://tally.app/apple-icon.png",
      screenshotUrls: ["https://tally.app/og.png"],
    });
  });

  it("falls back to the host name", () => {
    expect(parseWebPage("<html></html>", "https://www.tally.app/").name).toBe("tally.app");
  });
});

describe("fetchListing", () => {
  it("uses Apple's lookup API for App Store links", async () => {
    const calls = mockFetch([[/itunes\.apple\.com\/lookup\?id=42&country=us/, () => json({ results: [{ trackName: "Tally", screenshotUrls: [] }] })]]);
    const listing = await fetchListing("https://apps.apple.com/us/app/tally/id42", publicLookup);
    expect(listing.name).toBe("Tally");
    expect(calls).toHaveLength(1);
  });

  it("says so when the app doesn't exist", async () => {
    mockFetch([[/itunes/, () => json({ resultCount: 0, results: [] })]]);
    await expect(fetchListing("https://apps.apple.com/app/id1", publicLookup)).rejects.toThrow(/wasn't found/);
  });
});
