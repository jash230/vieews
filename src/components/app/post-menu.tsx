"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { canDeletePost } from "@/lib/posts/deletable";
import type { PostRow } from "@/lib/types";
import { deletePostNow } from "./deleted-posts";

/** The "..." menu at the end of a post row. */
export function PostMenu({ post }: { post: Pick<PostRow, "id" | "status" | "updated_at"> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const deletable = canDeletePost(post);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function remove() {
    if (!confirm("Delete this post from Vieews? Anything already posted stays live on the platforms.")) return;
    setOpen(false);
    deletePostNow(post.id);
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post options"
        className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-56 animate-pop-in rounded-2xl border border-border bg-background p-1.5 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={remove}
            disabled={!deletable}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive-soft disabled:text-muted-foreground disabled:hover:bg-transparent"
          >
            <Trash2 className="size-4" aria-hidden /> Delete post
          </button>
          {!deletable && <p className="px-3 pb-2 text-xs text-muted-foreground">Can&apos;t delete while it&apos;s publishing.</p>}
        </div>
      )}
    </div>
  );
}
