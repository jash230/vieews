"use client";

import { ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Adapted from "Chatgpt Prompt Input" by jahed on 21st.dev: the rounded composer with tools on the left
// and a round send button on the right. Trimmed to one link field and restyled to the Vieews tokens.

export function PromptBox({
  id,
  value,
  onValueChange,
  onSubmit,
  label,
  placeholder,
  submitLabel,
  busy = false,
  canSubmit,
  tools,
  attachment,
  hint,
  error,
  className,
}: {
  id: string;
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: () => void;
  /** Read by screen readers; the page's heading says the same thing out loud. */
  label: string;
  placeholder: string;
  submitLabel: string;
  busy?: boolean;
  canSubmit: boolean;
  /** Buttons on the left of the bottom row, e.g. attach a file. */
  tools?: ReactNode;
  /** Shown instead of the link field, e.g. an attached file. */
  attachment?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !busy) onSubmit();
      }}
      className={cn("w-full", className)}
    >
      <div
        className={cn(
          "flex flex-col gap-1 rounded-[28px] border bg-background p-2 shadow-md transition-[border-color,box-shadow] duration-200 focus-within:shadow-lg",
          error ? "border-destructive" : "border-border focus-within:border-accent",
        )}
      >
        {attachment ?? (
          <>
            <label htmlFor={id} className="sr-only">{label}</label>
            <input
              id={id}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={placeholder}
              disabled={busy}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
              // Its own focus style is the box's border, so the global ring would double up.
              className="min-h-12 w-full bg-transparent px-3 text-base text-foreground placeholder:text-subtle-foreground focus:outline-none disabled:opacity-60"
            />
          </>
        )}
        <div className="flex items-center gap-2">
          {tools}
          <Button type="submit" disabled={!canSubmit} loading={busy} className="ml-auto rounded-full px-4">
            {!busy && <ArrowUp aria-hidden />}
            {submitLabel}
          </Button>
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 px-4 text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 px-4 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </form>
  );
}
