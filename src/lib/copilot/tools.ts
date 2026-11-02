import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAccount, getValidAccessToken, listAccounts } from "@/lib/accounts/service";
import { LIMITS, SUPPORTED_MIME } from "@/lib/platforms/limits";
import { getCreatorInfo } from "@/lib/platforms/tiktok";
import { createPostSchema } from "@/lib/posts/schema";
import { cancelPost, getPost, listPosts, retryTarget, type PostWithTargets } from "@/lib/posts/service";
import { createProjectFromLink } from "@/lib/projects/create-from-link";
import { projectKitSchema } from "@/lib/projects/kit";
import { getProject, projectAccountIds, setProjectAccounts, updateProject } from "@/lib/projects/service";
import { projectSummary } from "@/lib/projects/summary";
import { createPostProposal } from "./proposals";
import type { ProposalView } from "./types";

// The copilot's tools. Each one wraps the same service the MCP server and the UI call, scoped to the
// signed-in user and the chat's project. The model never supplies userId or projectId: those come
// from the session, so a tool call can't reach another user's or project's data.

export interface ToolContext {
  userId: string;
  projectId: string;
  /** The tool_use block being run; proposals are keyed by it. */
  toolUseId?: string;
}

export interface ToolOutcome {
  /** What goes back to the model as the tool_result. */
  result: unknown;
  /** True when the tool changed data the workspace shows, so the page should refresh. */
  changed?: boolean;
  /** Set by propose_post: the card to show. */
  proposal?: ProposalView;
}

interface ToolDef<S extends z.ZodType> {
  description: string;
  schema: S;
  /** Short status line for the chat, e.g. "Updating the project". */
  label: (input: z.infer<S>) => string;
  run: (ctx: ToolContext, input: z.infer<S>) => Promise<ToolOutcome>;
}

const def = <S extends z.ZodType>(d: ToolDef<S>) => d;

function summarizePost(p: PostWithTargets) {
  return {
    id: p.id,
    status: p.status,
    caption: p.caption,
    scheduled_for: p.scheduled_for,
    created_at: p.created_at,
    meta: p.meta,
    media: { kind: p.media?.kind ?? null, items: p.items.length },
    targets: p.targets.map((t) => ({ id: t.id, platform: t.platform, status: t.status, url: t.remote_url, error: t.error })),
  };
}

const kitPatch = projectKitSchema.partial().omit({ magicMoment: true }).extend({
  magicMomentDescription: z.string().optional(),
});

export const TOOLS = {
  get_project: def({
    description:
      "Returns this project's kit (audience, pains, outcomes, claims ads may and may not make, CTA, brand), notes, what's still missing, its screenshots (with what each shows) and the accounts it posts to.",
    schema: z.strictObject({}),
    label: () => "Reading the project",
    run: async (ctx) => ({ result: await projectSummary(ctx.userId, await getProject(ctx.userId, ctx.projectId)) }),
  }),

  update_project: def({
    description:
      "Changes this project's name, notes or kit fields. Only send the fields to change; lists replace the old list. Only record claims the user confirmed are true.",
    schema: z.strictObject({
      name: z.string().min(1).max(80).optional(),
      notes: z.string().max(4000).optional(),
      kit: kitPatch.optional(),
    }),
    label: () => "Updating the project",
    run: async (ctx, input) => {
      const current = await getProject(ctx.userId, ctx.projectId);
      const { magicMomentDescription, ...kit } = input.kit ?? {};
      const updated = await updateProject(ctx.userId, ctx.projectId, {
        name: input.name,
        notes: input.notes,
        kit: input.kit
          ? { ...kit, ...(magicMomentDescription !== undefined ? { magicMoment: { ...current.kit.magicMoment, description: magicMomentDescription } } : {}) }
          : undefined,
      });
      return { result: { ok: true, name: updated.name, kit: updated.kit }, changed: true };
    },
  }),

  create_project_from_link: def({
    description:
      "Sets up a NEW project for another app from its App Store, Google Play or website link (copies screenshots, drafts the kit). This chat stays on the current project; tell the user they can switch with the project menu.",
    schema: z.strictObject({ link: z.string().min(4).max(2000) }),
    label: () => "Setting up the new project",
    run: async (ctx, { link }) => {
      const { project, warnings } = await createProjectFromLink(ctx.userId, link);
      return { result: { project_id: project.id, name: project.name, one_liner: project.kit.oneLiner, warnings }, changed: true };
    },
  }),

  list_accounts: def({
    description: "Lists every social account the user connected, and whether each one posts for this project.",
    schema: z.strictObject({}),
    label: () => "Checking accounts",
    run: async (ctx) => {
      const [accounts, linked] = await Promise.all([listAccounts(ctx.userId), projectAccountIds(ctx.userId, ctx.projectId)]);
      const on = new Set(linked);
      return {
        result: accounts.map((a) => ({
          id: a.id,
          platform: a.platform,
          name: a.username ?? a.display_name,
          status: a.status,
          posts_for_this_project: on.has(a.id),
        })),
      };
    },
  }),

  set_project_accounts: def({
    description: "Sets which connected accounts post for this project (replaces the list). Use ids from list_accounts.",
    schema: z.strictObject({ accountIds: z.array(z.string().uuid()).max(30) }),
    label: () => "Choosing accounts",
    run: async (ctx, { accountIds }) => {
      const accounts = await setProjectAccounts(ctx.userId, ctx.projectId, accountIds);
      return { result: accounts.map((a) => ({ id: a.id, platform: a.platform, name: a.username ?? a.display_name })), changed: true };
    },
  }),

  get_platform_requirements: def({
    description:
      "Media and caption limits for every platform. Pass a TikTok account id to get its live creator info (allowed privacy levels, max video length), which a TikTok post needs.",
    schema: z.strictObject({ tiktokAccountId: z.string().uuid().optional() }),
    label: () => "Checking platform rules",
    run: async (ctx, { tiktokAccountId }) => {
      const result: Record<string, unknown> = { limits: LIMITS, supported_mime: SUPPORTED_MIME };
      if (tiktokAccountId) {
        const account = await getAccount(ctx.userId, tiktokAccountId);
        if (account.platform !== "tiktok") throw new Error("tiktokAccountId must be a TikTok account");
        result.tiktok_creator_info = await getCreatorInfo(await getValidAccessToken(account));
        result.tiktok_note = "Until TikTok audits Vieews, only SELF_ONLY (private) posts succeed.";
      }
      return { result };
    },
  }),

  list_posts: def({
    description: "Lists this project's posts, newest first (or soonest first for scheduled), with each platform's status, URL or error.",
    schema: z.strictObject({
      status: z.array(z.enum(["scheduled", "publishing", "published", "partial", "failed", "canceled"])).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    label: () => "Looking at posts",
    run: async (ctx, { status, limit }) => {
      const upcoming = status?.length === 1 && status[0] === "scheduled";
      const posts = await listPosts(ctx.userId, { projectId: ctx.projectId, status, upcoming, limit: limit ?? 20 });
      return { result: posts.map(summarizePost) };
    },
  }),

  get_post: def({
    description: "One post with each platform's status, live URL or error.",
    schema: z.strictObject({ postId: z.string().uuid() }),
    label: () => "Opening the post",
    run: async (ctx, { postId }) => {
      const post = await getPost(ctx.userId, postId);
      if (post.project_id !== ctx.projectId) throw new Error("That post belongs to another project");
      return { result: summarizePost(post) };
    },
  }),

  cancel_post: def({
    description: "Cancels a post that is still scheduled. Only when the user asked to cancel it.",
    schema: z.strictObject({ postId: z.string().uuid() }),
    label: () => "Canceling the post",
    run: async (ctx, { postId }) => {
      const post = await getPost(ctx.userId, postId);
      if (post.project_id !== ctx.projectId) throw new Error("That post belongs to another project");
      await cancelPost(ctx.userId, postId);
      return { result: { ok: true }, changed: true };
    },
  }),

  retry_post_target: def({
    description: "Retries one platform of a post that failed there (targetId from get_post). Only when the user asked.",
    schema: z.strictObject({ postId: z.string().uuid(), targetId: z.string().uuid() }),
    label: () => "Retrying the post",
    run: async (ctx, { postId, targetId }) => {
      const post = await getPost(ctx.userId, postId);
      if (post.project_id !== ctx.projectId || !post.targets.some((t) => t.id === targetId)) throw new Error("That post isn't in this project");
      await retryTarget(ctx.userId, targetId);
      return { result: { ok: true }, changed: true };
    },
  }),

  propose_post: def({
    description: [
      "Shows the user an approval card for a post. Nothing is published unless they press Approve, so never claim it's posted.",
      "Use media asset ids the user attached. Targets must be accounts that post for this project.",
      "options per target: {platform:'youtube', youtube:{title, description?, tags?, privacy: public|unlisted|private, containsSyntheticMedia?}}",
      "| {platform:'instagram', instagram:{format: reel|post|story, shareToFeed?}}",
      "| {platform:'tiktok', tiktok:{privacyLevel (from get_platform_requirements), disableComment, disableDuet, disableStitch, brandOrganic, brandedContent, isAigc?, autoAddMusic?}}.",
      "scheduledFor is an ISO time with offset in the user's time zone, or omit to post right away.",
    ].join(" "),
    schema: z.strictObject({
      mediaAssetIds: z.array(z.string().uuid()).min(1).max(35),
      caption: z.string().max(5000),
      scheduledFor: z.string().datetime({ offset: true }).nullish(),
      targets: createPostSchema.shape.targets,
      reason: z.string().max(300).optional(),
    }),
    label: () => "Preparing a post for your approval",
    run: async (ctx, input) => ({ result: null, proposal: await createPostProposal(ctx, input) }),
  }),
} satisfies Record<string, ToolDef<z.ZodType>>;

export type ToolName = keyof typeof TOOLS;

function inputSchemaOf(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const json = { ...(z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>) };
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
}

/** Tool definitions for the Messages API, in a fixed order so the prompt cache stays warm. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = Object.entries(TOOLS).map(([name, t]) => ({
  name,
  description: t.description,
  input_schema: inputSchemaOf(t.schema),
  eager_input_streaming: true,
}));

export const isToolName = (name: string): name is ToolName => Object.hasOwn(TOOLS, name);

export function toolLabel(name: string, input: unknown): string {
  if (!isToolName(name)) return name;
  const tool = TOOLS[name] as ToolDef<z.ZodType>;
  const parsed = tool.schema.safeParse(input);
  return parsed.success ? tool.label(parsed.data) : tool.label({} as never);
}

/**
 * Validates the model's input against the tool's schema, then runs it. Streaming tool inputs aren't
 * validated by the API, so a malformed input comes back to the model as an error to fix.
 */
export async function runTool(ctx: ToolContext, name: string, input: unknown): Promise<ToolOutcome & { isError?: boolean }> {
  if (!isToolName(name)) return { result: `Unknown tool ${name}`, isError: true };
  const tool = TOOLS[name] as ToolDef<z.ZodType>;
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return { result: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`, isError: true };
  }
  try {
    return await tool.run(ctx, parsed.data);
  } catch (err) {
    return { result: err instanceof Error ? err.message : String(err), isError: true };
  }
}
