import {
  dropClipStep,
  finishJobStep,
  finishRenderStep,
  finishTranscribeStep,
  pickClipsStep,
  startPrepareStep,
  startRenderStep,
  startTranscribeStep,
  waitPhaseStep,
} from "./steps";

/** Each wait step blocks for up to ~200s, so these are the longest each phase may run. */
const MAX_WAITS = { prepare: 15, transcribe: 9, render: 6 } as const; // ~50, ~30 and ~20 minutes

const messageOf = (err: unknown) => (err && typeof err === "object" && "message" in err ? String(err.message) : String(err));

/** What the user sees: our own messages as they are, never a raw step failure with stack details. */
function userMessage(err: unknown): string {
  const message = messageOf(err);
  return /^Step .* failed after/.test(message) || message.length > 300
    ? "Something went wrong on our side while processing this video. Try again in a few minutes."
    : message;
}

async function waitFor(jobId: string, phase: string, maxWaits: number) {
  for (let i = 0; i < maxWaits; i++) {
    if (await waitPhaseStep(jobId, phase)) return;
  }
  throw new Error("This is taking far longer than it should. Try again, or try a shorter video.");
}

/**
 * Turns one long video into captioned vertical clips: download, transcribe, let the AI pick the
 * moments, then render each clip. Long phases run in the job's sandbox while steps wait on them in
 * short chunks. A clip that fails to render is dropped; the rest still finish.
 */
export async function clipVideoWorkflow(jobId: string) {
  "use workflow";
  try {
    const haveTranscript = await startPrepareStep(jobId);
    await waitFor(jobId, "prepare", MAX_WAITS.prepare);
    if (!haveTranscript) {
      await startTranscribeStep(jobId);
      await waitFor(jobId, "transcribe", MAX_WAITS.transcribe);
      await finishTranscribeStep(jobId);
    }
    const clips = await pickClipsStep(jobId);
    // All clips render at once: a link's section download is throttled to about twice real time, so one after another is the slow part.
    await Promise.all(
      clips.map(async (clip) => {
        try {
          await startRenderStep(jobId, clip.id, clip.n);
          await waitFor(jobId, `render-${clip.n}`, MAX_WAITS.render);
          await finishRenderStep(jobId, clip.id, clip.n);
        } catch (err) {
          await dropClipStep(jobId, clip.id, messageOf(err));
        }
      }),
    );
    await finishJobStep(jobId, null);
  } catch (err) {
    console.error(`clip job ${jobId} failed:`, messageOf(err));
    await finishJobStep(jobId, userMessage(err));
  }
}
