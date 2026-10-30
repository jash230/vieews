import { auth } from "@clerk/nextjs/server";
import { Link2 } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { NoProject } from "@/components/app/no-project";
import { getCurrentProject } from "@/lib/projects/current";
import { listProjectAccounts } from "@/lib/projects/service";
import { Composer } from "./composer";

export const metadata = { title: "Create post" };

export default function ComposePage() {
  return (
    <>
      <PageHeader title="Create post" description="Upload once, then choose where it goes." />
      <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
        <ComposeForm />
      </Suspense>
    </>
  );
}

async function ComposeForm() {
  const { userId } = await auth.protect();
  const project = await getCurrentProject(userId);
  if (!project) return <NoProject />;
  const accounts = (await listProjectAccounts(userId, project.id)).filter((a) => a.status === "active");

  return accounts.length === 0 ? (
    <Card>
      <EmptyState
        icon={<Link2 />}
        title={`No accounts post for ${project.name} yet`}
        description="Pick which of your connected accounts this project posts to, or connect a new one."
        action={<ButtonLink href={`/projects/${project.id}`}>Choose accounts</ButtonLink>}
      />
    </Card>
  ) : (
    <Composer key={project.id} accounts={accounts} projectId={project.id} />
  );
}
