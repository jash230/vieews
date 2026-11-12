import type { Metadata } from "next";
import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <Logo href="/" />
        <p className="mt-10 font-display text-6xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">The link may be mistyped, or the page has moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">Dashboard</ButtonLink>
        </div>
      </div>
    </main>
  );
}
