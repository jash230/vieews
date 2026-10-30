import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { signedReadUrls } from "@/lib/media/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MediaAssetRow } from "@/lib/types";
import { listProposals } from "./proposals";
import { toolLabel } from "./tools";
import type { ChatItem, ChatMessage, ProposalView } from "./types";

// The copilot's conversation, one per project. Rows hold the exact content blocks sent to and
// received from the API (thinking blocks included), so replaying them keeps the history append-only.

type Block = Anthropic.Beta.BetaContentBlockParam;

interface StoredParts {
  content: Block[];
  /** What the user typed and attached, for the chat panel. Absent on tool-result rows. */
  display?: { text: string; attachments: string[] };
}

interface MessageRow {
  id: string;
  role: "user" | "assistant";
  parts: StoredParts;
  created_at: string;
}

/** How many rows are replayed to the model. Older turns stay visible in the panel. */
const REPLAY_ROWS = 80;

export async function loadRows(userId: string, projectId: string): Promise<MessageRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("copilot_messages")
    .select("id, role, parts, created_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at")
    .order("id");
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function appendRow(userId: string, projectId: string, role: "user" | "assistant", parts: StoredParts): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("copilot_messages")
    .insert({ user_id: userId, project_id: projectId, role, parts })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** The rows to send, starting at a message the user typed so tool results never lose their call. */
export function toApiMessages(rows: MessageRow[]): Anthropic.Beta.BetaMessageParam[] {
  let start = Math.max(0, rows.length - REPLAY_ROWS);
  while (start < rows.length && !(rows[start].role === "user" && rows[start].parts.display)) start++;
  return rows.slice(start).map((r) => ({ role: r.role, content: r.parts.content }));
}

/**
 * After a mid-answer fallback to another model, the blocks before the last `fallback` marker that
 * aren't plain text (thinking, tool calls) belong to the declined attempt and must not be replayed.
 */
export function dropDeclinedBlocks<T extends { type: string }>(content: T[]): T[] {
  const boundary = content.map((b) => b.type).lastIndexOf("fallback");
  if (boundary < 0) return content;
  return content.filter((b, i) => i >= boundary || b.type === "text");
}

async function mediaThumbs(userId: string, ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; kind: "video" | "image"; thumbUrl: string | null }>();
  const { data } = await supabaseAdmin().from("media_assets").select("*").eq("user_id", userId).in("id", ids);
  const media = (data ?? []) as MediaAssetRow[];
  const pathOf = (m: MediaAssetRow) => m.thumbnail_path ?? (m.kind === "image" ? m.storage_path : "");
  const urls = await signedReadUrls(media.map(pathOf));
  return new Map(media.map((m) => [m.id, { id: m.id, kind: m.kind, thumbUrl: urls[pathOf(m)] ?? null }]));
}

/** The conversation as the chat panel shows it. */
export async function loadChat(userId: string, projectId: string): Promise<ChatMessage[]> {
  const [rows, proposals] = await Promise.all([loadRows(userId, projectId), listProposals(userId, projectId)]);
  const byToolUse = new Map<string, ProposalView>(proposals.map((p) => [p.toolUseId, p]));
  const results = new Map<string, { isError: boolean; text: string }>();
  for (const r of rows) {
    if (r.role !== "user") continue;
    for (const b of r.parts.content) {
      if (b.type === "tool_result") {
        const text = typeof b.content === "string" ? b.content : "";
        results.set(b.tool_use_id, { isError: !!b.is_error, text });
      }
    }
  }
  const thumbs = await mediaThumbs(userId, [...new Set(rows.flatMap((r) => r.parts.display?.attachments ?? []))]);

  const messages: ChatMessage[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      if (!r.parts.display) continue;
      const items: ChatItem[] = [];
      const media = r.parts.display.attachments.flatMap((id) => (thumbs.has(id) ? [thumbs.get(id)!] : []));
      if (media.length) items.push({ kind: "attachments", media });
      if (r.parts.display.text) items.push({ kind: "text", text: r.parts.display.text });
      messages.push({ id: r.id, role: "user", items });
      continue;
    }
    const items: ChatItem[] = [];
    for (const b of r.parts.content) {
      if (b.type === "text" && b.text.trim()) items.push({ kind: "text", text: b.text });
      if (b.type === "tool_use") {
        const proposal = byToolUse.get(b.id);
        if (proposal) {
          items.push({ kind: "proposal", proposal });
          continue;
        }
        const res = results.get(b.id);
        items.push({
          kind: "tool",
          id: b.id,
          name: b.name,
          label: toolLabel(b.name, b.input),
          status: !res ? "error" : res.isError ? "error" : "done",
          detail: res?.isError ? res.text.slice(0, 300) : undefined,
        });
      }
    }
    if (!items.length) continue;
    // One assistant turn can span several rows (one per model call in the tool loop).
    const last = messages.at(-1);
    if (last?.role === "assistant") last.items.push(...items);
    else messages.push({ id: r.id, role: "assistant", items });
  }
  return messages;
}

export type { MessageRow, StoredParts };
