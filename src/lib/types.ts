export const PLATFORMS = ["youtube", "instagram", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type AccountStatus = "active" | "needs_reauth";
export type PostStatus = "scheduled" | "publishing" | "published" | "partial" | "failed" | "canceled";
export type TargetStatus = "pending" | "uploading" | "processing" | "published" | "failed" | "canceled";
export type MediaKind = "video" | "image";

export interface SocialAccountRow {
  id: string;
  user_id: string;
  platform: Platform;
  platform_account_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  refresh_expires_at: string | null;
  scopes: string[];
  status: AccountStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Account fields that are safe to send to the browser or an MCP client. */
export type PublicAccount = Pick<
  SocialAccountRow,
  "id" | "platform" | "platform_account_id" | "username" | "display_name" | "avatar_url" | "status" | "last_error" | "created_at"
>;

export const PUBLIC_ACCOUNT_COLUMNS =
  "id, platform, platform_account_id, username, display_name, avatar_url, status, last_error, created_at";

export interface MediaAssetRow {
  id: string;
  user_id: string;
  storage_path: string;
  kind: MediaKind;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  thumbnail_path: string | null;
  status: "pending" | "ready";
  /** Set once the stored file was deleted to free space; the row and thumbnail stay. */
  purged_at: string | null;
  created_at: string;
}

export interface YouTubeOptions {
  title: string;
  description?: string;
  tags?: string[];
  privacy: "public" | "unlisted" | "private";
  madeForKids?: boolean;
  /** YouTube's "altered or synthetic content" disclosure. */
  containsSyntheticMedia?: boolean;
}

export interface InstagramOptions {
  format: "reel" | "post" | "story";
  shareToFeed?: boolean;
}

export interface TikTokOptions {
  privacyLevel: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  /** Promoting your own business. */
  brandOrganic: boolean;
  /** Paid partnership with a third party. */
  brandedContent: boolean;
  isAigc?: boolean;
  /** Photo posts only: let TikTok add recommended music. */
  autoAddMusic?: boolean;
}

export type TargetOptions =
  | { platform: "youtube"; youtube: YouTubeOptions }
  | { platform: "instagram"; instagram: InstagramOptions }
  | { platform: "tiktok"; tiktok: TikTokOptions };

export interface PostRow {
  id: string;
  user_id: string;
  caption: string;
  media_asset_id: string;
  scheduled_for: string | null;
  status: PostStatus;
  source: "web" | "mcp";
  /** Free-form grouping, e.g. "ad-studio:myapp". */
  campaign: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PostMediaRow {
  post_id: string;
  media_asset_id: string;
  position: number;
}

export interface PostTargetRow {
  id: string;
  post_id: string;
  user_id: string;
  social_account_id: string;
  platform: Platform;
  options: TargetOptions;
  caption_override: string | null;
  status: TargetStatus;
  remote_id: string | null;
  remote_url: string | null;
  error: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
