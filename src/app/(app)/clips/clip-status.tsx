import { CheckCircle2, XCircle } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import type { ClipJobStatus } from "@/lib/types";
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

export function ClipJobBadge({ status, className }: { status: ClipJobStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.className, className)}>
      {s.done === "ok" ? <CheckCircle2 className="size-3.5" aria-hidden /> : s.done === "fail" ? <XCircle className="size-3.5" aria-hidden /> : <Loader variant="dots" size={14} label={null} />}
      {s.label}
    </span>
  );
}
