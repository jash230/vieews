import { auth } from "@clerk/nextjs/server";
import { ArrowRight, CalendarClock, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { PlatformIcon } from "@/components/app/platform";
import { PlatformOrbit } from "@/components/app/platform-orbit";
import { ButtonLink } from "@/components/ui/button";
import { WordRotate } from "@/components/ui/word-rotate";

// In-page sections the header links to. How it works and FAQ join once those sections land.
const NAV = [{ href: "#features", label: "Features" }];

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Posts on schedule",
    body: "Vieews publishes to YouTube, Instagram and TikTok on time, and checks each platform's rules before anything goes out.",
    tile: "bg-brand-tea/60",
  },
  {
    icon: Sparkles,
    title: "A copilot that guides you",
    body: "Ask what's coming up, fix your app's details or plan a post. Nothing goes public until you approve it.",
    tile: "bg-brand-olive/45",
  },
  {
    icon: Wand2,
    title: "Ads made for you",
    body: "Vieews turns your app's details and screenshots into ads and short videos for each platform.",
    tile: "bg-brand-teal/35",
    soon: true,
  },
];

// TikTok's app review wants both visible on the site without opening a menu.
const LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

// The column widens on laptops and desktops so the page doesn't sit in a narrow strip.
const SHELL = "mx-auto max-w-6xl px-4 sm:px-6 lg:max-w-7xl lg:px-10 2xl:max-w-[88rem]";

async function RedirectSignedIn() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return null;
}

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Suspense>
        <RedirectSignedIn />
      </Suspense>
      <div className="pointer-events-none absolute -left-32 -top-32 size-[28rem] animate-float rounded-full bg-brand-tea/45 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-40 size-96 animate-float rounded-full bg-brand-teal/25 blur-3xl [animation-delay:-2s]" aria-hidden />
      <div className="pointer-events-none absolute left-1/3 top-[36rem] size-80 animate-float rounded-full bg-brand-olive/25 blur-3xl [animation-delay:-4s]" aria-hidden />

      <header className="sticky top-0 z-40 bg-background/75 backdrop-blur-md">
        <div className={`flex items-center gap-2 py-4 ${SHELL}`}>
          <Logo href="/" />
          <nav aria-label="Sections" className="ml-6 hidden gap-1 sm:flex">
            {NAV.map(({ href, label }) => (
              <a key={href} href={href} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary-soft hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
          <span className="flex-1" />
          <ButtonLink href="/sign-in" variant="ghost" size="sm">Sign in</ButtonLink>
          <ButtonLink href="/sign-in" size="sm">Get started</ButtonLink>
        </div>
      </header>

      <main className={`relative pb-20 ${SHELL}`}>
        {/* From laptop size up, the hero and feature cards fill the first screen (4.75rem is the header). */}
        <div className="flex flex-col pt-10 sm:pt-16 lg:min-h-[calc(100dvh-4.75rem)] lg:pb-10 lg:pt-4">
          <section className="grid items-center gap-6 lg:flex-1 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex animate-fade-up items-center gap-3 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm">
                {(["youtube", "instagram", "tiktok"] as const).map((p, i) => (
                  <span key={p} className="animate-hop" style={{ animationDelay: `${i * 160}ms` }}>
                    <PlatformIcon platform={p} />
                  </span>
                ))}
                <span>
                  Posting to <WordRotate words={["YouTube", "Instagram", "TikTok"]} className="text-foreground" aria-hidden />
                  <span className="sr-only">YouTube, Instagram and TikTok</span>
                </span>
              </div>
              <h1 className="animate-fade-up font-display text-5xl font-semibold leading-[1.05] tracking-tight [animation-delay:80ms] sm:text-7xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
                Your app&apos;s social marketing,{" "}
                <span className="relative inline-block whitespace-nowrap">
                  <span className="absolute inset-x-[-0.1em] bottom-[0.08em] h-[0.42em] -rotate-1 rounded-full bg-brand-tea" aria-hidden />
                  <span className="relative">on autopilot.</span>
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-muted-foreground [animation-delay:160ms] lg:mx-0 2xl:text-xl">
                Vieews makes the posts, schedules them and publishes to YouTube, Instagram and TikTok. You check in, approve and steer, with a
                copilot that walks you through it.
              </p>
              <div className="mt-8 flex animate-fade-up justify-center [animation-delay:240ms] lg:justify-start">
                <ButtonLink href="/sign-in" className="min-h-12 px-7 text-base">
                  Get started <ArrowRight className="transition-[translate] duration-200 ease-spring group-hover/button:translate-x-1" aria-hidden />
                </ButtonLink>
              </div>
            </div>
            <PlatformOrbit className="mx-auto animate-pop-in [animation-delay:200ms] xl:max-w-[36rem] 2xl:max-w-[40rem]" />
          </section>

          <ul id="features" className="mt-16 grid scroll-mt-24 gap-4 sm:grid-cols-3 lg:mt-12">
            {FEATURES.map(({ icon: Icon, title, body, tile, soon }, i) => (
              <li
                key={title}
                className="animate-fade-up rounded-3xl border border-border bg-background p-6 shadow-sm"
                style={{ animationDelay: `${320 + i * 90}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid size-12 place-items-center rounded-2xl text-primary ${tile}`}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {soon && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">Coming soon</span>}
                </div>
                <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <section className="relative mt-16 overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-center text-on-primary sm:px-12">
          <div className="pointer-events-none absolute -right-10 -top-10 size-48 animate-float rounded-full bg-brand-olive/30 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-56 animate-float rounded-full bg-brand-teal/30 blur-2xl [animation-delay:-3s]" aria-hidden />
          <h2 className="relative font-display text-3xl font-semibold tracking-tight sm:text-4xl">Hand off your app&apos;s marketing.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-brand-tea">Add your app, connect your accounts once, and check in whenever you like.</p>
          <ButtonLink href="/sign-in" variant="secondary" className="relative mt-7 min-h-12 px-7 text-base">
            Get started <ArrowRight className="transition-[translate] duration-200 ease-spring group-hover/button:translate-x-1" aria-hidden />
          </ButtonLink>
        </section>
      </main>

      <footer className="relative border-t border-border bg-surface">
        <div className={`flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground ${SHELL}`}>
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
