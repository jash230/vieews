"use client";

// Adapted from 21st.dev "Loader" by my (https://21st.dev/@my/components/loader), trimmed to the variants Vieews uses.
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type LoaderVariant = "spinner" | "dots" | "bars" | "morph";

const EASE_IN_OUT = [0.42, 0, 0.58, 1] as const;

// Reduced motion keeps a calm opacity pulse and drops every transform.
const REDUCED = {
  animate: { opacity: [1, 0.4, 1] },
  transition: { duration: 1.4, ease: EASE_IN_OUT, repeat: Infinity },
};

type LoaderProps = {
  variant?: LoaderVariant;
  /** Base square size in px. Everything scales from this. */
  size?: number;
  /** Seconds per animation cycle. */
  speed?: number;
  /** Announced to screen readers. Pass `null` when surrounding text already says what's loading. */
  label?: string | null;
  className?: string;
};

export function Loader({ variant = "spinner", size = 32, speed = 1, label = "Loading", className }: LoaderProps) {
  const reduce = useReducedMotion() ?? false;
  const part = { size, speed, reduce };
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex items-center justify-center", className)}
    >
      {variant === "spinner" && <Spinner {...part} />}
      {variant === "dots" && <Dots {...part} />}
      {variant === "bars" && <Bars {...part} />}
      {variant === "morph" && <Morph {...part} />}
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

type PartProps = { size: number; speed: number; reduce: boolean };

function Spinner({ size, speed, reduce }: PartProps) {
  const stroke = Math.max(2, size * 0.09);
  const r = (size - stroke) / 2;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      animate={reduce ? REDUCED.animate : { rotate: 360 }}
      transition={reduce ? REDUCED.transition : { duration: speed, ease: "linear", repeat: Infinity }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
      <path
        d={`M ${size / 2} ${size / 2 - r} A ${r} ${r} 0 0 1 ${size / 2 + r} ${size / 2}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

function Dots({ size, speed, reduce }: PartProps) {
  const dot = size * 0.24;
  return (
    <span className="flex items-center" style={{ gap: size * 0.14 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="rounded-full bg-current"
          style={{ width: dot, height: dot }}
          animate={reduce ? { opacity: [0.4, 1, 0.4] } : { y: [0, -size * 0.3, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: speed, ease: EASE_IN_OUT, repeat: Infinity, delay: i * speed * 0.16 }}
        />
      ))}
    </span>
  );
}

function Bars({ size, speed, reduce }: PartProps) {
  const bar = size * 0.16;
  return (
    <span className="flex items-center" style={{ gap: size * 0.1, height: size }}>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="rounded-full bg-current"
          style={{ width: bar, height: size, originY: 1 }}
          animate={reduce ? { opacity: [0.4, 1, 0.4] } : { scaleY: [0.3, 1, 0.3] }}
          transition={{ duration: speed, ease: EASE_IN_OUT, repeat: Infinity, delay: i * speed * 0.12 }}
        />
      ))}
    </span>
  );
}

// Each shape is sampled at the same number of points with identical path commands,
// so motion tweens `d` point-to-point: a real morph, not a snap.
const MORPH_POINTS = 24;

function ngonRadius(ang: number, n: number, phase = 0) {
  const seg = (2 * Math.PI) / n;
  const local = ((((ang - phase) % seg) + seg) % seg) - seg / 2;
  return Math.cos(Math.PI / n) / Math.cos(local);
}

function morphPath(radiusAt: (ang: number) => number) {
  const parts: string[] = [];
  for (let i = 0; i < MORPH_POINTS; i++) {
    const ang = (i / MORPH_POINTS) * 2 * Math.PI - Math.PI / 2;
    const r = Math.min(1.05, radiusAt(ang));
    parts.push(`${i === 0 ? "M" : "L"}${(50 + Math.cos(ang) * 46 * r).toFixed(2)} ${(50 + Math.sin(ang) * 46 * r).toFixed(2)}`);
  }
  return `${parts.join(" ")} Z`;
}

const MORPH_PATHS = [
  morphPath(() => 1), // circle
  morphPath((a) => ngonRadius(a, 4, Math.PI / 4)), // square
  morphPath((a) => ngonRadius(a, 3)), // triangle
  morphPath((a) => ngonRadius(a, 6)), // hexagon
  morphPath((a) => ngonRadius(a, 4)), // diamond
];
// Each shape appears twice so it forms and holds before the next morph.
const MORPH_SEQ = [...MORPH_PATHS.flatMap((p) => [p, p]), MORPH_PATHS[0]];
const MORPH_ROT = [0, 0, 72, 72, 144, 144, 216, 216, 288, 288, 360];
const MORPH_SCALE = [1, 1, 0.88, 0.88, 1, 1, 0.88, 0.88, 1, 1, 1];

function Morph({ size, speed, reduce }: PartProps) {
  const loop = { duration: speed * 5, ease: EASE_IN_OUT, repeat: Infinity };
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      animate={reduce ? REDUCED.animate : { rotate: MORPH_ROT, scale: MORPH_SCALE }}
      transition={reduce ? REDUCED.transition : loop}
    >
      <motion.path fill="currentColor" d={MORPH_PATHS[0]} animate={reduce ? undefined : { d: MORPH_SEQ }} transition={reduce ? undefined : loop} />
    </motion.svg>
  );
}
