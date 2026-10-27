"use client";

import { Unlink } from "lucide-react";
import { useTransition } from "react";
import { disconnectAccountAction } from "../actions";

export function DisconnectButton({ accountId, name }: { accountId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Disconnect ${name}`}
      title="Disconnect"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Disconnect ${name}? Scheduled posts to this account will be removed.`)) return;
        start(async () => {
          const res = await disconnectAccountAction(accountId);
          if (!res.ok) alert(res.error);
        });
      }}
      className="grid size-11 shrink-0 place-items-center rounded-xl text-subtle-foreground transition-colors hover:bg-destructive-soft hover:text-destructive disabled:opacity-50"
    >
      <Unlink className="size-4" aria-hidden />
    </button>
  );
}
