import { PageHeader } from "@/components/ui/misc";
import { NewProjectForm } from "./new-project-form";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="New project" description="Paste your app's link. Vieews pulls the screenshots and drafts everything ads need; you review it next." />
      <NewProjectForm />
    </>
  );
}
