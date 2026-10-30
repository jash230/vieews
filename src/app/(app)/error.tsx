"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

// Keeps a failed page inside the app shell (nav and copilot stay usable) with a way to try again.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <EmptyState
        icon={<AlertTriangle />}
        title="This page couldn't load"
        description="Something went wrong on our side. Try again, or head back to the dashboard."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => retry()}>
              <RotateCw aria-hidden /> Try again
            </Button>
            <ButtonLink href="/dashboard" variant="secondary">
              Dashboard
            </ButtonLink>
          </div>
        }
      />
    </Card>
  );
}
