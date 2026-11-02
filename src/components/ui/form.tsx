"use client";

import { ChevronDown } from "lucide-react";
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// A Field tells its control which hint, error and counter describe it, so screen readers read them on focus.
const FieldContext = createContext<{ id: string; describedBy?: string; invalid: boolean; required: boolean } | null>(null);

function useFieldA11y(id: string | undefined) {
  const field = useContext(FieldContext);
  if (!field || (id ?? field.id) !== field.id) return {};
  return {
    "aria-describedby": field.describedBy,
    "aria-invalid": field.invalid || undefined,
    "aria-required": field.required || undefined,
  };
}

const control =
  "w-full rounded-xl border border-border bg-background px-3.5 text-base text-foreground shadow-sm transition-colors duration-150 placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-tea/60 aria-invalid:border-destructive sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "min-h-11", className)} {...useFieldA11y(props.id)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3 leading-relaxed", className)} {...useFieldA11y(props.id)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  const a11y = useFieldA11y(props.id);
  return (
    <div className="relative">
      <select className={cn(control, "min-h-11 appearance-none pr-10", className)} {...a11y} {...props} />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  counter,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  counter?: { value: number; max: number };
  children: ReactNode;
  className?: string;
}) {
  const describedBy = [error ? `${id}-error` : hint ? `${id}-hint` : null, counter ? `${id}-count` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && <span className="ml-0.5 text-primary" aria-hidden>*</span>}
        </Label>
        {counter && (
          <span id={`${id}-count`} className={cn("text-xs tabular-nums", counter.value > counter.max ? "font-semibold text-destructive" : "text-subtle-foreground")}>
            {counter.value.toLocaleString()}/{counter.max.toLocaleString()}
            <span className="sr-only"> characters</span>
          </span>
        )}
      </div>
      <FieldContext value={{ id, describedBy, invalid: !!error || (!!counter && counter.value > counter.max), required: !!required }}>
        {children}
      </FieldContext>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
        {description && <p id={`${id}-description`} className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span className={cn("inline-block size-6 rounded-full bg-background shadow-sm transition-[translate,background-color] duration-300 ease-spring", checked ? "translate-x-5.5 bg-brand-tea" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
