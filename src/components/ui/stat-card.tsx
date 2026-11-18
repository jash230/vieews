"use client";

// Adapted from "Stat Card" by ravikatiyar162 on 21st.dev: the count-up value, restyled to the
// design system, trend chip swapped for a hint line, and reduced motion shows the value at once.
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn, formatCount } from "@/lib/utils";

export function StatCard({ label, value, icon, tile, hint, index = 0 }: { label: string; value: number; icon: ReactNode; tile: string; hint?: ReactNode; index?: number }) {
  const reduce = useReducedMotion();
  const count = useMotionValue(0);
  const shown = useTransform(count, (n) => formatCount(n));
  useEffect(() => {
    if (reduce) return count.set(value);
    const run = animate(count, value, { duration: 1.4, delay: 0.15 + index * 0.08, ease: [0.16, 1, 0.3, 1] });
    return () => run.stop();
  }, [count, value, reduce, index]);

  return (
    <Card className="group flex animate-fade-up flex-col gap-3 p-5" style={{ animationDelay: `${index * 80}ms` }}>
      <span className={cn("grid size-11 place-items-center rounded-2xl text-primary [&_svg]:size-5 [&_svg]:group-hover:animate-wiggle", tile)} aria-hidden>
        {icon}
      </span>
      <div>
        {/* Screen readers get the exact number once, not every animation frame. */}
        <p className="font-display text-3xl font-semibold tabular-nums" title={formatCount(value, true)}>
          <motion.span aria-hidden>{shown}</motion.span>
          <span className="sr-only">{formatCount(value, true)}</span>
        </p>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        {hint && <p className="mt-1 text-xs text-subtle-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
