import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { STUDIO_ROOT } from "./kit";

export const configSchema = z.object({
  /** Kill switch: when true, runs stop before making anything. */
  paused: z.boolean().default(false),
  /** Kits (folder names under apps/) that runs make ads for. */
  apps: z.array(z.string()).default([]),
  /** Used for "ads today" and schedules. */
  timezone: z.string().default("UTC"),
  /** "all" active accounts in Vieews, or specific Vieews account ids. */
  accounts: z.union([z.literal("all"), z.array(z.string().uuid())]).default("all"),
  youtubePrivacy: z.enum(["public", "unlisted", "private"]).default("public"),
  /** most-public: the widest visibility TikTok allows the account (only "Only me" until TikTok audits Vieews). */
  tiktokPrivacy: z.enum(["most-public", "SELF_ONLY"]).default("most-public"),
  /** Workers AI free allowance is 10,000 neurons/day; keep headroom. */
  dailyNeuronBudget: z.number().int().min(0).default(9000),
  imageModel: z.enum(["@cf/black-forest-labs/flux-2-klein-4b", "@cf/black-forest-labs/flux-1-schnell"]).default("@cf/black-forest-labs/flux-2-klein-4b"),
  voice: z.string().default("af_heart"),
});
export type Config = z.infer<typeof configSchema>;

export function loadConfig(path = join(STUDIO_ROOT, "config.json")): Config {
  const raw = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  return configSchema.parse(raw);
}
