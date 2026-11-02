import type { MediaKind, Platform, TargetOptions } from "@/lib/types";

export interface MediaInfo {
  kind: MediaKind;
  mime: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationS?: number | null;
}

export interface ValidationIssue {
  platform: Platform;
  field: "media" | "caption" | "title" | "options";
  message: string;
}

const MB = 1024 * 1024;

export const LIMITS = {
  youtube: {
    titleMax: 100,
    descriptionMax: 5000,
    shortsMaxDurationS: 180,
    maxSizeBytes: 256 * 1024 * MB,
  },
  instagram: {
    captionMax: 2200,
    hashtagMax: 30,
    reelMinDurationS: 3,
    reelMaxDurationS: 15 * 60,
    storyMaxDurationS: 60,
    videoMaxBytes: 300 * MB,
    imageMaxBytes: 8 * MB,
    imageMinAspect: 4 / 5,
    imageMaxAspect: 1.91,
  },
  tiktok: {
    captionMax: 2200,
    minDurationS: 3,
    defaultMaxDurationS: 600,
    maxSizeBytes: 4 * 1024 * MB,
    photoMime: ["image/jpeg", "image/webp"],
    photoMaxBytes: 20 * MB,
    photoTitleMax: 90,
    photosMax: 35,
  },
  instagramCarousel: { min: 2, max: 10 },
} as const;

export const CAPTION_MAX: Record<Platform, number> = {
  youtube: LIMITS.youtube.descriptionMax,
  instagram: LIMITS.instagram.captionMax,
  tiktok: LIMITS.tiktok.captionMax,
};

export const SUPPORTED_MIME = {
  video: ["video/mp4", "video/quicktime"],
  image: ["image/jpeg", "image/png", "image/webp"],
} as const;

function countHashtags(text: string): number {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function isVertical(media: MediaInfo): boolean {
  return !!media.width && !!media.height && media.height >= media.width;
}

/** Validates one target. `extra.tiktokMaxDurationS` comes from TikTok's creator_info. */
export function validateTarget(
  media: MediaInfo,
  caption: string,
  options: TargetOptions,
  extra: { tiktokMaxDurationS?: number } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const platform = options.platform;
  const push = (field: ValidationIssue["field"], message: string) => issues.push({ platform, field, message });
  const d = media.durationS ?? null;

  if (options.platform === "youtube") {
    const L = LIMITS.youtube;
    if (media.kind !== "video") push("media", "YouTube only accepts video.");
    if (media.sizeBytes > L.maxSizeBytes) push("media", "Video is larger than YouTube's 256 GB limit.");
    const title = options.youtube.title.trim();
    if (!title) push("title", "YouTube needs a title.");
    if (title.length > L.titleMax) push("title", `Title is ${title.length}/${L.titleMax} characters.`);
    if (/[<>]/.test(title)) push("title", "Title can't contain < or >.");
    const description = options.youtube.description ?? caption;
    if (new TextEncoder().encode(description).length > L.descriptionMax)
      push("caption", `Description is over YouTube's ${L.descriptionMax}-byte limit.`);
  }

  if (options.platform === "instagram") {
    const L = LIMITS.instagram;
    const { format } = options.instagram;
    if (caption.length > L.captionMax) push("caption", `Caption is ${caption.length}/${L.captionMax} characters.`);
    if (countHashtags(caption) > L.hashtagMax) push("caption", `Instagram allows at most ${L.hashtagMax} hashtags.`);
    if (format === "reel" && media.kind !== "video") push("media", "Reels need a video. Pick Post or Story for an image.");
    if (format === "post" && media.kind !== "image") push("media", "Use Reel for videos; Post is for a single photo.");
    if (media.kind === "video") {
      if (media.sizeBytes > L.videoMaxBytes) push("media", "Instagram videos must be 300 MB or smaller.");
      if (d !== null && d < L.reelMinDurationS) push("media", "Instagram videos must be at least 3 seconds.");
      const max = format === "story" ? L.storyMaxDurationS : L.reelMaxDurationS;
      if (d !== null && d > max) push("media", `Instagram ${format}s can be at most ${max / 60 >= 1 ? `${max / 60} min` : `${max} s`}.`);
    } else {
      if (media.mime !== "image/jpeg") push("media", "Instagram only accepts JPEG images.");
      if (media.sizeBytes > L.imageMaxBytes) push("media", "Instagram images must be 8 MB or smaller.");
      if (format === "post" && media.width && media.height) {
        const aspect = media.width / media.height;
        if (aspect < L.imageMinAspect - 0.01 || aspect > L.imageMaxAspect + 0.01)
          push("media", "Instagram photo posts must be between 4:5 and 1.91:1.");
      }
    }
  }

  if (options.platform === "tiktok") {
    const L = LIMITS.tiktok;
    if (caption.length > L.captionMax) push("caption", `Caption is ${caption.length}/${L.captionMax} characters.`);
    if (media.kind === "image") {
      if (!(L.photoMime as readonly string[]).includes(media.mime)) push("media", "TikTok photos must be JPEG or WebP.");
      if (media.sizeBytes > L.photoMaxBytes) push("media", "TikTok photos must be 20 MB or smaller.");
    } else {
      if (media.sizeBytes > L.maxSizeBytes) push("media", "TikTok videos must be 4 GB or smaller.");
      const max = extra.tiktokMaxDurationS ?? L.defaultMaxDurationS;
      if (d !== null && d > max) push("media", `Your TikTok account allows videos up to ${Math.floor(max / 60)} min.`);
      if (d !== null && d < L.minDurationS) push("media", "TikTok videos must be at least 3 seconds.");
    }
    if (!options.tiktok.privacyLevel) push("options", "Choose who can view this TikTok.");
    if (options.tiktok.brandedContent && options.tiktok.privacyLevel === "SELF_ONLY")
      push("options", "Branded content can't be private. Choose another visibility.");
  }

  return issues;
}

/** Rules about the set of media (carousels), on top of validateTarget for each item. */
export function validateItems(items: MediaInfo[], options: TargetOptions): ValidationIssue[] {
  const platform = options.platform;
  const issue = (message: string): ValidationIssue => ({ platform, field: "media", message });
  if (items.length <= 1) return [];
  if (items.some((m) => m.kind !== "image")) return [issue("Carousels can only contain photos.")];
  if (options.platform === "youtube") return [issue("YouTube can't post photo carousels. Post a video instead.")];
  if (options.platform === "instagram") {
    const { min, max } = LIMITS.instagramCarousel;
    if (options.instagram.format !== "post") return [issue("Instagram carousels must be posted as a Post.")];
    if (items.length < min || items.length > max) return [issue(`Instagram carousels hold ${min}–${max} photos.`)];
  }
  if (options.platform === "tiktok" && items.length > LIMITS.tiktok.photosMax) {
    return [issue(`TikTok photo posts hold up to ${LIMITS.tiktok.photosMax} photos.`)];
  }
  return [];
}

/** validateTarget for every item plus the carousel rules, without repeating identical issues. */
export function validateMedia(
  items: MediaInfo[],
  caption: string,
  options: TargetOptions,
  extra: { tiktokMaxDurationS?: number } = {},
): ValidationIssue[] {
  const all = [...items.flatMap((m) => validateTarget(m, caption, options, extra)), ...validateItems(items, options)];
  const seen = new Set<string>();
  return all.filter((i) => {
    const key = `${i.field}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
