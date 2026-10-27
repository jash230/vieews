import { siInstagram, siTiktok, siYoutube } from "simple-icons";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

export const PLATFORM_META: Record<Platform, { label: string; path: string; tint: string; text: string }> = {
  youtube: { label: "YouTube", path: siYoutube.path, tint: "bg-[#fff0f0]", text: "text-youtube" },
  instagram: { label: "Instagram", path: siInstagram.path, tint: "bg-[#fff0f6]", text: "text-instagram" },
  tiktok: { label: "TikTok", path: siTiktok.path, tint: "bg-muted", text: "text-tiktok" },
};

export function PlatformIcon({ platform, className, title }: { platform: Platform; className?: string; title?: string }) {
  const meta = PLATFORM_META[platform];
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4 fill-current", meta.text, className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d={meta.path} />
    </svg>
  );
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const meta = PLATFORM_META[platform];
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", meta.tint, className)}>
      <PlatformIcon platform={platform} className="size-[18px]" title={meta.label} />
    </span>
  );
}
