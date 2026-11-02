import { planShrink, UPLOAD_MAX_BYTES } from "@/lib/media/shrink-plan";

/** AAC is copied as-is when the source has it (phone videos do); budget for a re-encode otherwise. */
const MIN_AUDIO_BUDGET = 160_000;
const ATTEMPTS = 3;
/** Fraction of the limit a retry aims for, leaving room for the estimate to be off. */
const RETRY_TARGET = 0.85;

/**
 * Re-encodes a video in the browser (WebCodecs, H.264 + AAC MP4) so it fits under the upload limit.
 * Mediabunny is loaded on first use; it's only needed when someone shrinks a video.
 */
export async function shrinkVideo(file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<File> {
  if (typeof VideoEncoder === "undefined") throw new Error("This browser can't shrink videos. Try Chrome, Edge or Safari, or export a smaller file.");
  const mb = await import("mediabunny");
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error("This file has no video to shrink.");
    const audio = await input.getPrimaryAudioTrack();
    const [durationS, width, height, audioStats] = await Promise.all([
      input.computeDuration(),
      video.getDisplayWidth(),
      video.getDisplayHeight(),
      audio?.computePacketStats(200),
    ]);
    const audioBitrate = audio ? Math.max(audioStats?.averageBitrate ?? 0, MIN_AUDIO_BUDGET) : 0;

    let squeeze = 1;
    let maxLongSide: number | undefined;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const plan = planShrink({ durationS, width, height, audioBitrate, squeeze, maxLongSide });
      if (!plan) throw new Error(attempt ? "Couldn't get this video under 50 MB. Trim it and try again." : "This video is too long to fit under 50 MB. Trim it and try again.");
      const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
      const conversion = await mb.Conversion.init({
        input,
        output,
        tracks: "primary",
        video: {
          codec: "avc",
          width: plan.width,
          height: plan.height,
          fit: "fill",
          // Bake rotation into the frames so every platform shows it upright.
          allowTransformationMetadata: false,
          // Constant bitrate keeps the size predictable on everyday footage.
          quality: new mb.Quality({ bitrate: plan.videoBitrate, bitrateMode: "constant" }),
          forceTranscode: true,
        },
        audio: { codec: "aac" },
        showWarnings: false,
      });
      const lost = conversion.discardedTracks.find((d) => d.reason !== "discarded_by_user");
      if (!conversion.isValid || lost) {
        throw new Error(`This browser can't re-encode this ${lost?.track.type ?? "video"}. Try Chrome, or export a smaller file.`);
      }

      const cancel = () => void conversion.cancel();
      signal?.addEventListener("abort", cancel, { once: true });
      conversion.onProgress = (progress) => onProgress(progress);
      try {
        await conversion.execute();
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
      if (signal?.aborted) throw new DOMException("Shrink canceled", "AbortError");

      const buffer = output.target.buffer!;
      if (buffer.byteLength <= UPLOAD_MAX_BYTES) {
        return new File([buffer], file.name.replace(/\.[^.]+$/, "") + "-small.mp4", { type: "video/mp4" });
      }
      // Busy footage (grain, low light) can hit the encoder's quality floor and ignore the bitrate.
      // Fewer pixels is what makes it smaller, so scale the frame by how far this attempt overshot.
      const overshoot = buffer.byteLength / UPLOAD_MAX_BYTES;
      maxLongSide = Math.floor(Math.max(plan.width, plan.height) * Math.sqrt(RETRY_TARGET / overshoot));
      squeeze *= RETRY_TARGET;
    }
    throw new Error("Couldn't get this video under 50 MB. Trim it and try again.");
  } finally {
    input.dispose();
  }
}
