import { auth } from "@clerk/nextjs/server";
import { loadChat } from "@/lib/copilot/history";
import { getCurrentProject } from "@/lib/projects/current";
import { listProjectOptions } from "@/lib/projects/options";
import { CopilotPanel } from "./copilot-panel";

/** Loads the current project's conversation for the docked copilot. Render inside Suspense. */
export async function CopilotServer() {
  const { userId } = await auth.protect();
  // The current project first: it may create the user's first one, which the list must include.
  const project = await getCurrentProject(userId);
  const [projects, messages] = await Promise.all([listProjectOptions(userId), loadChat(userId, project.id)]);
  const current = projects.find((p) => p.id === project.id) ?? null;
  const blank = !project.store_url && !project.kit.oneLiner;
  return <CopilotPanel key={project.id} project={current} projects={projects} initialMessages={messages} blank={blank} />;
}
