import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function AppNotFound() {
  return (
    <Card>
      <EmptyState
        icon={<SearchX />}
        title="Not found"
        description="This page doesn't exist, or it was deleted."
        action={<ButtonLink href="/dashboard">Back to dashboard</ButtonLink>}
      />
    </Card>
  );
}
