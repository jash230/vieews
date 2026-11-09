"use client";

import { Ban, RotateCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deletePostNow } from "@/components/app/deleted-posts";
import { toast } from "@/components/ui/toast";
import { cancelPostAction, postProgressAction, retryTargetAction } from "../../actions";

/**
 * While publishing, polls a small status check and re-renders the page only when a status actually
 * changes, so the video and the rest of the page stay put in between.
 */
export function AutoRefresh({ postId, everyMs = 5000 }: { postId: string; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last: string | null = null;
    let busy = false;
    const id = setInterval(async () => {
      if (busy || document.hidden) return;
      busy = true;
      const res = await postProgressAction(postId).catch(() => null);
      busy = false;
      if (!res?.ok) return;
      if (last !== null && res.data !== last) router.refresh();
      last = res.data;
    }, everyMs);
    return () => clearInterval(id);
  }, [router, postId, everyMs]);
  return null;
}

/**
 * Each refresh signs a new media URL; swapping it into the player would restart playback,
 * so keep the first one and only take a fresh one if it stops loading (expired).
 */
export function PostVideo({ src }: { src: string }) {
  const [current, setCurrent] = useState(src);
  return (
    <video
      src={current}
      onError={() => current !== src && setCurrent(src)}
      controls
      playsInline
      preload="metadata"
      className="size-full object-contain"
      aria-label="Post video"
    />
  );
}

export function CancelPostButton({ postId }: { postId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="destructive"
      loading={pending}
      onClick={() => {
        if (!confirm("Stop this post from going out? It won't be published anywhere.\n\nOK stops it. Cancel keeps it scheduled.")) return;
        start(async () => {
          const res = await cancelPostAction(postId);
          if (res.ok) toast.success("Post canceled", { description: "It won't be published anywhere." });
          else toast.error("Couldn't cancel the post", { description: res.error });
        });
      }}
    >
      <Ban aria-hidden /> Cancel post
    </Button>
  );
}

export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={() => {
        if (!confirm("Delete this post from Vieews? Anything already posted stays live on the platforms.")) return;
        // Leave first: actions and navigations share one queue, so pushing after would wait for the delete.
        router.push("/posts");
        deletePostNow(postId);
      }}
    >
      <Trash2 aria-hidden /> Delete
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
          if (res.ok) toast.success("Retrying", { description: "Vieews is posting it again. This page updates when it's done." });
          else toast.error("Couldn't retry", { description: res.error });
        })
      }
    >
      <RotateCw aria-hidden /> Retry
    </Button>
  );
}
