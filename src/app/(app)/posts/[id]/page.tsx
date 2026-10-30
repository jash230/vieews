import { auth } from "@clerk/nextjs/server";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformBadge, PLATFORM_META } from "@/components/app/platform";
import { StatusBadge } from "@/components/app/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { signedReadUrls } from "@/lib/media/service";
import { getPost, type PostWithTargets } from "@/lib/posts/service";
import { AutoRefresh, CancelPostButton, RetryButton } from "./post-actions";

export const metadata = { title: "Post" };

function optionSummary(t: PostWithTargets["targets"][number], photos: number): string {
  const o = t.options;
  if (o.platform === "youtube") return `“${o.youtube.title}” · ${o.youtube.privacy}`;
  if (o.platform === "instagram") {
    if (o.instagram.format === "reel") return "Reel";
    if (o.instagram.format === "story") return "Story";
    return photos > 1 ? `Carousel · ${photos} photos` : "Photo post";
  }
  const visibility = `Visibility: ${o.tiktok.privacyLevel.replaceAll("_", " ").toLowerCase()}`;
  return photos ? `${photos > 1 ? `${photos} photos` : "Photo"} · ${visibility}` : visibility;
}

export default async function PostPage({ params }: PageProps<"/posts/[id]">) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const post = await getPost(userId, id).catch(() => null);
  if (!post) notFound();
  const live = post.items.filter((m) => !m.purged_at);
  const urls = await signedReadUrls(live.map((m) => m.storage_path)).catch(() => ({}) as Record<string, string>);
  const mediaUrl = post.media && !post.media.purged_at ? urls[post.media.storage_path] ?? null : null;
  const photos = post.items.every((m) => m.kind === "image") ? post.items.length : 0;
  const inFlight = post.status === "publishing";

  return (
    <>
      {inFlight && <AutoRefresh />}
      <Link href="/posts" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All posts
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Post details</h1>
          <StatusBadge status={post.status} />
        </div>
        {post.status === "scheduled" && <CancelPostButton postId={post.id} />}
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <div className="relative aspect-[9/16] bg-slate-900">
            {mediaUrl && post.media?.kind === "video" && (
              <video src={mediaUrl} controls playsInline preload="metadata" className="size-full object-contain" aria-label="Post video" />
            )}
            {mediaUrl && post.media?.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="Post image" className="size-full object-contain" />
            )}
            {!mediaUrl && post.media?.purged_at && (
              <p className="grid size-full place-items-center px-6 text-center text-sm text-slate-300">Media was cleaned up after publishing to free storage.</p>
            )}
            {photos > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">{photos} photos</span>
            )}
          </div>
          {photos > 1 && live.length > 1 && (
            <ol className="flex gap-1.5 overflow-x-auto px-3 pt-3" aria-label="Carousel photos">
              {live.map((m, i) => (
                <li key={m.id} className="aspect-[9/16] w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {urls[m.storage_path] && <img src={urls[m.storage_path]} alt={`Photo ${i + 1}`} className="size-full object-cover" />}
                </li>
              ))}
            </ol>
          )}
          <CardBody className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap break-words">{post.caption || <span className="text-muted-foreground">No caption</span>}</p>
            <p className="text-xs text-muted-foreground">
              {post.scheduled_for ? `Scheduled for ${format(new Date(post.scheduled_for), "PPP p")}` : `Created ${format(new Date(post.created_at), "PPP p")}`}
              {post.source === "mcp" && " · via AI"}
              {post.campaign && <> · <span className="font-medium text-foreground">{post.campaign}</span></>}
            </p>
            {Object.keys(post.meta ?? {}).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer py-1 font-medium text-muted-foreground hover:text-foreground">Details saved with this post</summary>
                <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">{JSON.stringify(post.meta, null, 2)}</pre>
              </details>
            )}
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>Platforms</CardTitle></CardHeader>
          <ul className="divide-y divide-border">
            {post.targets.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                <PlatformBadge platform={t.platform} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{PLATFORM_META[t.platform].label}</p>
                    <span className="text-sm text-muted-foreground">{t.account?.display_name ?? t.account?.username}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{optionSummary(t, photos)}</p>
                  {t.error && <p className="mt-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">{t.error}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusBadge status={t.status} />
                  {t.remote_url && (
                    <a href={t.remote_url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary-soft">
                      View <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in new tab)</span>
                    </a>
                  )}
                  {t.status === "failed" && <RetryButton postId={post.id} targetId={t.id} />}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
