// Shapes shared by the copilot API and the chat panel. No server imports here.

export type ProposalStatus = "pending" | "approved" | "declined" | "failed";

export interface PostProposalInput {
  mediaAssetIds: string[];
  caption: string;
  scheduledFor?: string | null;
  targets: { accountId: string; captionOverride?: string | null; options: Record<string, unknown> & { platform: string } }[];
  /** Why the copilot suggests this, in a sentence. */
  reason?: string;
}

export interface ProposalView {
  id: string;
  toolUseId: string;
  kind: "post";
  input: PostProposalInput;
  status: ProposalStatus;
  /** On approval: the created post's id. On failure: the error. */
  result: { postId?: string; error?: string } | null;
  /** Labels the card needs, resolved on the server. */
  accounts: Record<string, { platform: string; name: string }>;
  media: { id: string; kind: "video" | "image"; thumbUrl: string | null }[];
}

export type ChatItem =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; label: string; status: "running" | "done" | "error"; detail?: string }
  | { kind: "proposal"; proposal: ProposalView }
  | { kind: "attachments"; media: { id: string; kind: "video" | "image"; thumbUrl: string | null }[] };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  items: ChatItem[];
}

/** One line of the NDJSON stream /api/copilot sends while a turn runs. */
export type CopilotEvent =
  | { type: "user"; message: ChatMessage }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; label: string; status: "running" | "done" | "error"; detail?: string }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "changed" }
  | { type: "error"; message: string }
  | { type: "done" };
