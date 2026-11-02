import { auth } from "@clerk/nextjs/server";
import { loadChat } from "@/lib/copilot/history";
import { getCurrentProject } from "@/lib/projects/current";
import { listProjectOptions } from "@/lib/projects/options";
import { CopilotPanel } from "./copilot-panel";

/** Loads the current project's conversation for the docked copilot. Render inside Suspense. */
export async function CopilotServer() {
  const { userId } = await auth.protect();
  const [project, projects] = await Promise.all([getCurrentProject(userId), listProjectOptions(userId)]);
  const messages = project ? await loadChat(userId, project.id) : [];
  const current = project ? (projects.find((p) => p.id === project.id) ?? null) : null;
  return <CopilotPanel key={project?.id ?? "none"} project={current} projects={projects} initialMessages={messages} />;
}
