import { cn } from "@/lib/utils";

const DOTS = [
  { cx: 4, fill: "var(--brand-teal)" },
  { cx: 12, fill: "var(--brand-olive)" },
  { cx: 20, fill: "var(--brand-tea)" },
];

/** The Vieews mark with its three points (one per platform) hopping in turn. For route-level loading. */
export function BrandLoader({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-center gap-3", className)}>
      <span className="grid size-14 place-items-center rounded-2xl bg-primary shadow-pop">
        <svg viewBox="0 0 24 24" className="size-8 overflow-visible" fill="none" aria-hidden>
          <path d="M4 6l8 13 8-13" stroke="var(--brand-tea)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {DOTS.map(({ cx, fill }, i) => (
            <circle
              key={cx}
              cx={cx}
              cy={6}
              r={2}
              fill={fill}
              className="animate-hop [transform-box:fill-box] [transform-origin:center]"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </svg>
      </span>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}
