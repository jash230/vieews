import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, CalendarClock, Link2, PenSquare, Send } from "lucide-react";
import Link from "next/link";
import { PlatformBadge, PLATFORM_META } from "@/components/app/platform";
import { PostRow } from "@/components/app/post-row";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { listAccounts } from "@/lib/accounts/service";
import { signedReadUrls } from "@/lib/media/service";
import { listPosts } from "@/lib/posts/service";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { userId } = await auth.protect();
  const [accounts, upcoming, recent] = await Promise.all([
    listAccounts(userId),
    listPosts(userId, { status: ["scheduled"], upcoming: true, limit: 5 }),
    listPosts(userId, { limit: 8 }),
  ]);
  const thumbs = await signedReadUrls([...upcoming, ...recent].map((p) => p.media?.thumbnail_path ?? ""));
  const needsReauth = accounts.filter((a) => a.status === "needs_reauth");
  const published = recent.filter((p) => p.status === "published" || p.status === "partial").length;

  const stats = [
    { label: "Connected accounts", value: accounts.length, icon: Link2, tile: "bg-brand-tea/60" },
    { label: "Scheduled", value: upcoming.length, icon: CalendarClock, tile: "bg-brand-olive/45" },
    { label: "Recently published", value: published, icon: Send, tile: "bg-brand-teal/35" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything you've posted and what's coming up."
        actions={<ButtonLink href="/compose"><PenSquare aria-hidden /> Create post</ButtonLink>}
      />

      {needsReauth.length > 0 && (
        <Notice tone="warning" className="mb-6 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            {needsReauth.map((a) => PLATFORM_META[a.platform].label).join(", ")} needs reconnecting.{" "}
            <Link href="/accounts" className="font-semibold underline underline-offset-2">Go to Accounts</Link>
          </span>
        </Notice>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
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

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Link2 />}
            title="Connect your first account"
            description="Link YouTube, Instagram or TikTok so Vieews can post for you."
            action={<ButtonLink href="/accounts">Connect accounts</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
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
          <Card className="h-fit">
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
        </div>
      )}
    </>
  );
}
