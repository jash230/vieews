"use client";

import { useEffect } from "react";

/**
 * One-off notices (an account connected, a project drafted from a link) arrive in the URL. Once
 * shown, drop them from the address bar so a reload (or a shared link) doesn't show them again.
 */
export function ClearNoticeParams({ params = ["connected", "error"] }: { params?: string[] }) {
  const key = params.join(",");
  useEffect(() => {
    const names = key.split(",");
    const url = new URL(location.href);
    if (!names.some((n) => url.searchParams.has(n))) return;
    for (const n of names) url.searchParams.delete(n);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }, [key]);
  return null;
}
