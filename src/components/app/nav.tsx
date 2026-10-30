"use client";

import { CalendarClock, FolderKanban, KeyRound, LayoutDashboard, Link2, PenSquare } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Create post", icon: PenSquare },
  { href: "/posts", label: "Posts", icon: CalendarClock },
  { href: "/accounts", label: "Accounts", icon: Link2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "AI & API keys", icon: KeyRound },
] as const;

/** The workspace's tabs, in the top bar. Scrolls sideways on narrow screens. */
export function NavTabs({ className }: { className?: string }) {
  // The pathname is only known at request time; render inactive tabs until it streams in.
  return (
    <Suspense fallback={<TabList pathname={null} className={className} />}>
      <ActiveTabList className={className} />
    </Suspense>
  );
}

function ActiveTabList({ className }: { className?: string }) {
  return <TabList pathname={usePathname()} className={className} />;
}

function TabList({ pathname, className }: { pathname: string | null; className?: string }) {
  return (
    <nav aria-label="Main" className={cn("flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]", className)}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors duration-150",
              active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-primary-soft/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 group-hover:animate-wiggle" aria-hidden />
            {label}
            <PendingDots />
            {active && <span className="absolute inset-x-3 -bottom-[7px] h-1 animate-pop-in rounded-full bg-brand-olive" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Hops while this link's route is still loading (prefetch not finished yet). */
function PendingDots() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-hop rounded-full bg-brand-teal" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}
