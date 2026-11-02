import { describe, expect, it } from "vitest";
import { isTooBig, planShrink, UPLOAD_MAX_BYTES } from "@/lib/media/shrink-plan";

const MB = 1024 * 1024;
/** Bytes the plan's streams add up to over the whole clip. */
const plannedBytes = (plan: { videoBitrate: number }, durationS: number, audioBitrate: number) =>
  ((plan.videoBitrate + audioBitrate) * durationS) / 8;

describe("shrink plan", () => {
  it("flags files over the storage upload limit", () => {
    expect(UPLOAD_MAX_BYTES).toBe(50 * MB);
    expect(isTooBig(50 * MB)).toBe(false);
    expect(isTooBig(50 * MB + 1)).toBe(true);
  });

  it("lands a 4K phone clip under the limit at 1080p", () => {
    const plan = planShrink({ durationS: 30, width: 2160, height: 3840, audioBitrate: 128_000 })!;
    expect(plan).toMatchObject({ width: 1080, height: 1920 });
    expect(plannedBytes(plan, 30, 128_000)).toBeLessThan(UPLOAD_MAX_BYTES);
  });

  it("caps the bitrate for short clips and never upscales", () => {
    const short = planShrink({ durationS: 8, width: 1080, height: 1920, audioBitrate: 128_000 })!;
    expect(short.videoBitrate).toBeLessThanOrEqual(8_000_000);
    expect(short).toMatchObject({ width: 1080, height: 1920 });

    const small = planShrink({ durationS: 8, width: 720, height: 1280, audioBitrate: 128_000 })!;
    expect(small).toMatchObject({ width: 720, height: 1280 });
  });

  it("drops the resolution as the bitrate gets tight", () => {
    const threeMin = planShrink({ durationS: 180, width: 1080, height: 1920, audioBitrate: 128_000 })!;
    expect(threeMin).toMatchObject({ width: 720, height: 1280 });

    const tenMin = planShrink({ durationS: 600, width: 1080, height: 1920, audioBitrate: 128_000 })!;
    expect(tenMin).toMatchObject({ width: 540, height: 960 });
    expect(plannedBytes(tenMin, 600, 128_000)).toBeLessThan(UPLOAD_MAX_BYTES);
  });

  it("keeps landscape aspect and even dimensions", () => {
    const plan = planShrink({ durationS: 30, width: 3841, height: 2161, audioBitrate: 128_000 })!;
    expect(plan.width).toBe(1920);
    expect(plan.height % 2).toBe(0);
    expect(plan.height).toBeCloseTo(1080, -1);
  });

  it("aims lower on a retry", () => {
    const first = planShrink({ durationS: 120, width: 1080, height: 1920, audioBitrate: 128_000 })!;
    const retry = planShrink({ durationS: 120, width: 1080, height: 1920, audioBitrate: 128_000, squeeze: 0.8 })!;
    expect(retry.videoBitrate).toBeLessThan(first.videoBitrate);

    // Short clips sit at the bitrate cap; a retry still has to come out smaller.
    const shortFirst = planShrink({ durationS: 8, width: 1080, height: 1920, audioBitrate: 128_000 })!;
    const shortRetry = planShrink({ durationS: 8, width: 1080, height: 1920, audioBitrate: 128_000, squeeze: 0.6 })!;
    expect(shortRetry.videoBitrate).toBeLessThan(shortFirst.videoBitrate);
  });

  it("shrinks the frame on a retry when busy footage overshot", () => {
    const retry = planShrink({ durationS: 14, width: 1080, height: 1920, audioBitrate: 128_000, maxLongSide: 1400 })!;
    expect(retry).toMatchObject({ width: 788, height: 1400 });
    // Too small to be worth posting.
    expect(planShrink({ durationS: 14, width: 1080, height: 1920, audioBitrate: 128_000, maxLongSide: 400 })).toBeNull();
  });

  it("gives up when the clip is too long to fit at any watchable quality", () => {
    expect(planShrink({ durationS: 3 * 60 * 60, width: 1080, height: 1920, audioBitrate: 128_000 })).toBeNull();
  });
});
