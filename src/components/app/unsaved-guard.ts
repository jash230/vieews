"use client";

import { useEffect } from "react";

/**
 * Unsaved work on the current page, as the confirm text to show before throwing it away.
 * Module state, so controls outside the page (the project switcher) can ask before they reset it.
 */
const unsaved = new Set<string>();

/** Asks before discarding unsaved work. True when there's none or the user agrees. */
export function confirmDiscardUnsaved(): boolean {
  const [first] = unsaved;
  return first === undefined || confirm(first);
}

/**
 * While `active`, warns before the work is lost: closing or reloading the tab, in-app links (which
 * skip beforeunload), and anything that calls confirmDiscardUnsaved (like switching project).
 */
export function useUnsavedGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    unsaved.add(message);
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      unsaved.delete(message);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, message]);
}
