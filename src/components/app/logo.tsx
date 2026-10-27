import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex min-h-11 items-center gap-2.5 rounded-lg font-bold tracking-tight text-foreground">
      <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-on-primary shadow-sm">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6l8 13 8-13" />
          <circle cx="12" cy="6" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="text-lg">Vieews</span>
    </Link>
  );
}
