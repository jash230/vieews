import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Not found" };

export default function AppNotFound() {
  return (
    <Card>
      <EmptyState
        icon={<SearchX />}
        title="Nothing here"
        description="This post or project doesn't exist, or it was deleted."
        action={<ButtonLink href="/dashboard">Back to the dashboard</ButtonLink>}
      />
    </Card>
  );
}
