"use client";

import { format } from "date-fns";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * A date in the viewer's own time zone. Server components run in UTC on Vercel, so formatting there
 * shows the wrong hour; this renders on the client only (empty during SSR, so no hydration mismatch).
 */
export function LocalTime({ iso, fmt, className }: { iso: string; fmt: string; className?: string }) {
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {onClient ? format(new Date(iso), fmt) : ""}
    </time>
  );
}
