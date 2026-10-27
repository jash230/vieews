import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyApiKey } from "@/lib/mcp/api-keys";
import { registerTools } from "@/lib/mcp/server";

export const maxDuration = 120;

const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "vieews", version: "0.1.0" },
});

const authed = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    const key = await verifyApiKey(bearerToken);
    if (!key) return undefined;
    return { token: bearerToken!, clientId: `api-key:${key.keyId}`, scopes: [], extra: { userId: key.userId } };
  },
  { required: true },
);

export { authed as GET, authed as POST, authed as DELETE };
