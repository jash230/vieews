"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { canDeletePost } from "@/lib/posts/deletable";
import type { PostRow, PostTargetRow } from "@/lib/types";
import { deletePostNow } from "./deleted-posts";

/** The "..." menu at the end of a post row. */
export function PostMenu({ post }: { post: Pick<PostRow, "id" | "status" | "updated_at"> & { targets?: Pick<PostTargetRow, "status" | "started_at">[] } }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const item = useRef<HTMLButtonElement>(null);
  const deletable = canDeletePost(post);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    // Like a menu: focus moves into it on open, and Escape hands focus back to the "..." button.
    item.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function remove() {
    if (!deletable) return;
    if (!confirm("Delete this post from Vieews? Anything already posted stays live on the platforms.")) return;
    setOpen(false);
    deletePostNow(post.id);
  }

  return (
    <div
      ref={root}
      className="relative shrink-0"
      // Tabbing out closes it instead of leaving it open over the next row.
      onBlur={(e) => open && !root.current?.contains(e.relatedTarget as Node | null) && setOpen(false)}
    >
      <button
        ref={trigger}
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
            ref={item}
            role="menuitem"
            onClick={remove}
            // aria-disabled, not disabled: it stays focusable, so keyboard users land on it and hear why.
            aria-disabled={!deletable || undefined}
            aria-describedby={deletable ? undefined : `${post.id}-why`}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive-soft aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground aria-disabled:hover:bg-transparent"
          >
            <Trash2 className="size-4" aria-hidden /> Delete post
          </button>
          {!deletable && <p id={`${post.id}-why`} className="px-3 pb-2 text-xs text-muted-foreground">Can&apos;t delete while it&apos;s publishing.</p>}
        </div>
      )}
    </div>
  );
}
