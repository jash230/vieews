import { CheckCircle2, ChevronRight, XCircle } from "lucide-react";
import Link from "next/link";
import { LocalTime } from "@/components/app/local-time";
import { Loader } from "@/components/ui/loader";
import { CLIP_CANCELLED, type ClipJobRow, type ClipJobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<ClipJobStatus, { label: string; className: string; done?: "ok" | "fail" }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  downloading: { label: "Downloading", className: "bg-warning-soft text-warning" },
  transcribing: { label: "Listening", className: "bg-warning-soft text-warning" },
  finding: { label: "Finding moments", className: "bg-warning-soft text-warning" },
  rendering: { label: "Rendering clips", className: "bg-warning-soft text-warning" },
  ready: { label: "Ready", className: "bg-success-soft text-success", done: "ok" },
  failed: { label: "Failed", className: "bg-destructive-soft text-destructive", done: "fail" },
};

export const isRunning = (s: ClipJobStatus) => s !== "ready" && s !== "failed";

/** The steps a job goes through, for the progress list. */
export const STEPS: { status: ClipJobStatus; label: string }[] = [
  { status: "downloading", label: "Downloading the video" },
  { status: "transcribing", label: "Transcribing every word" },
  { status: "finding", label: "Finding the viral moments" },
  { status: "rendering", label: "Cropping and captioning clips" },
];

export function ClipJobBadge({ status, error, className }: { status: ClipJobStatus; error?: string | null; className?: string }) {
  const s = status === "failed" && error === CLIP_CANCELLED ? { label: "Cancelled", className: "bg-muted text-muted-foreground", done: "fail" as const } : STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.className, className)}>
      {s.done === "ok" ? <CheckCircle2 className="size-3.5" aria-hidden /> : s.done === "fail" ? <XCircle className="size-3.5" aria-hidden /> : <Loader variant="dots" size={14} label={null} />}
      {s.label}
    </span>
  );
}

function sourceLabel(job: { source_title: string | null; source_url: string | null }) {
  if (job.source_title) return job.source_title;
  if (!job.source_url) return "Uploaded video";
  try {
    const u = new URL(job.source_url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname : ""}`;
  } catch {
    return job.source_url;
  }
}

/** One clipping job in a list, linking to its clips. */
export function ClipJobItem({ job }: { job: Omit<ClipJobRow, "transcript"> }) {
  return (
    <li>
      <Link href={`/clips/${job.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">{sourceLabel(job)}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ClipJobBadge status={job.status} error={job.error} />
            {job.status === "ready" && <span>{job.clips_done} clips</span>}
            <LocalTime iso={job.created_at} fmt="d MMM, h:mm a" />
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
