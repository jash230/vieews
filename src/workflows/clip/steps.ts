import { FatalError } from "workflow";
import type { PlannedClip } from "@/lib/clips/service";

// Steps load the clipping code lazily: the workflow bundle replaces these bodies and has no Node.js,
// so a top-level import would drag Supabase, the sandbox SDK and "server-only" into it.
// A ClipError is the user's to fix (a private video, a blocked link), so it becomes a FatalError
// and isn't retried; anything else (a network blip) gets the normal step retries.

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  const { ClipError } = await import("@/lib/clips/service");
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ClipError) throw new FatalError(err.message);
    // A rejected API key won't fix itself on retry.
    const status = (err as { status?: number } | null)?.status;
    if (status === 401 || status === 403) {
      console.error(err);
      throw new FatalError("An AI service rejected our API key, so this video couldn't be processed. Try again later.");
    }
    throw err;
  }
}

export async function startPrepareStep(jobId: string): Promise<void> {
  "use step";
  const s = await import("@/lib/clips/service");
  await guard(() => s.startPrepare(jobId));
}

/** True once the phase finished; false when it's still running after a few minutes. */
export async function waitPhaseStep(jobId: string, phase: string): Promise<boolean> {
  "use step";
  const s = await import("@/lib/clips/service");
  return guard(() => s.waitForPhase(jobId, phase));
}

export async function startTranscribeStep(jobId: string): Promise<void> {
  "use step";
  const s = await import("@/lib/clips/service");
  await guard(() => s.startTranscribe(jobId));
}

export async function finishTranscribeStep(jobId: string): Promise<void> {
  "use step";
  const s = await import("@/lib/clips/service");
  await guard(() => s.finishTranscribe(jobId));
}

export async function pickClipsStep(jobId: string): Promise<PlannedClip[]> {
  "use step";
  const s = await import("@/lib/clips/service");
  return guard(() => s.pickClips(jobId));
}

export async function startRenderStep(jobId: string, clipId: string, n: number): Promise<void> {
  "use step";
  const s = await import("@/lib/clips/service");
  await guard(() => s.startRender(jobId, clipId, n));
}

export async function finishRenderStep(jobId: string, clipId: string, n: number): Promise<void> {
  "use step";
  const s = await import("@/lib/clips/service");
  await guard(() => s.finishRender(jobId, clipId, n));
}

export async function dropClipStep(jobId: string, clipId: string, reason: string): Promise<void> {
  "use step";
  const s = await import("@/lib/clips/service");
  await s.dropClip(jobId, clipId, reason);
}

export async function finishJobStep(jobId: string, error: string | null): Promise<void> {
  "use step";
  const s = await import("@/lib/clips/service");
  await s.finishJob(jobId, error);
}
