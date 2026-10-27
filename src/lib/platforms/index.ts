import type { Platform } from "@/lib/types";
import { instagram } from "./instagram";
import { tiktok } from "./tiktok";
import type { PlatformAdapter } from "./types";
import { youtube } from "./youtube";

export const adapters: Record<Platform, PlatformAdapter> = { youtube, instagram, tiktok };

export function adapterFor(platform: string): PlatformAdapter | null {
  return platform in adapters ? adapters[platform as Platform] : null;
}
