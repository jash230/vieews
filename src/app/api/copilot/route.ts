import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { runTurn } from "@/lib/copilot/run";
import { getProject, ProjectNotFoundError } from "@/lib/projects/service";

export const maxDuration = 300;

const bodySchema = z.object({
  projectId: z.string().uuid(),
  text: z.string().max(8000),
  attachments: z.array(z.string().uuid()).max(35).default([]),
  timeZone: z.string().max(64).default("UTC"),
});

/** Accepts any zone the runtime can format, including aliases (Asia/Kolkata, UTC) that supportedValuesOf omits. */
function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Streams one copilot turn as NDJSON (one CopilotEvent per line). */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { projectId, text, attachments } = parsed.data;
  if (!text.trim() && !attachments.length) return Response.json({ error: "Say something first" }, { status: 400 });
  try {
    await getProject(userId, projectId);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) return Response.json({ error: "Project not found" }, { status: 404 });
    throw err;
  }
  const timeZone = isTimeZone(parsed.data.timeZone) ? parsed.data.timeZone : "UTC";

  const encoder = new TextEncoder();
  const events = runTurn({ userId, projectId, text: text.trim(), attachments, timeZone, signal: req.signal });
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await events.next();
      if (done) return controller.close();
      controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
