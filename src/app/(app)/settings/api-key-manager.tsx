"use client";

import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { EmptyState, Notice } from "@/components/ui/misc";
import { createApiKeyAction, revokeApiKeyAction } from "../actions";

interface KeyView {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string | null;
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="relative">
        <pre className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-3.5 pr-14 text-[13px] leading-relaxed [overflow-wrap:anywhere]"><code>{text}</code></pre>
        <button
          type="button"
          aria-label={copied ? "Copied" : `Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setFailed(true);
            }
            setTimeout(() => {
              setCopied(false);
              setFailed(false);
            }, 2000);
          }}
          className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      </div>
      <p role="status" className={failed ? "mt-1 text-xs text-destructive" : "sr-only"}>
        {failed ? "Couldn't copy. Select the text and copy it by hand." : copied ? "Copied" : ""}
      </p>
    </div>
  );
}

/** Its own pending state, so revoking one key doesn't spin the Create button or show errors under it. */
function RevokeButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="shrink-0 text-right">
      <Button
        variant="destructive"
        size="sm"
        loading={pending}
        onClick={() => {
          if (!confirm(`Revoke "${name}"? Anything using it will stop working.`)) return;
          setError(null);
          start(async () => {
            const res = await revokeApiKeyAction(id);
            if (!res.ok) setError(res.error);
          });
        }}
      >
        <Trash2 aria-hidden /> Revoke
      </Button>
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ApiKeyManager({ keys, mcpUrl }: { keys: KeyView[]; mcpUrl: string }) {
  const [name, setName] = useState("Claude");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const keyForSnippet = newKey ?? "<your-api-key>";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Create an API key</CardTitle>
            <CardDescription>Each key has full access to post on your accounts. Revoke any you no longer use.</CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              start(async () => {
                const res = await createApiKeyAction(name);
                if (res.ok) setNewKey(res.data.key);
                else setError(res.error);
              });
            }}
          >
            <Field id="key-name" label="Key name" className="flex-1" error={error}>
              <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
            </Field>
            <Button type="submit" loading={pending}>
              <KeyRound aria-hidden /> Create key
            </Button>
          </form>
          {newKey && (
            <Notice tone="warning">
              Copy this key now. You won&apos;t be able to see it again.
            </Notice>
          )}
          {newKey && <CopyBlock label="Your new key" text={newKey} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Connect Claude</CardTitle>
            <CardDescription>Run this once in a terminal to add Vieews to Claude Code.</CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <CopyBlock label="Claude Code" text={`claude mcp add --transport http vieews ${mcpUrl} --header "Authorization: Bearer ${keyForSnippet}"`} />
          <CopyBlock
            label="Other MCP clients (JSON config)"
            text={JSON.stringify({ mcpServers: { vieews: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${keyForSnippet}` } } } }, null, 2)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active keys</CardTitle>
        </CardHeader>
        {keys.length === 0 ? (
          <EmptyState icon={<KeyRound />} title="No keys yet" description="Create a key above to let an AI agent post for you." />
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>{k.prefix}…</code> · created {k.created} · {k.lastUsed ? `last used ${k.lastUsed}` : "never used"}
                  </p>
                </div>
                <RevokeButton id={k.id} name={k.name} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
