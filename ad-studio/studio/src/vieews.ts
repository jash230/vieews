import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

/**
 * Talks to the Vieews MCP server. Locally, set VIEEWS_API_KEY. In a Claude Code cloud
 * environment, store the key as a network secret for the Vieews host instead: the proxy adds
 * the Authorization header and the key never enters the VM.
 */
export const VIEEWS_MCP_URL = process.env.VIEEWS_MCP_URL ?? "https://vieews.vercel.app/api/mcp";

export type Vieews = { call<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>; close(): Promise<void> };

export async function connectVieews(url = VIEEWS_MCP_URL): Promise<Vieews> {
  const key = process.env.VIEEWS_API_KEY;
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: key ? { headers: { Authorization: `Bearer ${key}` } } : undefined,
  });
  const client = new Client({ name: "ad-studio", version: "0.1.0" });
  try {
    await client.connect(transport);
  } catch (err) {
    throw new Error(`Couldn't reach Vieews at ${url}: ${err instanceof Error ? err.message : err}. Locally, set VIEEWS_API_KEY; in the cloud, add the key as a network secret for ${new URL(url).host}.`);
  }
  return {
    async call<T>(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "";
      if (result.isError) throw new Error(`Vieews ${name}: ${text}`);
      return JSON.parse(text) as T;
    },
    close: () => client.close(),
  };
}

const PAGE = 100;

/** Every post since `since`, newest first (pages through list_posts). */
export async function listPostsSince(vieews: Vieews, since: string, extra: Record<string, unknown> = {}): Promise<unknown[]> {
  const all: { created_at: string }[] = [];
  let before: string | undefined;
  for (let page = 0; page < 50; page++) {
    const posts = await vieews.call<{ created_at: string }[]>("list_posts", { since, limit: PAGE, ...(before && { before }), ...extra });
    all.push(...posts);
    if (posts.length < PAGE) break;
    before = posts[posts.length - 1].created_at;
  }
  return all;
}
