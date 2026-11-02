import { auth } from "@clerk/nextjs/server";
import { Link2 } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { NoProject } from "@/components/app/no-project";
import { listAccounts } from "@/lib/accounts/service";
import { getCurrentProject } from "@/lib/projects/current";
import { composeAccounts, projectsByAccount } from "@/lib/projects/service";
import { Composer } from "./composer";

export const metadata = { title: "Create post" };

export default function ComposePage({ searchParams }: PageProps<"/compose">) {
  return (
    <>
      <PageHeader title="Create post" description="Upload once, then choose where it goes." />
      <Suspense fallback={<ComposeSkeleton />}>
        <ComposeForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Same two columns as the composer: step cards, then the phone preview and publish card. */
function ComposeSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true">
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[13rem] rounded-[2.25rem] sm:max-w-[17rem]" />
        <Skeleton className="h-44 rounded-3xl" />
      </div>
    </div>
  );
}

async function ComposeForm({ searchParams }: Pick<PageProps<"/compose">, "searchParams">) {
  const { userId } = await auth.protect();
  const { at } = await searchParams;
  const [project, all, byAccount] = await Promise.all([getCurrentProject(userId), listAccounts(userId), projectsByAccount(userId)]);
  if (!project) return <NoProject />;
  const { linked: accounts, unassigned } = composeAccounts(all, byAccount, project.id);

  // Unassigned accounts can be added from the composer, so only an empty project with none left shows this.
  return accounts.length === 0 && unassigned.length === 0 ? (
    <Card>
      <EmptyState
        icon={<Link2 />}
        title={`No accounts post for ${project.name} yet`}
        description="Pick which of your connected accounts this project posts to, or connect a new one."
        action={<ButtonLink href={`/projects/${project.id}`}>Choose accounts</ButtonLink>}
      />
    </Card>
  ) : (
    <Composer key={project.id} accounts={accounts} unassigned={unassigned} projectId={project.id} initialAt={typeof at === "string" ? at : undefined} />
  );
}
