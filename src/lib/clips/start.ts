import "server-only";
import { start } from "workflow/api";
import { clipVideoWorkflow } from "@/workflows/clip";

/** Queues the clipping workflow for a job; it starts right away. */
export async function startClipJob(jobId: string) {
  await start(clipVideoWorkflow, [jobId]);
}
