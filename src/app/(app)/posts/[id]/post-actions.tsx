"use client";

import { Ban, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelPostAction, retryTargetAction } from "../../actions";

/** Re-fetches the server component while publishing is in progress. */
export function AutoRefresh({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}

export function CancelPostButton({ postId }: { postId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="destructive"
      loading={pending}
      onClick={() => {
        if (!confirm("Cancel this scheduled post? It won't be published anywhere.")) return;
        start(async () => {
          const res = await cancelPostAction(postId);
          if (!res.ok) alert(res.error);
        });
      }}
    >
      <Ban aria-hidden /> Cancel post
    </Button>
  );
}

export function RetryButton({ postId, targetId }: { postId: string; targetId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await retryTargetAction(postId, targetId);
          if (!res.ok) alert(res.error);
        })
      }
    >
      <RotateCw aria-hidden /> Retry
    </Button>
  );
}
