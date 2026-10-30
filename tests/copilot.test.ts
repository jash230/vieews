import { beforeEach, describe, expect, it, vi } from "vitest";

const createPost = vi.fn();
const createPostProposal = vi.fn();
const getPost = vi.fn();

vi.mock("@/lib/posts/service", () => ({ createPost, getPost, cancelPost: vi.fn(), listPosts: vi.fn(), retryTarget: vi.fn() }));
vi.mock("@/lib/copilot/proposals", () => ({ createPostProposal }));

const { runTool, TOOL_DEFINITIONS } = await import("@/lib/copilot/tools");
const { dropDeclinedBlocks, toApiMessages } = await import("@/lib/copilot/history");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ctx = { userId: "user_a", projectId: id(1), toolUseId: "toolu_1" };

beforeEach(() => vi.clearAllMocks());

describe("copilot tools", () => {
  it("rejects a userId or projectId the model tries to pass", async () => {
    const res = await runTool(ctx, "get_post", { postId: id(5), userId: "user_b" });
    expect(res.isError).toBe(true);
    expect(getPost).not.toHaveBeenCalled();
    const res2 = await runTool(ctx, "list_posts", { projectId: id(2) });
    expect(res2.isError).toBe(true);
  });

  it("won't open another project's post", async () => {
    getPost.mockResolvedValue({ id: id(5), project_id: id(2), targets: [], items: [] });
    const res = await runTool(ctx, "get_post", { postId: id(5) });
    expect(res).toMatchObject({ isError: true, result: expect.stringMatching(/another project/) });
  });

  it("proposes a post instead of posting it", async () => {
    createPostProposal.mockResolvedValue({ id: "p1" });
    const input = {
      mediaAssetIds: [id(3)],
      caption: "hi",
      targets: [{ accountId: id(4), options: { platform: "instagram", instagram: { format: "reel" } } }],
    };
    const res = await runTool(ctx, "propose_post", input);
    expect(res.proposal).toEqual({ id: "p1" });
    expect(createPostProposal).toHaveBeenCalledWith(ctx, expect.objectContaining({ caption: "hi" }));
    expect(createPost).not.toHaveBeenCalled();
  });

  it("returns unknown tools and bad input to the model as errors", async () => {
    expect((await runTool(ctx, "delete_everything", {})).isError).toBe(true);
    expect((await runTool(ctx, "get_post", { postId: "nope" })).isError).toBe(true);
  });

  it("describes every tool with an object schema", () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema).not.toHaveProperty("$schema");
    }
  });
});

describe("copilot history", () => {
  const user = (text: string, display = true) => ({ id: text, role: "user" as const, created_at: "", parts: { content: [{ type: "text" as const, text }], ...(display ? { display: { text, attachments: [] } } : {}) } });
  const assistant = (text: string) => ({ id: text, role: "assistant" as const, created_at: "", parts: { content: [{ type: "text" as const, text }] } });

  it("replays from a message the user typed", () => {
    const rows = [user("a"), assistant("b"), user("results", false), assistant("c"), user("d")];
    expect(toApiMessages(rows).map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
  });

  it("drops the declined attempt's thinking and tool calls before a fallback", () => {
    const content = [
      { type: "thinking" },
      { type: "text", text: "partial" },
      { type: "tool_use" },
      { type: "fallback" },
      { type: "thinking" },
      { type: "text", text: "done" },
    ];
    expect(dropDeclinedBlocks(content).map((b) => b.type)).toEqual(["text", "fallback", "thinking", "text"]);
    expect(dropDeclinedBlocks([{ type: "thinking" }, { type: "text" }])).toHaveLength(2);
  });
});

describe("closeOrphanedToolCalls", async () => {
  const { closeOrphanedToolCalls } = await import("@/lib/copilot/history");
  type Msg = Parameters<typeof closeOrphanedToolCalls>[0][number];
  const call = (id: string) => ({ type: "tool_use" as const, id, name: "get_post", input: {} });

  it("answers a tool call that never got a result, ahead of the next user text", () => {
    const msgs: Msg[] = [
      { role: "user", content: [{ type: "text", text: "hi" }] },
      { role: "assistant", content: [call("t1")] },
      { role: "user", content: [{ type: "text", text: "again" }] },
    ];
    const out = closeOrphanedToolCalls(msgs);
    expect(out).toHaveLength(3);
    const next = out[2].content as { type: string; tool_use_id?: string }[];
    expect(next.map((b) => b.type)).toEqual(["tool_result", "text"]);
    expect(next[0].tool_use_id).toBe("t1");
  });

  it("only fills the results that are missing", () => {
    const msgs: Msg[] = [
      { role: "assistant", content: [call("a"), call("b")] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "ok" }] },
    ];
    const ids = (closeOrphanedToolCalls(msgs)[1].content as { tool_use_id: string }[]).map((b) => b.tool_use_id);
    expect(ids.sort()).toEqual(["a", "b"]);
  });

  it("leaves complete histories alone", () => {
    const msgs: Msg[] = [
      { role: "assistant", content: [call("a")] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "ok" }] },
      { role: "assistant", content: [{ type: "text", text: "done" }] },
    ];
    expect(closeOrphanedToolCalls(msgs)).toEqual(msgs);
  });
});
