import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

/** Shown wherever a page needs a project and the user has none yet. */
export function NoProject() {
  return (
    <Card>
      <EmptyState
        icon={<Sparkles />}
        title="Add the app you want to promote"
        description="Paste its App Store, Google Play or website link and Vieews sets up the rest. Or tell the copilot."
        action={<ButtonLink href="/projects/new">New project</ButtonLink>}
      />
    </Card>
  );
}
