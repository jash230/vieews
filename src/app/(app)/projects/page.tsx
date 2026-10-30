import { auth } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { NoProject } from "@/components/app/no-project";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { getCurrentProject } from "@/lib/projects/current";
import { listProjectOptions } from "@/lib/projects/options";
import { listProjects } from "@/lib/projects/service";
import { ProjectIcon } from "./project-icon";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="One project per app you promote. Each has its own copilot chat, posts and accounts."
        actions={<ButtonLink href="/projects/new"><Plus aria-hidden /> New project</ButtonLink>}
      />
      <Suspense fallback={<Skeleton className="h-48 rounded-3xl" />}>
        <ProjectList />
      </Suspense>
    </>
  );
}

async function ProjectList() {
  const { userId } = await auth.protect();
  const [projects, options, current] = await Promise.all([listProjects(userId), listProjectOptions(userId), getCurrentProject(userId)]);
  if (!projects.length) return <NoProject />;
  const iconUrl = (id: string) => options.find((o) => o.id === id)?.iconUrl ?? null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p, i) => (
        <Link key={p.id} href={`/projects/${p.id}`} className="group block animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
          <Card className="flex h-full items-start gap-4 p-5 transition-[translate,box-shadow] duration-200 ease-spring group-hover:-translate-y-0.5 group-hover:shadow-md">
            <ProjectIcon name={p.name} url={iconUrl(p.id)} size={48} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-display text-lg font-semibold">
                <span className="truncate">{p.name}</span>
                {current?.id === p.id && <span className="rounded-full bg-primary-soft px-2 py-0.5 font-sans text-xs font-bold text-primary">Current</span>}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.kit.oneLiner || "No pitch yet"}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
