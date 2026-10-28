"use client";

// Adapted from 21st.dev "Dia Text" by animbits (https://21st.dev/@animbits/components/text-dia).
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type WordRotateProps = ComponentProps<"span"> & {
  words: string[];
  /** Milliseconds each word stays on screen. */
  duration?: number;
};

/** Cycles through `words` with a spring slide-up and a color sweep. Shows only the first word under reduced motion. */
export function WordRotate({ words, duration = 2200, className, ...props }: WordRotateProps) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), duration);
    return () => clearInterval(id);
  }, [words.length, duration, reduce]);

  const word = words[reduce ? 0 : index];
  return (
    <span className={cn("relative inline-block overflow-hidden align-bottom", className)} {...props}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          className="absolute inset-0 inline-block"
          initial={{ y: "100%", opacity: 0, filter: "blur(4px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-100%", opacity: 0, filter: "blur(4px)" }}
          transition={{ y: { type: "spring", stiffness: 320, damping: 22 }, opacity: { duration: 0.2 }, filter: { duration: 0.2 } }}
        >
          <motion.span
            className="inline-block bg-clip-text"
            style={{
              WebkitTextFillColor: "transparent",
              backgroundImage: "linear-gradient(90deg, currentColor 50%, var(--accent) 50%, var(--brand-teal), var(--muted-foreground))",
              backgroundSize: "250% 100%",
            }}
            initial={{ backgroundPosition: "100% 0%" }}
            animate={{ backgroundPosition: "0% 0%" }}
            transition={{ duration: 0.8, ease: "easeInOut", delay: 0.1 }}
          >
            {word}
          </motion.span>
        </motion.span>
      </AnimatePresence>
      {/* Invisible copy keeps the width of the current word. */}
      <span className="invisible">{word}</span>
    </span>
  );
}
