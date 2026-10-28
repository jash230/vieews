import { auth } from "@clerk/nextjs/server";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformBadge, PLATFORM_META } from "@/components/app/platform";
import { StatusBadge } from "@/components/app/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { signedReadUrl } from "@/lib/media/service";
import { getPost, type PostWithTargets } from "@/lib/posts/service";
import { AutoRefresh, CancelPostButton, RetryButton } from "./post-actions";

export const metadata = { title: "Post" };

function optionSummary(t: PostWithTargets["targets"][number]): string {
  const o = t.options;
  if (o.platform === "youtube") return `“${o.youtube.title}” · ${o.youtube.privacy}`;
  if (o.platform === "instagram") return o.instagram.format === "reel" ? "Reel" : o.instagram.format === "story" ? "Story" : "Photo post";
  return `Visibility: ${o.tiktok.privacyLevel.replaceAll("_", " ").toLowerCase()}`;
}

export default async function PostPage({ params }: PageProps<"/posts/[id]">) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const post = await getPost(userId, id).catch(() => null);
  if (!post) notFound();
  const mediaUrl = post.media ? await signedReadUrl(post.media.storage_path).catch(() => null) : null;
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
          <div className="aspect-[9/16] bg-slate-900">
            {mediaUrl && post.media?.kind === "video" && (
              <video src={mediaUrl} controls playsInline preload="metadata" className="size-full object-contain" aria-label="Post video" />
            )}
            {mediaUrl && post.media?.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="Post image" className="size-full object-contain" />
            )}
          </div>
          <CardBody className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap break-words">{post.caption || <span className="text-muted-foreground">No caption</span>}</p>
            <p className="text-xs text-muted-foreground">
              {post.scheduled_for ? `Scheduled for ${format(new Date(post.scheduled_for), "PPP p")}` : `Created ${format(new Date(post.created_at), "PPP p")}`}
              {post.source === "mcp" && " · via AI"}
            </p>
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
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{optionSummary(t)}</p>
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
