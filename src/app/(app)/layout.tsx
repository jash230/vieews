import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { NavTabs } from "@/components/app/nav";
import { ProjectSwitcher } from "@/components/app/project-switcher";
import { CopilotServer } from "@/components/copilot/copilot-server";
import { CopilotRail, CopilotToggle, CopilotUIProvider } from "@/components/copilot/copilot-ui";
import { Skeleton } from "@/components/ui/misc";
import { getCurrentProject } from "@/lib/projects/current";
import { listProjectOptions } from "@/lib/projects/options";

// The app shell: the sidebar on the left, the workspace in the middle, the copilot docked on the right.

async function TopProjectMenu() {
  const { userId } = await auth.protect();
  const [projects, current] = await Promise.all([listProjectOptions(userId), getCurrentProject(userId)]);
  return <ProjectSwitcher projects={projects} currentId={current?.id ?? null} />;
}

function CopilotSkeleton() {
  return (
    <div className="hidden w-96 shrink-0 flex-col gap-3 border-l border-border bg-surface p-3 lg:flex" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <div className="flex-1" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <CopilotUIProvider>
      <div className="flex h-dvh flex-col md:flex-row">
        <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>

        {/* Phones: a top bar with sideways tabs. */}
        <header className="z-30 shrink-0 border-b border-border bg-background md:hidden">
          <div className="flex h-14 items-center gap-2 px-3">
            <Suspense fallback={<Skeleton className="h-9 w-44" />}>
              <TopProjectMenu />
            </Suspense>
            <span className="flex-1" />
            <CopilotToggle />
            <UserButton />
          </div>
          <NavTabs className="px-2 pb-2" />
        </header>

        {/* Tablets and up: the sidebar. */}
        <aside className="relative z-30 hidden w-60 shrink-0 flex-col gap-4 border-r border-border bg-background px-3 py-4 md:flex">
          <div className="px-1"><Logo /></div>
          <Suspense fallback={<Skeleton className="h-11 w-full" />}>
            <TopProjectMenu />
          </Suspense>
          <NavTabs vertical className="-mx-1 flex-1 px-1" />
          <div className="flex items-center gap-2 border-t border-border px-1 pt-3">
            <UserButton showName />
          </div>
        </aside>

        <div className="flex min-h-0 flex-1">
          <main id="main" className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
          </main>
          <Suspense fallback={<CopilotSkeleton />}>
            <CopilotServer />
          </Suspense>
          <CopilotRail />
        </div>
      </div>
    </CopilotUIProvider>
  );
}
