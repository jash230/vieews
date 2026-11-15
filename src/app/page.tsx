import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { PlatformIcon } from "@/components/app/platform";
import { ButtonLink } from "@/components/ui/button";
import { LandingClipBox } from "./landing-clip-box";

export const metadata: Metadata = {
  // The home page names what Vieews does, not just the brand, in search results and tabs.
  title: { absolute: "Vieews: turn long videos into viral clips for YouTube, Instagram and TikTok" },
  alternates: { canonical: "/" },
};

// TikTok's app review wants both visible on the site without opening a menu.
const LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

async function HeaderAction() {
  const { userId } = await auth();
  return userId ? (
    <ButtonLink href="/dashboard" variant="secondary">Open app</ButtonLink>
  ) : (
    <ButtonLink href="/sign-in" variant="ghost">Sign in</ButtonLink>
  );
}

/** Like an AI chat: you land on the box. Signed in or not, Find clips carries on from here. */
export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[28rem] animate-float rounded-full bg-brand-tea/45 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-1/3 size-96 animate-float rounded-full bg-brand-teal/25 blur-3xl [animation-delay:-2s]" aria-hidden />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo href="/" />
        <Suspense fallback={<span className="h-11 w-24" aria-hidden />}>
          <HeaderAction />
        </Suspense>
      </header>

      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 pb-24 pt-8 sm:px-6">
        <div className="mb-5 flex animate-fade-up justify-center">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm">
            {(["youtube", "instagram", "tiktok"] as const).map((p) => (
              <PlatformIcon key={p} platform={p} />
            ))}
            Clips for every platform
          </span>
        </div>
        <h1 className="animate-fade-up text-center font-display text-4xl font-semibold leading-tight tracking-tight [animation-delay:80ms] sm:text-6xl">
          Turn long videos into{" "}
          <span className="relative inline-block">
            <span className="absolute inset-x-[-0.1em] bottom-[0.08em] h-[0.42em] -rotate-1 rounded-full bg-brand-tea" aria-hidden />
            <span className="relative">viral clips</span>
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg animate-fade-up text-center text-base leading-relaxed text-muted-foreground [animation-delay:160ms] sm:text-lg">
          Paste a link. Vieews finds the best moments, crops and captions them, and posts them to YouTube, Instagram and TikTok.
        </p>
        <div className="mt-8 animate-fade-up [animation-delay:240ms]">
          <LandingClipBox />
        </div>
      </main>

      <footer className="relative border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted-foreground sm:px-6">
          <p>© 2026 Vieews</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-1 font-semibold">
            {LEGAL.map(({ href, label }) => (
              <Link key={href} href={href} className="flex min-h-11 items-center rounded-xl px-3 transition-colors hover:bg-primary-soft hover:text-foreground">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
