import { auth } from "@clerk/nextjs/server";
import { ArrowRight, Bot, CalendarClock, UploadCloud } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { PlatformIcon } from "@/components/app/platform";
import { ButtonLink } from "@/components/ui/button";

const FEATURES = [
  { icon: UploadCloud, title: "Upload once", body: "Drop a Reel, Short or TikTok. Vieews checks it against each platform's rules before you post." },
  { icon: CalendarClock, title: "Post now or later", body: "Publish instantly or pick a time. Track every platform's result in one place." },
  { icon: Bot, title: "AI-ready", body: "A built-in MCP server lets Claude upload and schedule posts for you." },
];

async function RedirectSignedIn() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return null;
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(60rem_30rem_at_50%_-10%,var(--primary-soft),transparent)]">
      <Suspense>
        <RedirectSignedIn />
      </Suspense>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ButtonLink href="/sign-in" variant="secondary" size="sm">Sign in</ButtonLink>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <PlatformIcon platform="youtube" />
            <PlatformIcon platform="instagram" />
            <PlatformIcon platform="tiktok" />
            <span>One upload, three platforms</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Upload once.<br />
            <span className="text-primary">Post everywhere.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Publish Reels, Shorts and TikToks to all your accounts from one place, on your schedule.
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/sign-in" className="px-6">
              Get started <ArrowRight aria-hidden />
            </ButtonLink>
          </div>
        </div>
        <ul className="mt-20 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
