import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, CheckCircle2, Circle, Download, Flame, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Notice, Skeleton } from "@/components/ui/misc";
import { getClipJob, listClips, type ClipView } from "@/lib/clips/service";
import { CLEANUP_RULES } from "@/lib/media/cleanup";
import type { ClipJobRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClipJobBadge, isRunning, STEPS } from "../clip-status";
import { ClipJobRefresh, DiscardClipButton } from "./clip-actions";

export const metadata = { title: "Clips" };

export default function ClipJobPage({ params }: PageProps<"/clips/[id]">) {
  return (
    <>
      <Link href="/clips" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All clips
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <ClipJob params={params} />
      </Suspense>
    </>
  );
}

const downloadName = (title: string) => `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "clip"}.mp4`;

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

async function ClipJob({ params }: Pick<PageProps<"/clips/[id]">, "params">) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const job = await getClipJob(userId, id);
  if (!job) notFound();
  const clips = job.status === "rendering" || job.status === "ready" ? await listClips(userId, id) : [];
  const running = isRunning(job.status);
  const postable = job.status === "ready" ? clips.filter((c) => c.videoUrl) : [];

  return (
    <div className="space-y-6">
      {running && <ClipJobRefresh jobId={job.id} initial={`${job.status}:${job.clips_done}:${job.clips_total}`} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-semibold tracking-tight sm:text-[30px]">{job.source_title ?? "Your clips"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ClipJobBadge status={job.status} />
            {job.source_duration_s ? <span>{fmtTime(Number(job.source_duration_s))} video</span> : null}
            {job.source_url && (
              <a href={job.source_url} target="_blank" rel="noreferrer noopener" title={job.source_url} className="max-w-[18rem] truncate underline-offset-2 hover:underline">
                {job.source_url}
              </a>
            )}
          </div>
        </div>
        {postable.length > 1 && (
          <ButtonLink href={`/compose?clip=${postable.map((c) => c.id).join(",")}`} className="min-h-12 px-6">
            <Send aria-hidden /> Post all {postable.length} clips
          </ButtonLink>
        )}
      </div>

      {job.status === "failed" && <Notice tone="error" className="break-words">{job.error ?? "Something went wrong."}</Notice>}
      {running && <Progress job={job} />}
      {job.status === "ready" && (
        <Notice tone="info">Clips you don&apos;t post are deleted after {CLEANUP_RULES.orphanAfterDays} days to free storage. Download any you want to keep.</Notice>
      )}

      {clips.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Progress({ job }: { job: Omit<ClipJobRow, "transcript"> }) {
  const at = STEPS.findIndex((s) => s.status === job.status);
  return (
    <Card className="p-5">
      <p className="sr-only" aria-live="polite">
        {STEPS[Math.max(0, at)]?.label}
        {job.status === "rendering" && job.clips_total > 0 ? `, ${job.clips_done} of ${job.clips_total} clips ready` : ""}
      </p>
      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const done = at > i;
          const active = at === i || (at === -1 && i === 0);
          return (
            <li key={step.status} aria-current={active ? "step" : undefined} className={cn("flex items-center gap-3 text-sm", done || active ? "text-foreground" : "text-subtle-foreground")}>
              {done ? (
                <CheckCircle2 className="size-5 text-success" aria-hidden />
              ) : active ? (
                <span className="grid size-5 place-items-center"><Loader variant="dots" size={14} label={null} /></span>
              ) : (
                <Circle className="size-5" aria-hidden />
              )}
              <span className={cn(active && "font-semibold")}>
                {step.label}
                {step.status === "rendering" && active && job.clips_total > 0 && ` (${job.clips_done} of ${job.clips_total})`}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">You can leave this page. The clips keep rendering and will be here when you come back.</p>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-success-soft text-success" : score >= 60 ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", tone)} title="Virality score out of 100">
      <Flame className="size-3.5" aria-hidden />
      <span className="sr-only">Virality score </span>
      {score}
    </span>
  );
}

function ClipCard({ clip }: { clip: ClipView }) {
  const rendering = !clip.asset;
  const expired = !!clip.asset?.purged_at;
  return (
    <li>
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[18rem] bg-foreground/90">
          {clip.videoUrl ? (
            <video src={clip.videoUrl} poster={clip.posterUrl ?? undefined} controls playsInline preload="none" aria-label={`Preview: ${clip.title}`} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center p-6 text-center text-sm text-background/80">
              {rendering ? (
                <span className="flex flex-col items-center gap-2"><Loader variant="dots" size={18} label={null} />Rendering…</span>
              ) : expired ? (
                "This clip was cleaned up to free storage."
              ) : (
                "Preview unavailable"
              )}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display text-base font-semibold leading-snug">{clip.title}</h2>
            <ScoreBadge score={clip.score} />
          </div>
          <p className="text-sm italic text-foreground/80">“{clip.hook}”</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{clip.reason}</p>
          <p className="text-xs text-subtle-foreground tabular-nums">
            {fmtTime(clip.start_s)}–{fmtTime(clip.end_s)} · {Math.round(clip.end_s - clip.start_s)}s
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {clip.videoUrl && (
              <>
                <ButtonLink href={`/compose?clip=${clip.id}`}>
                  <Send aria-hidden /> Post
                </ButtonLink>
                <a href={`${clip.videoUrl}&download=${encodeURIComponent(downloadName(clip.title))}`} className={buttonVariants({ variant: "secondary" })}>
                  <Download aria-hidden /> Download
                </a>
              </>
            )}
            {!rendering && <DiscardClipButton clipId={clip.id} title={clip.title} />}
          </div>
        </div>
      </Card>
    </li>
  );
}
