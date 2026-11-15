"use client";

import { PricingTable } from "@clerk/nextjs";
import { Flame, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

// shortcut: generic placeholders, no thumbnail of their video; add one if the paywall converts poorly.
/** What a free user sees after Find clips: their clips, locked, with the plans right below. */
export function LockedPreview({ source }: { source: string }) {
  return (
    <section aria-labelledby="locked-title" className="animate-fade-up space-y-6">
      <div>
        <h2 id="locked-title" className="font-display text-xl font-semibold">Your clips are ready to be found</h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          Subscribe and Vieews finds the best moments in <span className="font-semibold text-foreground">{source}</span>, then crops and captions them. It starts as soon as you subscribe.
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:gap-5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Card className="overflow-hidden">
              <div className="relative grid aspect-[9/16] place-items-center bg-foreground/85">
                <span className="grid size-12 place-items-center rounded-2xl bg-background/15 text-background">
                  <Lock className="size-5" />
                </span>
              </div>
              <div className="space-y-2 p-3 blur-[2px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Clip {i + 1}</span>
                  <span className="hidden items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success sm:inline-flex">
                    <Flame className="size-3" />
                    {92 - i * 7}
                  </span>
                </div>
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <div>
        <h3 className="mb-3 font-display text-lg font-semibold">Subscribe to get your clips</h3>
        {/* Checkout lands back on /clips, which starts the request waiting in this browser. */}
        <PricingTable newSubscriptionRedirectUrl="/clips" />
      </div>
    </section>
  );
}
