import { AlertTriangle, Ban, CheckCircle2, Clock, Loader2, UploadCloud, XCircle } from "lucide-react";
import type { PostStatus, TargetStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<PostStatus | TargetStatus, { label: string; icon: typeof Clock; className: string; spin?: boolean }> = {
  scheduled: { label: "Scheduled", icon: Clock, className: "bg-accent-soft text-accent" },
  pending: { label: "Queued", icon: Clock, className: "bg-muted text-muted-foreground" },
  publishing: { label: "Publishing", icon: Loader2, className: "bg-warning-soft text-warning", spin: true },
  uploading: { label: "Uploading", icon: UploadCloud, className: "bg-warning-soft text-warning" },
  processing: { label: "Processing", icon: Loader2, className: "bg-warning-soft text-warning", spin: true },
  published: { label: "Published", icon: CheckCircle2, className: "bg-success-soft text-success" },
  partial: { label: "Partly published", icon: AlertTriangle, className: "bg-warning-soft text-warning" },
  failed: { label: "Failed", icon: XCircle, className: "bg-destructive-soft text-destructive" },
  canceled: { label: "Canceled", icon: Ban, className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: PostStatus | TargetStatus; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.className, className)}>
      <Icon className={cn("size-3.5", s.spin && "animate-spin")} aria-hidden />
      {s.label}
    </span>
  );
}
