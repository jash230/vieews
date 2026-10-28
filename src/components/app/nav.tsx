"use client";

import { CalendarClock, KeyRound, LayoutDashboard, Link2, Menu, PenSquare, X } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Create post", icon: PenSquare },
  { href: "/posts", label: "Posts", icon: CalendarClock },
  { href: "/accounts", label: "Accounts", icon: Link2 },
  { href: "/settings", label: "AI & API keys", icon: KeyRound },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  // The pathname is only known at request time; render an inactive list until it streams in.
  return (
    <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} />}>
      <ActiveNavList onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNavList({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors duration-150",
              active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-primary-soft/60 hover:text-foreground",
            )}
          >
            {active && <span className="absolute -left-1 top-1/2 h-5 w-1.5 -translate-y-1/2 animate-pop-in rounded-full bg-brand-olive" aria-hidden />}
            <Icon className="size-[18px] group-hover:animate-wiggle" aria-hidden />
            {label}
            <PendingDots />
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
    <span className="ml-auto flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-hop rounded-full bg-brand-teal" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

export function Sidebar({ footer }: { footer: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-5 lg:flex">
      <div className="px-2"><Logo /></div>
      <div className="mt-8 flex-1"><NavLinks /></div>
      <div className="border-t border-border pt-4">{footer}</div>
    </aside>
  );
}

export function MobileTopBar({ footer }: { footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid size-11 place-items-center rounded-xl text-foreground hover:bg-primary-soft"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-foreground/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-background px-4 py-4 shadow-lg sheet-in">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center rounded-xl hover:bg-primary-soft">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1"><NavLinks onNavigate={() => setOpen(false)} /></div>
            <div className="border-t border-border pt-4">{footer}</div>
          </div>
        </div>
      )}
    </>
  );
}
