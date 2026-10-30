import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="flex animate-fade-up flex-col items-center gap-6 text-center">
        <Logo href="/" />
        <div>
          <p className="font-display text-6xl font-semibold text-primary">404</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">This page wandered off</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">The link may be old or mistyped.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">
            Dashboard
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
