"use client";

import { Paperclip, Scissors, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ButtonLink } from "@/components/ui/button";
import { PromptBox } from "@/components/ui/prompt-box";
import { takePendingClip, stashPendingClip, type PendingClip } from "@/lib/clips/pending";
import { isTooBig } from "@/lib/media/shrink-plan";
import { cn } from "@/lib/utils";
import { startClipJobAction } from "../actions";
import { uploadFile } from "../compose/media";

/** Paste a link or attach a file, and start a clipping job. Picks up a link pasted on the home page before sign-in. */
export function ClipForm() {
  const router = useRouter();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || progress !== null;

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) return setError("Pick a video file (MP4 or MOV).");
    if (isTooBig(f.size)) return setError("Uploads can be up to 50 MB. For a bigger video, paste a link to it instead.");
    setFile(f);
  }

  function go(source: PendingClip | null) {
    setError(null);
    setNeedsPlan(false);
    if (source?.sourceUrl) setUrl(source.sourceUrl);
    startTransition(async () => {
      let req = source;
      if (!req && file) {
        try {
          setProgress(0);
          req = { sourceAssetId: await uploadFile(file, setProgress) };
        } catch (err) {
          return setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setProgress(null);
        }
      }
      req ??= { sourceUrl: url };
      const res = await startClipJobAction({ sourceUrl: req.sourceUrl, sourceAssetId: req.sourceAssetId });
      if (!res.ok) {
        // No plan yet, or today's clips are used up: keep the request so it starts after they subscribe.
        if (res.upgrade && !req.paywalled) {
          stashPendingClip({ ...req, paywalled: true });
          return router.push("/pricing");
        }
        setNeedsPlan(!!res.upgrade);
        return setError(res.error);
      }
      router.push(`/clips/${res.data.jobId}`);
    });
  }

  // Coming back from sign-in or checkout: start what they asked for.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const waiting = takePendingClip();
    // localStorage only exists after hydration, so this one-off start has to run from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (waiting) go(waiting);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) pickFile(e.dataTransfer.files?.[0]);
      }}
      className={cn("rounded-[30px] transition-colors", dragging && "bg-primary-soft ring-2 ring-primary")}
    >
      <input ref={fileInput} type="file" accept="video/mp4,video/quicktime" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} tabIndex={-1} />
      <PromptBox
        id={`${id}-url`}
        value={url}
        onValueChange={setUrl}
        onSubmit={() => go(null)}
        label="Video link"
        placeholder="Paste a YouTube, TikTok or podcast link…"
        submitLabel={progress !== null ? "Uploading…" : pending ? "Starting…" : "Find clips"}
        busy={busy}
        canSubmit={!!file || url.trim().length > 0}
        error={error}
        hint="YouTube, TikTok, Instagram, X, Vimeo or a direct video link, up to 2 hours. Or attach an MP4 up to 50 MB."
        tools={
          !file && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              aria-label="Attach a video file"
              title="Attach a video file"
              className="grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5"
            >
              <Paperclip aria-hidden />
            </button>
          )
        }
        attachment={
          file && (
            <div className="flex items-center gap-3 rounded-[20px] bg-surface p-2">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5"><Scissors aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                {progress !== null ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${file.name}`}>
                      <div className="h-full origin-left rounded-full bg-accent transition-transform duration-200" style={{ transform: `scaleX(${progress})` }} />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{Math.round(progress * 100)}%</span>
                  </div>
                ) : (
                  <p className="text-xs tabular-nums text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                )}
              </div>
              {!busy && (
                <button type="button" onClick={() => setFile(null)} aria-label={`Remove ${file.name}`} className="grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          )
        }
      />
      {needsPlan && <ButtonLink href="/pricing" variant="secondary" className="ml-4 mt-3">See plans</ButtonLink>}
    </div>
  );
}
