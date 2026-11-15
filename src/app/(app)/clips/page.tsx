import { auth } from "@clerk/nextjs/server";
import { Scissors } from "lucide-react";
import { Suspense } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { listClipJobs } from "@/lib/clips/service";
import { getCurrentProject } from "@/lib/projects/current";
import { ClipForm } from "./clip-form";
import { ClipJobItem } from "./clip-status";

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
          {jobs.map((job) => <ClipJobItem key={job.id} job={job} />)}
        </ul>
      )}
    </Card>
  );
}
