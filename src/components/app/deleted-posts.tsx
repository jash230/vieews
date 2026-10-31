"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { deletePostAction } from "@/app/(app)/actions";

/**
 * Posts the user just deleted. Rows hide as soon as Delete is pressed and come back only if the
 * server says no, so deleting feels instant. Module state, so it survives client navigation.
 */
const deleted = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

/** Hides the post everywhere right away, then deletes it; restores it if the delete fails. */
export function deletePostNow(postId: string) {
  deleted.add(postId);
  emit();
  void deletePostAction(postId)
    .catch(() => ({ ok: false as const, error: "Couldn't reach Vieews. Check your connection and try again." }))
    .then((res) => {
      if (res.ok) return;
      deleted.delete(postId);
      emit();
      alert(`Couldn't delete the post. ${res.error}`);
    });
}

/** A post list row that disappears the moment its post is deleted. */
export function PostRowItem({ postId, ...props }: ComponentProps<"li"> & { postId: string }) {
  const hidden = useSyncExternalStore(subscribe, () => deleted.has(postId), () => false);
  return hidden ? null : <li {...props} />;
}
