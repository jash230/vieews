import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/models";
import { signedReadUrls } from "@/lib/media/service";
import { kitGaps } from "@/lib/projects/kit";
import { getProject, listProjectAccounts, listProjectMedia } from "@/lib/projects/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MediaAssetRow } from "@/lib/types";
import { recordClaudeUsage } from "@/lib/usage/service";
import { appendRow, dropDeclinedBlocks, loadRows, toApiMessages } from "./history";
import { projectContext, STABLE_SYSTEM } from "./prompt";
import { takeUnreportedDecisions } from "./proposals";
import { runTool, TOOL_DEFINITIONS, toolLabel } from "./tools";
import type { ChatItem, CopilotEvent } from "./types";

/** Model calls per user message (each tool round is one). */
const MAX_ROUNDS = 8;
const MAX_ATTACHMENTS = 35;

export interface TurnInput {
  userId: string;
  projectId: string;
  text: string;
  attachments: string[];
  timeZone: string;
  signal?: AbortSignal;
}

function describeMedia(m: MediaAssetRow): string {
  const size = m.width && m.height ? `${m.width}x${m.height}` : "unknown size";
  const length = m.kind === "video" && m.duration_s ? `, ${Number(m.duration_s).toFixed(1)}s` : "";
  return `${m.kind} ${m.id} (${m.mime}, ${size}${length})`;
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return "The copilot is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError) return "The copilot isn't set up correctly (API key).";
  if (err instanceof Anthropic.APIError) return "The copilot hit a problem talking to the AI. Try again.";
  return err instanceof Error ? err.message : "Something went wrong";
}

/** Runs one user message through the model and its tools, yielding what the chat panel shows. */
export async function* runTurn(input: TurnInput): AsyncGenerator<CopilotEvent> {
  const { userId, projectId } = input;
  try {
    const project = await getProject(userId, projectId);

    const ids = [...new Set(input.attachments)].slice(0, MAX_ATTACHMENTS);
    const { data: mediaRows } = ids.length
      ? await supabaseAdmin().from("media_assets").select("*").eq("user_id", userId).in("id", ids)
      : { data: [] };
    const media = ((mediaRows ?? []) as MediaAssetRow[]).filter((m) => m.status === "ready");

    // Everything the model should know with this message goes into the stored user turn itself,
    // so the history is only ever appended to.
    const decisions = await takeUnreportedDecisions(userId, projectId);
    const now = new Date().toLocaleString("en-US", { timeZone: input.timeZone, dateStyle: "full", timeStyle: "short" });
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: "text", text: `[Now: ${now} (${input.timeZone})]` },
      ...(decisions.length ? [{ type: "text" as const, text: `[Since the last message: ${decisions.join(" ")}]` }] : []),
      ...(media.length ? [{ type: "text" as const, text: `[Attached: ${media.map(describeMedia).join("; ")}]` }] : []),
      { type: "text", text: input.text || "(no text)" },
    ];
    const userRowId = await appendRow(userId, projectId, "user", { content, display: { text: input.text, attachments: media.map((m) => m.id) } });

    const thumbPaths = media.map((m) => m.thumbnail_path ?? (m.kind === "image" ? m.storage_path : ""));
    const thumbs = await signedReadUrls(thumbPaths);
    const userItems: ChatItem[] = [];
    if (media.length) userItems.push({ kind: "attachments", media: media.map((m, i) => ({ id: m.id, kind: m.kind, thumbUrl: thumbs[thumbPaths[i]] ?? null })) });
    if (input.text) userItems.push({ kind: "text", text: input.text });
    yield { type: "user", message: { id: userRowId, role: "user", items: userItems } };

    const [accounts, projectMedia] = await Promise.all([listProjectAccounts(userId, projectId), listProjectMedia(userId, projectId)]);
    const system: Anthropic.Beta.BetaTextBlockParam[] = [
      { type: "text", text: STABLE_SYSTEM, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: projectContext(
          project,
          accounts.map((a) => ({ id: a.id, platform: a.platform, name: a.username ?? a.display_name, status: a.status })),
          kitGaps(project.kit, projectMedia.filter((m) => m.role === "screen").length),
        ),
      },
    ];
    const messages = toApiMessages(await loadRows(userId, projectId));

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = anthropic().beta.messages.stream(
        {
          model: MODELS.copilot,
          max_tokens: 16000,
          system,
          tools: TOOL_DEFINITIONS,
          messages,
          output_config: { effort: "medium" },
          cache_control: { type: "ephemeral" },
          // Retries a declined request on Anthropic's recommended fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal: input.signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield { type: "text", delta: event.delta.text };
      }
      const message = await stream.finalMessage();
      void recordClaudeUsage(userId, projectId, message.model, message.usage, "copilot");

      let assistant = dropDeclinedBlocks(message.content) as Anthropic.Beta.BetaContentBlockParam[];
      // A reply cut off by max_tokens can end in a half-written tool call that will never run.
      if (message.stop_reason === "max_tokens") assistant = assistant.filter((b) => b.type !== "tool_use");
      if (assistant.length) {
        await appendRow(userId, projectId, "assistant", { content: assistant });
        messages.push({ role: "assistant", content: assistant });
      }

      if (message.stop_reason === "refusal") {
        yield { type: "error", message: "I can't help with that one." };
        break;
      }
      if (message.stop_reason === "pause_turn") continue;

      if (message.stop_reason === "max_tokens") {
        yield { type: "error", message: "That answer ran too long. Try asking for less at once." };
        break;
      }
      const toolUses = assistant.filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use");
      if (!toolUses.length) break;

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      let changed = false;
      for (const call of toolUses) {
        const label = toolLabel(call.name, call.input);
        if (call.name !== "propose_post") yield { type: "tool", id: call.id, name: call.name, label, status: "running" };
        const outcome = await runTool({ userId, projectId, toolUseId: call.id }, call.name, call.input);
        changed ||= !!outcome.changed;
        if (outcome.proposal) {
          yield { type: "proposal", proposal: outcome.proposal };
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: "Shown to the user as an approval card. It's posted only if they approve; you'll be told their decision with their next message.",
          });
          continue;
        }
        const text = typeof outcome.result === "string" ? outcome.result : JSON.stringify(outcome.result);
        yield { type: "tool", id: call.id, name: call.name, label, status: outcome.isError ? "error" : "done", detail: outcome.isError ? text.slice(0, 300) : undefined };
        results.push({ type: "tool_result", tool_use_id: call.id, content: text, ...(outcome.isError ? { is_error: true } : {}) });
      }
      await appendRow(userId, projectId, "user", { content: results });
      messages.push({ role: "user", content: results });
      if (changed) yield { type: "changed" };
    }
  } catch (err) {
    if (input.signal?.aborted) return;
    console.error("copilot turn failed", err);
    yield { type: "error", message: friendlyError(err) };
  }
  yield { type: "done" };
}
