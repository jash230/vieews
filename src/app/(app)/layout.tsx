import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { NavTabs } from "@/components/app/nav";
import { ProjectSwitcher } from "@/components/app/project-switcher";
import { CopilotServer } from "@/components/copilot/copilot-server";
import { Skeleton } from "@/components/ui/misc";
import { getCurrentProject } from "@/lib/projects/current";
import { listProjectOptions } from "@/lib/projects/options";

// Signed-in pages: keep them out of search results.
export const metadata = { robots: { index: false, follow: false } };

// The app shell: project menu top-left, the copilot docked on the left, the workspace on the right.

async function TopProjectMenu() {
  const { userId } = await auth.protect();
  const [projects, current] = await Promise.all([listProjectOptions(userId), getCurrentProject(userId)]);
  return <ProjectSwitcher projects={projects} currentId={current?.id ?? null} />;
}

function CopilotSkeleton() {
  return (
    <div className="hidden w-96 shrink-0 flex-col gap-3 border-r border-border bg-surface p-3 lg:flex" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <div className="flex-1" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <header className="z-30 shrink-0 border-b border-border bg-background">
        <div className="flex h-14 items-center gap-2 px-3">
          <div className="hidden sm:block"><Logo compact /></div>
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
          <Suspense fallback={<Skeleton className="h-9 w-44" />}>
            <TopProjectMenu />
          </Suspense>
          <NavTabs className="ml-2 hidden flex-1 py-2 md:flex" />
          <span className="flex-1 md:hidden" />
          <UserButton />
        </div>
        <NavTabs className="px-2 pb-2 [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] md:hidden" />
      </header>
      <div className="flex min-h-0 flex-1">
        <Suspense fallback={<CopilotSkeleton />}>
          <CopilotServer />
        </Suspense>
        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
