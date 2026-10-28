import { AlertTriangle, Ban, CheckCircle2, Clock, UploadCloud, XCircle } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import type { PostStatus, TargetStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// `icon: null` shows the bouncing loader dots for in-flight states.
const STATUS: Record<PostStatus | TargetStatus, { label: string; icon: typeof Clock | null; className: string }> = {
  scheduled: { label: "Scheduled", icon: Clock, className: "bg-accent-soft text-accent" },
  pending: { label: "Queued", icon: Clock, className: "bg-muted text-muted-foreground" },
  publishing: { label: "Publishing", icon: null, className: "bg-warning-soft text-warning" },
  uploading: { label: "Uploading", icon: UploadCloud, className: "bg-warning-soft text-warning" },
  processing: { label: "Processing", icon: null, className: "bg-warning-soft text-warning" },
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
      {Icon ? <Icon className="size-3.5" aria-hidden /> : <Loader variant="dots" size={14} label={null} />}
      {s.label}
    </span>
  );
}
