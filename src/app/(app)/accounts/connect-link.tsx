"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

/**
 * A plain <a>, not <Link>: the route redirects to the platform's sign-in page, which needs a full
 * page load. That can take a few seconds, so it shows it's working instead of inviting more clicks.
 */
export function ConnectLink({ href, label, platformLabel, primary }: { href: string; label: string; platformLabel: string; primary: boolean }) {
  const [opening, setOpening] = useState(false);
  // Coming back from the platform's page restores this one from the bfcache: drop the spinner then.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setOpening(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <a
      href={href}
      aria-disabled={opening || undefined}
      onClick={(e) => {
        if (opening) return e.preventDefault();
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) setOpening(true);
      }}
      className={cn(buttonVariants({ variant: primary ? "primary" : "secondary" }), "w-full", opening && "pointer-events-none opacity-80")}
    >
      {opening ? (
        <>
          <Loader variant="dots" size={16} label={null} /> Opening {platformLabel}…
        </>
      ) : (
        label
      )}
    </a>
  );
}
