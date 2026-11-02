import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getAccount, getValidAccessToken, listAccounts } from "@/lib/accounts/service";
import { createMediaAsset, createSignedUpload, finalizeMediaAsset, importMediaFromUrl } from "@/lib/media/service";
import { LIMITS, SUPPORTED_MIME } from "@/lib/platforms/limits";
import { getCreatorInfo } from "@/lib/platforms/tiktok";
import { createPostSchema } from "@/lib/posts/schema";
import { cancelPost, createPost, getPost, listPosts, PostValidationError, retryTarget, type PostWithTargets } from "@/lib/posts/service";
import { getProject, listProjects } from "@/lib/projects/service";
import { projectSummary } from "@/lib/projects/summary";

type ToolCtx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

function userIdFrom(ctx: ToolCtx): string {
  const userId = ctx.http?.authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("Unauthorized");
  return userId;
}

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const fail = (err: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
});

function summarizePost(p: PostWithTargets) {
  return {
    id: p.id,
    project_id: p.project_id,
    status: p.status,
    caption: p.caption,
    scheduled_for: p.scheduled_for,
    created_at: p.created_at,
    source: p.source,
    campaign: p.campaign,
    meta: p.meta,
    media: { kind: p.media?.kind ?? null, items: p.items.length },
    targets: p.targets.map((t) => ({
      id: t.id,
      platform: t.platform,
      account: t.account?.username ?? t.account?.display_name,
      status: t.status,
      url: t.remote_url,
      error: t.error,
    })),
  };
}

/** Wraps a tool body with auth + error reporting. */
function tool<A>(fn: (args: A, userId: string) => Promise<unknown>) {
  return async (args: A, ctx: ToolCtx) => {
    try {
      return json(await fn(args, userIdFrom(ctx)));
    } catch (err) {
      return fail(err);
    }
  };
}

export function registerTools(server: McpServer) {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "Lists the user's projects (one per app they promote). Pass a project's id as projectId to create_post and list_posts.",
      inputSchema: z.object({}),
    },
    tool(async (_args: Record<string, never>, userId) =>
      (await listProjects(userId)).map((p) => ({ id: p.id, name: p.name, store_url: p.store_url, one_liner: p.kit.oneLiner })),
    ),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        "Returns a project's kit (audience, pains, claims ads may and may not make, CTA, brand), its screenshots with signed URLs and what each shows, and the accounts it posts to.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    tool(async ({ projectId }: { projectId: string }, userId) => projectSummary(userId, await getProject(userId, projectId))),
  );

  server.registerTool(
    "list_accounts",
    {
      title: "List connected accounts",
      description: "Lists the YouTube, Instagram and TikTok accounts connected to Vieews. Use the returned `id` as `accountId` in create_post.",
      inputSchema: z.object({}),
    },
    tool(async (_args, userId) => (await listAccounts(userId)).map(({ id, platform, username, display_name, status, last_error }) => ({ id, platform, username, display_name, status, last_error }))),
  );

  server.registerTool(
    "get_platform_requirements",
    {
      title: "Get platform requirements",
      description:
        "Returns media/caption limits for every platform. For a TikTok account, also returns the live creator info (allowed privacy levels, max duration) that TikTok requires before posting.",
      inputSchema: z.object({ tiktokAccountId: z.string().uuid().optional() }),
    },
    tool(async ({ tiktokAccountId }: { tiktokAccountId?: string }, userId) => {
      const result: Record<string, unknown> = { limits: LIMITS, supported_mime: SUPPORTED_MIME };
      if (tiktokAccountId) {
        const account = await getAccount(userId, tiktokAccountId);
        if (account.platform !== "tiktok") throw new Error("tiktokAccountId must be a TikTok account");
        result.tiktok_creator_info = await getCreatorInfo(await getValidAccessToken(account));
        result.tiktok_note = "Until TikTok audits this app, only SELF_ONLY (private) posts succeed.";
      }
      return result;
    }),
  );

  server.registerTool(
    "create_media_upload",
    {
      title: "Create media upload",
      description:
        "Step 1 of uploading a local file. Returns an asset_id and a signed upload_url. PUT the raw file bytes to upload_url (see `curl` in the result), then call finalize_media_upload.",
      inputSchema: z.object({
        mime: z.enum([...SUPPORTED_MIME.video, ...SUPPORTED_MIME.image]),
        sizeBytes: z.number().int().positive(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        durationS: z.number().positive().optional().describe("Video length in seconds (ffprobe). Enables duration checks."),
      }),
    },
    tool(async (args: { mime: string; sizeBytes: number; width?: number; height?: number; durationS?: number }, userId) => {
      const asset = await createMediaAsset(userId, args);
      const uploadUrl = await createSignedUpload(asset);
      return {
        asset_id: asset.id,
        upload_url: uploadUrl,
        curl: `curl -sS -X PUT -H "Content-Type: ${asset.mime}" --data-binary @<path-to-file> "${uploadUrl}"`,
        next: "After the upload succeeds, call finalize_media_upload with this asset_id.",
      };
    }),
  );

  server.registerTool(
    "finalize_media_upload",
    {
      title: "Finalize media upload",
      description: "Step 2 of uploading. Confirms the file reached storage and marks the asset ready to post.",
      inputSchema: z.object({
        assetId: z.string().uuid(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        durationS: z.number().positive().optional(),
      }),
    },
    tool(async ({ assetId, ...meta }: { assetId: string; width?: number; height?: number; durationS?: number }, userId) => {
      const asset = await finalizeMediaAsset(userId, assetId, meta);
      return { asset_id: asset.id, status: asset.status, kind: asset.kind, size_bytes: asset.size_bytes };
    }),
  );

  server.registerTool(
    "import_media_from_url",
    {
      title: "Import media from URL",
      description: "Downloads a public https URL (MP4/MOV/JPEG/PNG/WebP, up to 1 GB) into Vieews and returns a ready asset_id.",
      inputSchema: z.object({ url: z.string().url() }),
    },
    tool(async ({ url }: { url: string }, userId) => {
      const asset = await importMediaFromUrl(userId, url);
      return { asset_id: asset.id, status: asset.status, kind: asset.kind, mime: asset.mime, size_bytes: asset.size_bytes };
    }),
  );

  server.registerTool(
    "create_post",
    {
      title: "Create post",
      description: [
        "Publishes (or schedules, with scheduledFor as an ISO time with offset) media to one or more connected accounts.",
        "Pass mediaAssetId for one video or photo, or mediaAssetIds (in order) for a photo carousel:",
        "a TikTok photo post (1–35 JPEG/WebP) or an Instagram carousel (2–10 JPEGs, format post). YouTube needs a video.",
        "options per target: youtube {title, description?, tags?, privacy: public|unlisted|private, containsSyntheticMedia?};",
        "instagram {format: reel|post|story, shareToFeed?} (post = JPEG photo or carousel);",
        "tiktok {privacyLevel (from get_platform_requirements), disableComment, disableDuet, disableStitch, brandOrganic, brandedContent, isAigc?, autoAddMusic? (photo posts)}.",
        "Optional campaign (string) and meta (JSON) are stored with the post so you can find and learn from past posts with list_posts.",
        "Publishing runs in the background; poll get_post for per-platform results.",
      ].join(" "),
      inputSchema: createPostSchema,
    },
    tool(async (args: z.input<typeof createPostSchema>, userId) => {
      try {
        return summarizePost(await createPost(userId, args, "mcp"));
      } catch (err) {
        if (err instanceof PostValidationError) throw new Error(`Post is invalid:\n${err.message}`);
        throw err;
      }
    }),
  );

  server.registerTool(
    "get_post",
    {
      title: "Get post",
      description: "Returns a post with each platform's status, live URL or error.",
      inputSchema: z.object({ postId: z.string().uuid() }),
    },
    tool(async ({ postId }: { postId: string }, userId) => summarizePost(await getPost(userId, postId))),
  );

  server.registerTool(
    "list_posts",
    {
      title: "List posts",
      description:
        "Lists posts newest first, with their campaign and meta. Filter by status, campaign, or creation time (since, ISO). Page back by passing the oldest created_at you got as before.",
      inputSchema: z.object({
        status: z.array(z.enum(["scheduled", "publishing", "published", "partial", "failed", "canceled"])).optional(),
        projectId: z.string().uuid().optional().describe("Only this project's posts"),
        campaign: z.string().optional(),
        since: z.string().datetime({ offset: true }).optional(),
        before: z.string().datetime({ offset: true }).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    tool(
      async (
        args: {
          status?: ("scheduled" | "publishing" | "published" | "partial" | "failed" | "canceled")[];
          projectId?: string;
          campaign?: string;
          since?: string;
          before?: string;
          limit?: number;
        },
        userId,
      ) => (await listPosts(userId, args)).map(summarizePost),
    ),
  );

  server.registerTool(
    "cancel_post",
    {
      title: "Cancel scheduled post",
      description: "Cancels a post that is still scheduled. Posts already publishing can't be canceled.",
      inputSchema: z.object({ postId: z.string().uuid() }),
    },
    tool(async ({ postId }: { postId: string }, userId) => {
      await cancelPost(userId, postId);
      return { canceled: postId };
    }),
  );

  server.registerTool(
    "retry_post_target",
    {
      title: "Retry failed platform",
      description: "Retries one failed platform target of a post (target ids come from get_post).",
      inputSchema: z.object({ targetId: z.string().uuid() }),
    },
    tool(async ({ targetId }: { targetId: string }, userId) => {
      await retryTarget(userId, targetId);
      return { retrying: targetId };
    }),
  );
}

