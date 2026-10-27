import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { MobileTopBar, Sidebar } from "@/components/app/nav";
import { Skeleton } from "@/components/ui/misc";

async function UserInfo() {
  const user = await currentUser();
  return (
    <div className="min-w-0 text-sm">
      <p className="truncate font-medium">{user?.firstName ?? user?.username ?? "You"}</p>
      <p className="truncate text-xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  const footer = (
    <div className="flex min-h-11 items-center gap-3 px-2">
      <UserButton />
      <Suspense fallback={<Skeleton className="h-8 flex-1" />}>
        <UserInfo />
      </Suspense>
    </div>
  );
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Sidebar footer={footer} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar footer={footer} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
