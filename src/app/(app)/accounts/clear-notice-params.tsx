"use client";

import { useEffect } from "react";

/**
 * The connect/callback notices arrive in the URL. Once shown, drop them from the address bar so a
 * reload (or a shared link) doesn't show "connected" again after the account is gone.
 */
export function ClearNoticeParams() {
  useEffect(() => {
    const url = new URL(location.href);
    if (!url.searchParams.has("connected") && !url.searchParams.has("error")) return;
    url.searchParams.delete("connected");
    url.searchParams.delete("error");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
