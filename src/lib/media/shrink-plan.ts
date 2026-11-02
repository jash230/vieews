const MB = 1024 * 1024;

/** Supabase rejects any single file over this (the Free plan's global upload limit). */
export const UPLOAD_MAX_BYTES = 50 * MB;

export const isTooBig = (sizeBytes: number, maxBytes = UPLOAD_MAX_BYTES) => sizeBytes > maxBytes;

/** Room for the container and encoder overshoot. */
const HEADROOM = 0.9;
/** Plenty for 1080p; spending more just makes the file bigger. */
const MAX_VIDEO_BITRATE = 8_000_000;
/** Below this the video isn't worth posting. */
const MIN_VIDEO_BITRATE = 200_000;
/** Lower bitrates look better at lower resolutions. */
const LONG_SIDE_FOR_BITRATE = [
  { minBitrate: 2_500_000, longSide: 1920 },
  { minBitrate: 1_000_000, longSide: 1280 },
  { minBitrate: 0, longSide: 960 },
];
/** Smaller than this isn't worth posting. */
const MIN_LONG_SIDE = 480;

export interface ShrinkInput {
  durationS: number;
  width: number;
  height: number;
  /** Bits per second of the audio track as it will be written. */
  audioBitrate: number;
  maxBytes?: number;
  /** Below 1 to aim lower after an attempt came out too big. */
  squeeze?: number;
  /**
   * Caps the frame after an attempt overshot. Encoders stop compressing at their quality floor, so on
   * busy footage only fewer pixels make the file smaller.
   */
  maxLongSide?: number;
}

export interface ShrinkPlan {
  videoBitrate: number;
  width: number;
  height: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Picks a video bitrate and size that land the file under `maxBytes`, or null when it can't fit. */
export function planShrink({ durationS, width, height, audioBitrate, maxBytes = UPLOAD_MAX_BYTES, squeeze = 1, maxLongSide = Infinity }: ShrinkInput): ShrinkPlan | null {
  const budget = (maxBytes * 8 * HEADROOM) / durationS - audioBitrate;
  const videoBitrate = Math.floor(Math.min(budget, MAX_VIDEO_BITRATE) * squeeze);
  if (!(videoBitrate >= MIN_VIDEO_BITRATE)) return null;
  const longSide = Math.min(LONG_SIDE_FOR_BITRATE.find((t) => videoBitrate >= t.minBitrate)!.longSide, maxLongSide);
  if (longSide < MIN_LONG_SIDE) return null;
  const scale = Math.min(1, longSide / Math.max(width, height));
  return { videoBitrate, width: even(width * scale), height: even(height * scale) };
}
