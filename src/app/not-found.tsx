import type { Metadata } from "next";
import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-center">
      <div className="flex flex-col items-center">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">The link may be broken, or the page was moved.</p>
        <ButtonLink href="/" className="mt-6">Go home</ButtonLink>
      </div>
    </main>
  );
}
