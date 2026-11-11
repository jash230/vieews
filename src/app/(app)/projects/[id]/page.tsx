import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { Notice, PageHeader, Skeleton } from "@/components/ui/misc";
import { listAccounts } from "@/lib/accounts/service";
import { kitGaps } from "@/lib/projects/kit";
import { getProject, listProjectMedia, ProjectNotFoundError, projectAccountIds } from "@/lib/projects/service";
import { ProjectSettings } from "./project-settings";

// The title and the page both need the project: read it once per request.
const loadProject = cache((userId: string, id: string) => getProject(userId, id));

export async function generateMetadata({ params }: PageProps<"/projects/[id]">) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const project = await loadProject(userId, id).catch(() => null);
  return { title: project ? `${project.name} · Project` : "Project settings" };
}

export default function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <Skeleton className="mb-6 h-12 w-64" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      }
    >
      <ProjectContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectContent({ params, searchParams }: PageProps<"/projects/[id]">) {
  const { userId } = await auth.protect();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const project = await loadProject(userId, id).catch((err) => {
    if (err instanceof ProjectNotFoundError) notFound();
    throw err;
  });
  const [media, accounts, linked] = await Promise.all([listProjectMedia(userId, id), listAccounts(userId), projectAccountIds(userId, id)]);
  const gaps = kitGaps(project.kit, media.filter((m) => m.role === "screen").length);
  const warning = typeof sp.warning === "string" ? sp.warning : null;

  return (
    <>
      <PageHeader title={project.name} description="What the copilot knows about this app, and where it posts." />
      {warning && <Notice tone="warning" className="mb-6">{warning}</Notice>}
      {sp.review && !warning && (
        <Notice tone="success" className="mb-6">Drafted from your listing. Read it through and fix anything that isn&apos;t true; ads only say what&apos;s here.</Notice>
      )}
      {gaps.length > 0 && <Notice className="mb-6">Still missing: {gaps.join(", ")}.</Notice>}
      <ProjectSettings
        key={project.id}
        project={{ id: project.id, name: project.name, storeUrl: project.store_url, notes: project.notes, kit: project.kit }}
        media={media.map((m) => ({ id: m.media_asset_id, role: m.role, shows: m.shows, tags: m.tags, url: m.url, kind: m.media.kind }))}
        accounts={accounts}
        linked={linked}
      />
    </>
  );
}
