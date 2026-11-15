"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { clipJobProgressAction, discardClipAction } from "../../actions";

/** Refreshes the page whenever the job moves on (a new step, or another clip rendered). */
export function ClipJobRefresh({ jobId, initial, everyMs = 4000 }: { jobId: string; initial: string; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last = initial;
    let busy = false;
    const id = setInterval(async () => {
      if (busy || document.hidden) return;
      busy = true;
      const res = await clipJobProgressAction(jobId).catch(() => null);
      busy = false;
      if (!res?.ok) return;
      const key = `${res.data.status}:${res.data.clipsDone}:${res.data.clipsTotal}`;
      if (key !== last) router.refresh();
      last = key;
    }, everyMs);
    return () => clearInterval(id);
  }, [router, jobId, initial, everyMs]);
  return null;
}

export function DiscardClipButton({ clipId, title }: { clipId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      loading={pending}
      className="hover:bg-destructive-soft hover:text-destructive"
      aria-label={`Discard “${title}”`}
      onClick={() => {
        if (!confirm("Discard this clip? Its video is deleted.")) return;
        start(async () => {
          const res = await discardClipAction(clipId);
          if (!res.ok) return void toast.error("Couldn't discard the clip", { description: res.error });
          router.refresh();
        });
      }}
    >
      {!pending && <Trash2 aria-hidden />}
      Discard
    </Button>
  );
}
