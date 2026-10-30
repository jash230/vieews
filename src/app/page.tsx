import { auth } from "@clerk/nextjs/server";
import { ArrowRight, Bot, CalendarClock, UploadCloud } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { PlatformIcon } from "@/components/app/platform";
import { PlatformOrbit } from "@/components/app/platform-orbit";
import { ButtonLink } from "@/components/ui/button";
import { WordRotate } from "@/components/ui/word-rotate";

const FEATURES = [
  { icon: UploadCloud, title: "Upload once", body: "Drop a Reel, Short or TikTok. Vieews checks it against each platform's rules before you post.", tile: "bg-brand-tea/60" },
  { icon: CalendarClock, title: "Post now or later", body: "Publish instantly or pick a time. Track every platform's result in one place.", tile: "bg-brand-olive/45" },
  { icon: Bot, title: "AI-ready", body: "A built-in MCP server lets Claude upload and schedule posts for you.", tile: "bg-brand-teal/35" },
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

      <header className={`relative py-4 ${SHELL}`}>
        <Logo href="/" />
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
                <span>One upload, three platforms</span>
              </div>
              <h1 className="animate-fade-up font-display text-5xl font-semibold leading-[1.05] tracking-tight [animation-delay:80ms] sm:text-7xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
                Upload once.
                <br />
                Post to{" "}
                <span className="relative inline-block">
                  <span className="absolute inset-x-[-0.1em] bottom-[0.08em] h-[0.42em] -rotate-1 rounded-full bg-brand-tea" aria-hidden />
                  <WordRotate words={["everywhere", "YouTube", "Instagram", "TikTok"]} className="relative -mb-[0.15em] pb-[0.15em]" aria-hidden />
                  <span className="sr-only">YouTube, Instagram and TikTok</span>
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-muted-foreground [animation-delay:160ms] lg:mx-0 2xl:text-xl">
                Publish Reels, Shorts and TikToks to all your accounts from one place, on your schedule.
              </p>
              <div className="mt-8 flex animate-fade-up justify-center [animation-delay:240ms] lg:justify-start">
                <ButtonLink href="/sign-in" className="min-h-12 px-7 text-base">
                  Get started <ArrowRight className="transition-[translate] duration-200 ease-spring group-hover/button:translate-x-1" aria-hidden />
                </ButtonLink>
              </div>
            </div>
            <PlatformOrbit className="mx-auto animate-pop-in [animation-delay:200ms] xl:max-w-[36rem] 2xl:max-w-[40rem]" />
          </section>

          <ul className="mt-16 grid gap-4 sm:grid-cols-3 lg:mt-12">
            {FEATURES.map(({ icon: Icon, title, body, tile }, i) => (
              <li
                key={title}
                className="animate-fade-up rounded-3xl border border-border bg-background p-6 shadow-sm"
                style={{ animationDelay: `${320 + i * 90}ms` }}
              >
                <span className={`grid size-12 place-items-center rounded-2xl text-primary ${tile}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <section className="relative mt-16 overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-center text-on-primary sm:px-12">
          <div className="pointer-events-none absolute -right-10 -top-10 size-48 animate-float rounded-full bg-brand-olive/30 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-56 animate-float rounded-full bg-brand-teal/30 blur-2xl [animation-delay:-3s]" aria-hidden />
          <h2 className="relative font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your next video, everywhere at once.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-brand-tea">Connect YouTube, Instagram and TikTok, then publish from one place.</p>
          <ButtonLink href="/sign-in" variant="secondary" className="relative mt-7 min-h-12 px-7 text-base">
            Start posting <ArrowRight className="transition-[translate] duration-200 ease-spring group-hover/button:translate-x-1" aria-hidden />
          </ButtonLink>
        </section>
      </main>
    </div>
  );
}
