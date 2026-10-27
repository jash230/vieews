import { format, formatDistanceToNow } from "date-fns";
import { Film, ImageIcon } from "lucide-react";
import Link from "next/link";
import type { PostWithTargets } from "@/lib/posts/service";
import { PlatformIcon } from "./platform";
import { StatusBadge } from "./status";

const DOT: Record<string, string> = {
  published: "bg-success",
  failed: "bg-destructive",
  canceled: "bg-border-strong",
  pending: "bg-border-strong",
};

export function PostRow({ post, thumbUrl }: { post: PostWithTargets; thumbUrl?: string }) {
  const when = post.scheduled_for && post.status === "scheduled"
    ? `Scheduled for ${format(new Date(post.scheduled_for), "EEE d MMM, h:mm a")}`
    : formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  return (
    <li>
      <Link href={`/posts/${post.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-surface">
        <div className="relative aspect-[9/16] w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-subtle-foreground">
              {post.media?.kind === "image" ? <ImageIcon className="size-4" aria-hidden /> : <Film className="size-4" aria-hidden />}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{post.caption || <span className="text-muted-foreground">No caption</span>}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{when}{post.source === "mcp" && " · via AI"}</p>
        </div>
        <ul className="hidden items-center gap-2 sm:flex" aria-label="Platforms">
          {post.targets.map((t) => (
            <li key={t.id} className="relative" title={`${t.platform}: ${t.status}`}>
              <span className="grid size-8 place-items-center rounded-lg border border-border bg-background">
                <PlatformIcon platform={t.platform} title={`${t.platform} ${t.status}`} />
              </span>
              <span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-background ${DOT[t.status] ?? "bg-warning"}`} aria-hidden />
            </li>
          ))}
        </ul>
        <StatusBadge status={post.status} className="shrink-0" />
      </Link>
    </li>
  );
}
