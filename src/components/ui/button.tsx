import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Loader } from "./loader";

export const buttonVariants = cva(
  "group/button inline-flex min-h-11 select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 text-sm font-bold transition-[background-color,border-color,color,box-shadow,translate,scale] duration-200 ease-spring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Lifts on hover and squishes onto its olive lip when pressed.
        primary: "bg-primary text-on-primary shadow-pop hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-[3px] active:shadow-none",
        secondary: "border border-border bg-background text-foreground shadow-sm hover:-translate-y-0.5 hover:border-border-strong hover:bg-primary-soft active:translate-y-0",
        ghost: "text-muted-foreground hover:bg-primary-soft hover:text-foreground",
        destructive: "border border-destructive/30 bg-background text-destructive hover:bg-destructive-soft",
      },
      size: {
        md: "",
        sm: "min-h-9 rounded-xl px-3.5 text-[13px]",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Loader variant="dots" size={16} label={null} />}
      {children}
    </button>
  );
}

export function ButtonLink({ className, variant, size, ...props }: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
