import { beforeEach, describe, expect, it, vi } from "vitest";

// Without the Workflow compiler "use workflow" is a no-op, so the orchestration runs as plain code against fake steps.
const steps = vi.hoisted(() => ({
  startPrepareStep: vi.fn<(jobId: string) => Promise<void>>(),
  waitPhaseStep: vi.fn<(jobId: string, phase: string) => Promise<boolean>>(),
  startTranscribeStep: vi.fn<(jobId: string) => Promise<void>>(),
  finishTranscribeStep: vi.fn<(jobId: string) => Promise<void>>(),
  pickClipsStep: vi.fn<(jobId: string) => Promise<{ id: string; n: number }[]>>(),
  startRenderStep: vi.fn<(jobId: string, clipId: string, n: number) => Promise<void>>(),
  finishRenderStep: vi.fn<(jobId: string, clipId: string, n: number) => Promise<void>>(),
  dropClipStep: vi.fn<(jobId: string, clipId: string, reason: string) => Promise<void>>(),
  finishJobStep: vi.fn<(jobId: string, error: string | null) => Promise<void>>(),
}));
vi.mock("@/workflows/clip/steps", () => steps);

const { clipVideoWorkflow } = await import("@/workflows/clip");

beforeEach(() => {
  vi.resetAllMocks();
  steps.waitPhaseStep.mockResolvedValue(true);
  steps.pickClipsStep.mockResolvedValue([
    { id: "c0", n: 0 },
    { id: "c1", n: 1 },
  ]);
});

describe("clipVideoWorkflow", () => {
  it("runs every phase and renders each clip", async () => {
    await clipVideoWorkflow("j");
    expect(steps.waitPhaseStep.mock.calls.map((c) => c[1])).toEqual(["prepare", "transcribe", "render-0", "render-1"]);
    expect(steps.finishRenderStep).toHaveBeenCalledTimes(2);
    expect(steps.finishJobStep).toHaveBeenCalledWith("j", null);
  });

  it("keeps waiting while a phase is still running", async () => {
    steps.waitPhaseStep.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    await clipVideoWorkflow("j");
    expect(steps.waitPhaseStep.mock.calls.slice(0, 3).map((c) => c[1])).toEqual(["prepare", "prepare", "prepare"]);
    expect(steps.finishJobStep).toHaveBeenCalledWith("j", null);
  });

  it("gives up on a phase that never finishes", async () => {
    steps.waitPhaseStep.mockResolvedValue(false);
    await clipVideoWorkflow("j");
    expect(steps.startTranscribeStep).not.toHaveBeenCalled();
    expect(steps.finishJobStep).toHaveBeenCalledWith("j", expect.stringContaining("taking far longer"));
  });

  it("fails the job with the step's message", async () => {
    steps.startPrepareStep.mockRejectedValueOnce(new Error("This video is private"));
    await clipVideoWorkflow("j");
    expect(steps.finishJobStep).toHaveBeenCalledWith("j", "This video is private");
  });

  it("drops a clip that fails to render and finishes the rest", async () => {
    steps.finishRenderStep.mockRejectedValueOnce(new Error("ffmpeg died"));
    await clipVideoWorkflow("j");
    expect(steps.dropClipStep).toHaveBeenCalledWith("j", "c0", "ffmpeg died");
    expect(steps.finishRenderStep).toHaveBeenCalledWith("j", "c1", 1);
    expect(steps.finishJobStep).toHaveBeenCalledWith("j", null);
  });

  it("hides raw step failures from the user", async () => {
    steps.pickClipsStep.mockRejectedValueOnce(new Error('Step "step//./src/workflows/clip/steps//pickClipsStep" failed after 3 retries: 401 {"type":"error"}'));
    await clipVideoWorkflow("j");
    expect(steps.finishJobStep).toHaveBeenCalledWith("j", expect.stringContaining("Something went wrong on our side"));
  });
});
