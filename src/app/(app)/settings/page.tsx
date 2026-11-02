import { auth } from "@clerk/nextjs/server";
import { formatDistanceToNow } from "date-fns";
import { Bot } from "lucide-react";
import { Suspense } from "react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { env } from "@/lib/env";
import { listApiKeys } from "@/lib/mcp/api-keys";
import { ApiKeyManager } from "./api-key-manager";

export const metadata = { title: "AI & API keys" };

const TOOLS = [
  ["list_accounts", "See which accounts are connected"],
  ["create_media_upload", "Get a signed URL to upload a local video or image"],
  ["import_media_from_url", "Pull media from a public link"],
  ["create_post", "Publish now or schedule for later"],
  ["get_post / list_posts", "Check per-platform results"],
  ["cancel_post / retry_post_target", "Fix scheduling mistakes and failures"],
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="AI & API keys" description="Let Claude or another MCP client upload and post for you." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Suspense fallback={<ApiKeysSkeleton />}>
          <ApiKeys />
        </Suspense>
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Bot className="size-[18px]" aria-hidden /></span>
              <div>
                <CardTitle>What the AI can do</CardTitle>
                <CardDescription>MCP tools exposed at /api/mcp</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {TOOLS.map(([name, desc]) => (
                <li key={name}>
                  <code className="text-[13px] font-semibold text-foreground">{name}</code>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function ApiKeysSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}

async function ApiKeys() {
  const { userId } = await auth.protect();
  const keys = await listApiKeys(userId);
  const mcpUrl = `${env.appUrl()}/api/mcp`;

  return (
    <ApiKeyManager
      mcpUrl={mcpUrl}
      keys={keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.key_prefix,
        created: formatDistanceToNow(new Date(k.created_at), { addSuffix: true }),
        lastUsed: k.last_used_at ? formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true }) : null,
      }))}
    />
  );
}
