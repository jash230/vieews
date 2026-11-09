"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

// Keeps the sidebar and copilot when a page fails to load, with a way to try again.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  useEffect(() => console.error(error), [error]);
  return (
    <Card>
      <EmptyState
        icon={<AlertTriangle />}
        title="This page didn't load"
        description="Something went wrong on our side. Your posts and accounts are safe. Try again, or head back to the dashboard."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button loading={pending} onClick={() => startTransition(() => retry())}>
              <RotateCcw /> Try again
            </Button>
            <ButtonLink href="/dashboard" variant="secondary">Go to dashboard</ButtonLink>
          </div>
        }
      />
    </Card>
  );
}
