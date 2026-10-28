import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { PlatformBadge, PLATFORM_META } from "@/components/app/platform";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/misc";
import { listAccounts } from "@/lib/accounts/service";
import { isPlatformConfigured, PLATFORM_ENV } from "@/lib/env";
import { cn } from "@/lib/utils";
import { PLATFORMS, type Platform } from "@/lib/types";
import { auth } from "@clerk/nextjs/server";
import { DisconnectButton } from "./disconnect-button";

export const metadata = { title: "Accounts" };

const NOTES: Record<Platform, string> = {
  youtube: "Uploads Shorts and long videos. Until Google audits your API project, YouTube keeps uploads private.",
  instagram: "Needs a Professional (Business or Creator) account. Supports Reels, photo posts and Stories.",
  tiktok: "Posts videos directly. Until TikTok audits your app, posts are only visible to you.",
};

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const { userId } = await auth.protect();
  const [accounts, sp] = await Promise.all([listAccounts(userId), searchParams]);
  const connected = typeof sp.connected === "string" ? (sp.connected as Platform) : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <>
      <PageHeader title="Accounts" description="Connect the accounts you want to post to." />
      {connected && PLATFORM_META[connected] && (
        <Notice tone="success" className="mb-6">{PLATFORM_META[connected].label} connected.</Notice>
      )}
      {error && <Notice tone="error" className="mb-6">{error}</Notice>}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLATFORMS.map((platform, i) => {
          const list = accounts.filter((a) => a.platform === platform);
          const meta = PLATFORM_META[platform];
          return (
            <Card key={platform} className="flex animate-fade-up flex-col" style={{ animationDelay: `${i * 80}ms` }}>
              <CardHeader className="flex-nowrap">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={platform} />
                  <div>
                    <CardTitle>{meta.label}</CardTitle>
                    <CardDescription>{list.length ? `${list.length} connected` : "Not connected"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="flex flex-1 flex-col gap-4">
                <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {NOTES[platform]}
                </p>
                {list.length > 0 && (
                  <ul className="space-y-2">
                    {list.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                        {a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.avatar_url} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
                        ) : (
                          <span className="size-9 rounded-full bg-muted" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{a.display_name ?? a.username}</p>
                          {a.status === "active" ? (
                            <p className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" aria-hidden />Ready to post</p>
                          ) : (
                            <p className="flex items-center gap-1 text-xs text-destructive" title={a.last_error ?? undefined}>
                              <AlertTriangle className="size-3.5" aria-hidden />Reconnect needed
                            </p>
                          )}
                        </div>
                        <DisconnectButton accountId={a.id} name={a.display_name ?? a.username ?? meta.label} />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto pt-2">
                  {isPlatformConfigured(platform) ? (
                    // A plain <a>, not <Link>: the route redirects to the platform's sign-in page, which needs a full page load.
                    <a href={`/api/connect/${platform}`} className={cn(buttonVariants({ variant: list.length ? "secondary" : "primary" }), "w-full")}>
                      {list.some((a) => a.status === "needs_reauth") ? `Reconnect ${meta.label}` : list.length ? `Connect another` : `Connect ${meta.label}`}
                    </a>
                  ) : (
                    <>
                      <Button variant="secondary" disabled className="w-full">Not set up</Button>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Add {PLATFORM_ENV[platform].vars.map((v) => <code key={v} className="font-mono">{v} </code>)}
                        to <code className="font-mono">.env.local</code> and restart. See SETUP.md step {PLATFORM_ENV[platform].setupStep}.
                      </p>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
