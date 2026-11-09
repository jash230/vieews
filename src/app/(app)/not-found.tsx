import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function AppNotFound() {
  return (
    <Card>
      <EmptyState
        icon={<SearchX />}
        title="We couldn't find that"
        description="It may have been deleted, or it belongs to another account."
        action={<ButtonLink href="/dashboard">Go to dashboard</ButtonLink>}
      />
    </Card>
  );
}
