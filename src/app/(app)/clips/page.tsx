import { auth } from "@clerk/nextjs/server";
import { ChevronRight, Scissors } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LocalTime } from "@/components/app/local-time";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { listClipJobs } from "@/lib/clips/service";
import { getCurrentProject } from "@/lib/projects/current";
import { ClipForm } from "./clip-form";
import { ClipJobBadge } from "./clip-status";

export const metadata = { title: "Clips" };

export default function ClipsPage() {
  return (
    <>
      <PageHeader title="Clips" description="Paste a long video. AI finds the moments most likely to go viral and turns them into captioned vertical clips." />
      <div className="max-w-3xl space-y-8">
        <ClipForm />
        <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}>
          <RecentJobs />
        </Suspense>
      </div>
    </>
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

async function RecentJobs() {
  const { userId } = await auth.protect();
  const project = await getCurrentProject(userId).catch(() => null);
  const jobs = await listClipJobs(userId, project?.id ?? null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent</CardTitle>
      </CardHeader>
      {jobs.length === 0 ? (
        <EmptyState icon={<Scissors />} title="No clips yet" description="Your clipping jobs show up here." />
      ) : (
        <ul className="divide-y divide-border">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link href={`/clips/${job.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold">{sourceLabel(job)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ClipJobBadge status={job.status} />
                    {job.status === "ready" && <span>{job.clips_done} clips</span>}
                    <LocalTime iso={job.created_at} fmt="d MMM, h:mm a" />
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
