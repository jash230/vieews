import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" aria-label={compact ? "Vieews home" : undefined} className="group flex min-h-11 items-center gap-2.5 rounded-lg text-foreground">
      <span className="grid size-9 place-items-center rounded-xl bg-primary shadow-pop transition-transform duration-200 ease-spring group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" className="size-5 overflow-visible" fill="none" stroke="var(--brand-tea)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6l8 13 8-13" />
          <circle cx="12" cy="6" r="1.5" fill="var(--brand-olive)" stroke="none" className="[transform-box:fill-box] group-hover:animate-hop" />
        </svg>
      </span>
      {!compact && <span className="font-display text-xl font-semibold tracking-tight">Vieews</span>}
    </Link>
  );
}
