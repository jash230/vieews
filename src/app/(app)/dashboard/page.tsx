import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, CalendarClock, Link2, PenSquare, Scissors, Send } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PlatformBadge, PLATFORM_META } from "@/components/app/platform";
import { PostRow } from "@/components/app/post-row";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader, Skeleton } from "@/components/ui/misc";
import { NoProject } from "@/components/app/no-project";
import { getCurrentProject } from "@/lib/projects/current";
import { listProjectAccounts } from "@/lib/projects/service";
import { signedReadUrls } from "@/lib/media/service";
import { listPosts } from "@/lib/posts/service";
import { PLANS, planOf, usedToday } from "@/lib/billing/plans";
import { listClipJobs } from "@/lib/clips/service";
import { ClipJobItem } from "../clips/clip-status";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your clips, posts, plan and accounts at a glance."
        actions={
          <>
            <ButtonLink href="/compose" variant="secondary"><PenSquare aria-hidden /> Create post</ButtonLink>
            <ButtonLink href="/clips"><Scissors aria-hidden /> Find clips</ButtonLink>
          </>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[86px] rounded-3xl" />)}
      </div>
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  );
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

async function DashboardContent() {
  const { userId } = await auth.protect();
  const project = await getCurrentProject(userId);
  if (!project) return <NoProject />;
  const monthAgo = daysAgoIso(30);
  const weekAgo = daysAgoIso(7);
  const [accounts, allUpcoming, recent, publishedLately, failedLately, clipJobs, plan, clipsToday, uploadsToday] = await Promise.all([
    listProjectAccounts(userId, project.id),
    // Fetch more than we show so the "Scheduled" count isn't capped at the list length.
    listPosts(userId, { projectId: project.id, status: ["scheduled"], upcoming: true, limit: 100 }),
    listPosts(userId, { projectId: project.id, limit: 8 }),
    listPosts(userId, { projectId: project.id, status: ["published", "partial"], since: monthAgo, limit: 100 }),
    listPosts(userId, { projectId: project.id, status: ["failed", "partial"], since: weekAgo, limit: 100 }),
    listClipJobs(userId, project.id, 100),
    planOf(userId),
    usedToday(userId, "clips"),
    usedToday(userId, "uploads"),
  ]);
  const limits = PLANS[plan];
  const clipsMade = clipJobs.filter((j) => j.status === "ready" && j.created_at >= monthAgo).reduce((n, j) => n + j.clips_done, 0);
  const upcoming = allUpcoming.slice(0, 5);
  const thumbs = await signedReadUrls([...upcoming, ...recent].map((p) => p.media?.thumbnail_path ?? ""));
  const needsReauth = accounts.filter((a) => a.status === "needs_reauth");
  const published = publishedLately.length;

  const stats = [
    { label: "Connected accounts", value: accounts.length, icon: Link2, tile: "bg-brand-tea/60" },
    { label: "Scheduled", value: allUpcoming.length, icon: CalendarClock, tile: "bg-brand-olive/45" },
    { label: "Published · 30 days", value: published, icon: Send, tile: "bg-brand-teal/35" },
    { label: "Clips made · 30 days", value: clipsMade, icon: Scissors, tile: "bg-brand-tea/60" },
  ];
  const usage = [
    { label: "Videos clipped today", used: clipsToday, limit: limits.clipsPerDay },
    { label: "Uploads today", used: uploadsToday, limit: limits.uploadsPerDay },
  ];

  return (
    <>
      {(needsReauth.length > 0 || failedLately.length > 0) && (
        <Notice tone="warning" className="mb-6 space-y-1">
          {needsReauth.length > 0 && (
            <p className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>
                {needsReauth.map((a) => PLATFORM_META[a.platform].label).join(", ")} {needsReauth.length > 1 ? "need" : "needs"} reconnecting.{" "}
                <Link href="/accounts" className="font-semibold underline underline-offset-2">Go to Accounts</Link>
              </span>
            </p>
          )}
          {failedLately.length > 0 && (
            <p className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>
                {failedLately.length} {failedLately.length > 1 ? "posts" : "post"} didn&apos;t go out everywhere this week.{" "}
                <Link href="/posts?filter=failed" className="font-semibold underline underline-offset-2">View failed posts</Link>
              </span>
            </p>
          )}
        </Notice>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tile }, i) => (
          <Card key={label} className="group flex animate-fade-up items-center gap-4 p-5" style={{ animationDelay: `${i * 80}ms` }}>
            <span className={`grid size-12 place-items-center rounded-2xl text-primary ${tile}`}>
              <Icon className="size-5 group-hover:animate-wiggle" aria-hidden />
            </span>
            <div>
              <p className="animate-pop-in font-display text-3xl font-semibold tabular-nums" style={{ animationDelay: `${150 + i * 80}ms` }}>{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {accounts.length === 0 && (
            <Card>
              <EmptyState
                icon={<Link2 />}
                title={`Choose where ${project.name} posts`}
                description="Pick which connected YouTube, Instagram or TikTok accounts post for this project."
                action={<ButtonLink href={`/projects/${project.id}`}>Choose accounts</ButtonLink>}
              />
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Latest clips</CardTitle>
              <Link href="/clips" className="text-sm font-semibold text-primary hover:underline">View all</Link>
            </CardHeader>
            {clipJobs.length === 0 ? (
              <EmptyState
                icon={<Scissors />}
                title="No clips yet"
                description="Paste a long video and Vieews finds the moments worth posting."
                action={<ButtonLink href="/clips" variant="secondary">Find clips</ButtonLink>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {clipJobs.slice(0, 4).map((job) => <ClipJobItem key={job.id} job={job} />)}
              </ul>
            )}
          </Card>
          {upcoming.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Up next</CardTitle></CardHeader>
              <ul className="divide-y divide-border">
                {upcoming.map((p) => <PostRow key={p.id} post={p} thumbUrl={thumbs[p.media?.thumbnail_path ?? ""]} />)}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Recent posts</CardTitle>
              <Link href="/posts" className="text-sm font-semibold text-primary hover:underline">View all</Link>
            </CardHeader>
            {recent.length === 0 ? (
              <EmptyState
                icon={<PenSquare />}
                title="Nothing posted yet"
                description="Upload a video and publish it to every platform at once."
                action={<ButtonLink href="/compose">Create your first post</ButtonLink>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((p) => <PostRow key={p.id} post={p} thumbUrl={thumbs[p.media?.thumbnail_path ?? ""]} />)}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{limits.name} plan</CardTitle>
              <Link href="/pricing" className="text-sm font-semibold text-primary hover:underline">{plan === "free" || plan === "pro" ? "Upgrade" : "Manage"}</Link>
            </CardHeader>
            <ul className="space-y-4 px-5 pb-5">
              {usage.map(({ label, used, limit }) => (
                <li key={label}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums">{limit === 0 ? "Not on this plan" : `${Math.min(used, limit)} of ${limit}`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
                    <div className="h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${limit ? Math.min(used / limit, 1) : 0})` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {accounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Accounts</CardTitle>
                <Link href="/accounts" className="text-sm font-semibold text-primary hover:underline">Manage</Link>
              </CardHeader>
              <ul className="divide-y divide-border">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <PlatformBadge platform={a.platform} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.display_name ?? a.username}</p>
                      <p className={a.status === "active" ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"}>
                        {a.status === "active" ? PLATFORM_META[a.platform].label : "Reconnect needed"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
