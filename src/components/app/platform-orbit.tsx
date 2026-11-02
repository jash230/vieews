import type { CSSProperties } from "react";
import { siFacebook, siInstagram, siPinterest, siReddit, siSnapchat, siThreads, siTiktok, siTwitch, siX, siYoutube, type SimpleIcon } from "simple-icons";

// Brand colors are only used for the marks themselves (see design-system/MASTER.md).
const ORBIT: { icon: SimpleIcon; tile?: string; color?: string }[] = [
  { icon: siYoutube },
  { icon: siInstagram },
  { icon: siTiktok },
  { icon: siX },
  { icon: siSnapchat, tile: "#FFFC00", color: "#000000" },
  { icon: siFacebook },
  { icon: siThreads },
  { icon: siPinterest },
  { icon: siTwitch },
  { icon: siReddit },
];

/**
 * Social platform tiles on a tilted ring that slowly spins in 3D, around the Vieews mark.
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
          {ORBIT.map(({ icon, tile, color }, i) => (
            <div key={icon.slug} className="orbit-slot absolute" style={{ "--a": `${(360 / ORBIT.length) * i}deg` } as CSSProperties}>
              <div className="orbit-face absolute -left-6 -top-6 sm:-left-8 sm:-top-8">
                <span
                  className="grid size-12 place-items-center rounded-2xl border border-border shadow-md sm:size-16"
                  style={{ background: tile ?? "var(--background)" }}
                >
                  <svg viewBox="0 0 24 24" className="size-6 sm:size-8" style={{ fill: color ?? `#${icon.hex}` }}>
                    <path d={icon.path} />
                  </svg>
                </span>
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
