import { afterEach, describe, expect, it, vi } from "vitest";
import { STATS_FETCHERS, totalStats } from "@/lib/stats/service";
import { json, mockFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const YT_READ = "https://www.googleapis.com/auth/youtube.readonly";

describe("account stats", () => {
  it("reads YouTube channel totals and hides hidden subscriber counts", async () => {
    mockFetch([[/channels\?part=statistics/, () => json({ items: [{ statistics: { viewCount: "1200", subscriberCount: "45", hiddenSubscriberCount: false, videoCount: "6" } }] })]]);
    expect(await STATS_FETCHERS.youtube("t", [YT_READ])).toEqual({ followers: 45, views: 1200, likes: null, posts: 6 });

    mockFetch([[/channels/, () => json({ items: [{ statistics: { viewCount: "9", hiddenSubscriberCount: true, videoCount: "1" } }] })]]);
    expect((await STATS_FETCHERS.youtube("t", [YT_READ]))?.followers).toBeNull();
  });

  it("skips platforms whose token lacks the stats scope", async () => {
    const calls = mockFetch([]);
    expect(await STATS_FETCHERS.youtube("t", ["https://www.googleapis.com/auth/youtube.upload"])).toBeNull();
    expect(await STATS_FETCHERS.tiktok("t", ["user.info.basic"])).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("reads Instagram followers and post count", async () => {
    mockFetch([[/graph\.instagram\.com\/.*\/me\?fields=followers_count/, () => json({ followers_count: 310, media_count: 12 })]]);
    expect(await STATS_FETCHERS.instagram("t", [])).toEqual({ followers: 310, views: null, likes: null, posts: 12 });
  });

  it("reads TikTok totals when the scope was granted, and surfaces API errors", async () => {
    mockFetch([[/user\/info/, () => json({ data: { user: { follower_count: 7, likes_count: 90, video_count: 3 } }, error: { code: "ok" } })]]);
    expect(await STATS_FETCHERS.tiktok("t", ["user.info.stats"])).toEqual({ followers: 7, views: null, likes: 90, posts: 3 });

    mockFetch([[/user\/info/, () => json({ error: { code: "scope_not_authorized", message: "no" } })]]);
    await expect(STATS_FETCHERS.tiktok("t", ["user.info.stats"])).rejects.toThrow(/TikTok user stats failed/);
  });

  it("sums only the metrics accounts report", () => {
    expect(
      totalStats([
        { followers: 10, views: 100, likes: null, posts: 2 },
        null,
        { followers: 5, views: null, likes: null, posts: 0 },
      ]),
    ).toEqual({ followers: 15, views: 100, likes: null, posts: 2 });
    expect(totalStats([])).toEqual({ followers: null, views: null, likes: null, posts: null });
  });
});
