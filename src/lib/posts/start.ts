import "server-only";
import { start } from "workflow/api";
import { publishPostWorkflow, retryTargetWorkflow } from "@/workflows/publish";

/** Queues a post's publish workflow. It starts right away, or sleeps until a scheduled post is due. */
export async function startPublishPost(postId: string) {
  await start(publishPostWorkflow, [postId]);
}

/** Queues a workflow that publishes one failed target again. */
export async function startRetryTarget(targetId: string) {
  await start(retryTargetWorkflow, [targetId]);
}
