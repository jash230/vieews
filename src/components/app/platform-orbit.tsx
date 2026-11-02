import { CalendarClock, Sparkles, Wand2, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { siInstagram, siTiktok, siYoutube, type SimpleIcon } from "simple-icons";

// The three platforms Vieews posts to, alternating with what Vieews does for them.
// Brand colors are only used for the platform marks (see design-system/MASTER.md).
type Tile = { key: string; brand: SimpleIcon } | { key: string; feature: LucideIcon; tile: string };

const ORBIT: Tile[] = [
  { key: "youtube", brand: siYoutube },
  { key: "copilot", feature: Sparkles, tile: "bg-brand-tea" },
  { key: "instagram", brand: siInstagram },
  { key: "schedule", feature: CalendarClock, tile: "bg-brand-olive" },
  { key: "tiktok", brand: siTiktok },
  { key: "made", feature: Wand2, tile: "bg-brand-teal" },
];

/**
 * Platform and feature tiles on a tilted ring that slowly spins in 3D, around the Vieews mark.
 * Perspective makes tiles grow as they swing to the front (bottom) and shrink at the back (top).
 * Pure CSS (see `.orbit*` in globals.css). It never stops; reduced motion only slows it down.
 */
export function PlatformOrbit({ className }: { className?: string }) {
  return (
    <div className={`orbit relative grid aspect-[5/4] w-full max-w-[22rem] place-items-center sm:max-w-[32rem] lg:aspect-[3/2] ${className ?? ""}`} aria-hidden>
      {/* Soft ground shadow under the ring. */}
      <div className="absolute inset-x-[12%] top-1/2 h-[28%] -translate-y-1/4 rounded-[50%] bg-brand-tea/40 blur-2xl" />
      <div className="orbit-plane relative size-0">
        <div className="orbit-spin absolute">
          {ORBIT.map((t, i) => (
            <div key={t.key} className="orbit-slot absolute" style={{ "--a": `${(360 / ORBIT.length) * i}deg` } as CSSProperties}>
              <div className="orbit-face absolute -left-7 -top-7 sm:-left-9 sm:-top-9">
                {"brand" in t ? (
                  <span className="grid size-14 place-items-center rounded-2xl border border-border bg-background shadow-md sm:size-[4.5rem]">
                    <svg viewBox="0 0 24 24" className="size-7 sm:size-9" style={{ fill: `#${t.brand.hex}` }}>
                      <path d={t.brand.path} />
                    </svg>
                  </span>
                ) : (
                  <span className={`grid size-14 place-items-center rounded-2xl text-primary shadow-md sm:size-[4.5rem] ${t.tile}`}>
                    <t.feature className="size-6 sm:size-8" strokeWidth={2.25} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="orbit-hub absolute -left-10 -top-10 sm:-left-12 sm:-top-12">
          <span className="grid size-20 place-items-center rounded-3xl bg-primary shadow-lg sm:size-24 sm:rounded-[1.75rem]">
            <svg viewBox="0 0 24 24" className="size-10 overflow-visible sm:size-12" fill="none" stroke="var(--brand-tea)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l8 13 8-13" />
              <circle cx="12" cy="6" r="1.5" fill="var(--brand-olive)" stroke="none" className="animate-hop [transform-box:fill-box]" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
