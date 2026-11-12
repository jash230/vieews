"use client";

import { CalendarClock, FolderKanban, KeyRound, LayoutDashboard, Link2, PenSquare } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Create post", icon: PenSquare },
  { href: "/posts", label: "Posts", icon: CalendarClock },
  { href: "/accounts", label: "Accounts", icon: Link2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "AI & API keys", icon: KeyRound },
] as const;

type TabsProps = { className?: string; vertical?: boolean };

/** The workspace's tabs: a column in the sidebar, or a row that scrolls sideways on phones. */
export function NavTabs(props: TabsProps) {
  // The pathname is only known at request time; render inactive tabs until it streams in.
  return (
    <Suspense fallback={<TabList pathname={null} {...props} />}>
      <ActiveTabList {...props} />
    </Suspense>
  );
}

function ActiveTabList(props: TabsProps) {
  return <TabList pathname={usePathname()} {...props} />;
}

/** Edges of a sideways-scrolling row that hide more tabs, so they can fade out as a hint. */
function useScrollEdges(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const update = () => setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref, enabled]);
  return edges;
}

function TabList({ pathname, className, vertical = false }: TabsProps & { pathname: string | null }) {
  const nav = useRef<HTMLElement>(null);
  const edges = useScrollEdges(nav, !vertical);
  // On phones the row is wider than the screen: bring the current tab into view.
  useEffect(() => {
    if (vertical) return;
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname, vertical]);
  const fade = !vertical && (edges.start || edges.end);
  return (
    <nav
      ref={nav}
      aria-label="Main"
      style={
        fade
          ? {
              maskImage: `linear-gradient(to right, ${edges.start ? "transparent" : "black"}, black 24px, black calc(100% - 24px), ${edges.end ? "transparent" : "black"})`,
            }
          : undefined
      }
      className={cn("flex min-w-0 gap-1", vertical ? "flex-col overflow-y-auto" : "overflow-x-auto [scrollbar-width:none]", className)}
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors duration-150",
              active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-primary-soft/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 group-hover:animate-wiggle" aria-hidden />
            {label}
            <PendingDots />
            {active && (
              <span
                className={cn(
                  "absolute animate-pop-in rounded-full bg-brand-olive",
                  vertical ? "inset-y-2.5 -left-1 w-1" : "inset-x-3 -bottom-[7px] h-1",
                )}
                aria-hidden
              />
            )}
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
