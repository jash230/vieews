"use client";

import { Unlink } from "lucide-react";
import { useTransition } from "react";
import { disconnectAccountAction } from "../actions";

export function DisconnectButton({ accountId, name, projects = [] }: { accountId: string; name: string; projects?: string[] }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Disconnect ${name}`}
      title="Disconnect"
      disabled={pending}
      onClick={() => {
        const lose = projects.length ? ` ${projects.join(", ")} will stop posting to it.` : "";
        if (!confirm(`Disconnect ${name}? Scheduled posts to this account will be removed.${lose}`)) return;
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
