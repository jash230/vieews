import { auth } from "@clerk/nextjs/server";
import { CalendarClock, PenSquare } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PostRow } from "@/components/app/post-row";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { signedReadUrls } from "@/lib/media/service";
import { listPosts } from "@/lib/posts/service";
import type { PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Posts" };

const FILTERS: { key: string; label: string; status?: PostStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled", status: ["scheduled"] },
  { key: "publishing", label: "In progress", status: ["publishing"] },
  { key: "published", label: "Published", status: ["published", "partial"] },
  { key: "failed", label: "Failed", status: ["failed", "partial"] },
];

export default function PostsPage({ searchParams }: PageProps<"/posts">) {
  return (
    <>
      <PageHeader
        title="Posts"
        description="Every post and how it did on each platform."
        actions={<ButtonLink href="/compose"><PenSquare aria-hidden /> Create post</ButtonLink>}
      />
      <Suspense fallback={<PostsSkeleton />}>
        <PostList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function FilterNav({ active }: { active: string | null }) {
  return (
    <nav aria-label="Filter posts" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.key === "all" ? "/posts" : `/posts?filter=${f.key}`}
          aria-current={f.key === active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color,translate] duration-200 ease-spring hover:-translate-y-0.5",
            f.key === active ? "border-primary bg-primary text-on-primary" : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}

function PostsSkeleton() {
  return (
    <div aria-busy="true">
      <FilterNav active={null} />
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}

async function PostList({ searchParams }: Pick<PageProps<"/posts">, "searchParams">) {
  const { userId } = await auth.protect();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.filter) ?? FILTERS[0];
  const posts = await listPosts(userId, { status: filter.status, upcoming: filter.key === "scheduled", limit: 100 });
  const thumbs = await signedReadUrls(posts.map((p) => p.media?.thumbnail_path ?? ""));

  return (
    <>
      <FilterNav active={filter.key} />
      <Card>
        {posts.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title={filter.key === "all" ? "No posts yet" : `No ${filter.label.toLowerCase()} posts`}
            description="Posts you create here or through the AI show up in this list."
            action={<ButtonLink href="/compose">Create post</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => <PostRow key={p.id} post={p} thumbUrl={thumbs[p.media?.thumbnail_path ?? ""]} />)}
          </ul>
        )}
      </Card>
    </>
  );
}
