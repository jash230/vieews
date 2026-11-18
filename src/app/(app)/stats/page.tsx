import { auth } from "@clerk/nextjs/server";
import { Eye, Film, Heart, Info, Link2, Scissors, Send, Upload, Users, Video, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PlatformBadge, PlatformIcon, PLATFORM_META } from "@/components/app/platform";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { listAccountStats, METRICS, totalStats, usageTotals, type AccountStatsView, type Metric } from "@/lib/stats/service";
import { PLATFORMS, type Platform } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

export const metadata = { title: "Stats" };

const METRIC_META: Record<Metric, { label: string; icon: LucideIcon; tile: string }> = {
  followers: { label: "Followers", icon: Users, tile: "bg-brand-tea/60" },
  views: { label: "Views", icon: Eye, tile: "bg-brand-teal/35" },
  likes: { label: "Likes", icon: Heart, tile: "bg-brand-olive/45" },
  posts: { label: "Posts", icon: Film, tile: "bg-brand-tea/60" },
};

const BAR: Record<Platform, string> = { youtube: "bg-youtube", instagram: "bg-instagram", tiktok: "bg-tiktok" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Stats" description="Followers, views and posts from all your connected accounts, added up." />
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent />
      </Suspense>
    </>
  );
}

function StatsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[150px] rounded-3xl" />)}
      </div>
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}

async function StatsContent() {
  const { userId } = await auth.protect();
  const [accounts, usage] = await Promise.all([listAccountStats(userId), usageTotals(userId)]);
  const total = totalStats(accounts.map((a) => a.stats));
  const kpis = METRICS.filter((m) => total[m] != null);
  const reporting = (m: Metric) => accounts.filter((a) => a.stats?.[m] != null).length;
  // Metrics two or more platforms report, split by platform: one platform alone is just 100%.
  const shares = METRICS.map((m) => ({
    metric: m,
    parts: PLATFORMS.map((p) => ({ platform: p, value: totalStats(accounts.filter((a) => a.platform === p).map((a) => a.stats))[m] }))
      .filter((part): part is { platform: Platform; value: number } => part.value != null),
  })).filter((s) => s.parts.length > 1 && s.parts.some((p) => p.value > 0));

  return (
    <>
      {kpis.length > 0 && (
        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
          {kpis.map((m, i) => {
            const { label, icon: Icon, tile } = METRIC_META[m];
            const n = reporting(m);
            return (
              <StatCard
                key={m}
                index={i}
                label={label}
                value={total[m]!}
                icon={<Icon />}
                tile={tile}
                hint={n === accounts.length ? `From ${n} ${n === 1 ? "account" : "accounts"}` : `From ${n} of ${accounts.length} accounts`}
              />
            );
          })}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="@container self-start">
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <Link href="/accounts" className="text-sm font-semibold text-primary hover:underline">Manage</Link>
          </CardHeader>
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Link2 />}
              title="No accounts connected"
              description="Connect YouTube, Instagram or TikTok to see your followers and views here."
              action={<ButtonLink href="/accounts">Connect an account</ButtonLink>}
            />
          ) : (
            <>
              <div className="hidden gap-3 px-5 pt-3 text-xs font-semibold text-subtle-foreground @2xl:grid @2xl:grid-cols-[minmax(0,1fr)_24rem]" aria-hidden>
                <span>Account</span>
                <span className="grid grid-cols-4 gap-2 text-right">
                  {METRICS.map((m) => <span key={m}>{METRIC_META[m].label}</span>)}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {accounts.map((a) => <AccountRow key={a.id} account={a} />)}
              </ul>
            </>
          )}
        </Card>

        <div className="space-y-6">
          {shares.length > 0 && (
            <Card>
              <CardHeader><CardTitle>By platform</CardTitle></CardHeader>
              <div className="space-y-5 px-5 py-4">
                {shares.map((s) => <ShareBar key={s.metric} {...s} />)}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Your Vieews usage</CardTitle>
              <span className="text-xs font-semibold text-subtle-foreground">All time</span>
            </CardHeader>
            <dl className="divide-y divide-border">
              <UsageRow icon={Send} label="Posts published" value={usage.posts} />
              <UsageRow icon={Upload} label="Uploads to platforms" value={usage.uploads} />
              <UsageRow icon={Scissors} label="Clips made" value={usage.clips} />
              <UsageRow icon={Video} label="Videos clipped" value={usage.videosClipped} />
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function AccountRow({ account: a }: { account: AccountStatsView }) {
  const platform = PLATFORM_META[a.platform].label;
  return (
    <li className="grid gap-3 px-5 py-4 @2xl:grid-cols-[minmax(0,1fr)_24rem] @2xl:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <PlatformBadge platform={a.platform} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{a.name || platform}</p>
          <p className="truncate text-xs text-muted-foreground">{a.username ? `@${a.username}` : platform}</p>
        </div>
      </div>
      {a.stats ? (
        <dl className="grid grid-cols-4 gap-2 @2xl:text-right">
          {METRICS.map((m) => {
            const v = a.stats![m];
            return (
              <div key={m} className="min-w-0">
                <dt className="truncate text-xs text-subtle-foreground @2xl:sr-only">{METRIC_META[m].label}</dt>
                <dd className="font-semibold tabular-nums" title={v == null ? undefined : formatCount(v, true)}>
                  {v == null ? (
                    <>
                      <span className="text-subtle-foreground" aria-hidden>—</span>
                      <span className="sr-only">Not shared by {platform}</span>
                    </>
                  ) : (
                    formatCount(v)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{problemText(a)}</span>
        </p>
      )}
    </li>
  );
}

function problemText(a: AccountStatsView): ReactNode {
  const reconnect = <Link href="/accounts" className="font-semibold text-primary underline underline-offset-2">Reconnect it</Link>;
  if (a.problem === "reauth") return <>This account was signed out. {reconnect} to see its stats.</>;
  if (a.problem === "permission" && a.platform === "tiktok") return "TikTok doesn't share stats with Vieews yet.";
  if (a.problem === "permission") return <>Vieews can&apos;t read this account&apos;s stats yet. {reconnect} to allow it.</>;
  return "Couldn't load stats right now. Refresh to try again.";
}

function ShareBar({ metric, parts }: { metric: Metric; parts: { platform: Platform; value: number }[] }) {
  const sum = parts.reduce((n, p) => n + p.value, 0);
  const pct = (v: number) => Math.round((v / sum) * 100);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{METRIC_META[metric].label}</p>
      {/* The legend below says the same in text, so the bar itself stays out of the accessibility tree. */}
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
        {parts.map((p) => p.value > 0 && (
          <span key={p.platform} className={cn("h-full border-r-2 border-background last:border-r-0", BAR[p.platform])} style={{ width: `${(p.value / sum) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.platform} className="flex items-center gap-1.5">
            <PlatformIcon platform={p.platform} className="size-3.5" />
            <span className="text-muted-foreground">{PLATFORM_META[p.platform].label}</span>
            <span className="font-semibold tabular-nums">{formatCount(p.value)}</span>
            <span className="text-subtle-foreground tabular-nums">({pct(p.value)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsageRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden><Icon className="size-4" /></span>
      <dt className="flex-1 text-sm text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums" title={formatCount(value, true)}>{formatCount(value)}</dd>
    </div>
  );
}
