import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { getVideoMetadata, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { loadKit } from "../kit";
import { adSpecSchema, FPS, mediaPaths, sceneDurationS, type AdSpec, type SizeName } from "../spec";
import { main, parseArgs, str } from "./util";

// npm run render -- --spec runs/<id>/ad.json [--app <slug>]
// Renders the ad: slides (TikTok 1080×1920 + Instagram 1080×1350 JPEGs) and/or the 1080×1920 MP4,
// then checks them against platform specs and writes contact-sheet.jpg (every scene in one image).

const ENTRY = resolve(import.meta.dirname, "../../remotion/index.ts");
const MB = 1024 * 1024;
/** Supabase's free plan caps uploads at 50 MB; Instagram photos at 8 MB. */
const LIMITS = { videoBytes: 45 * MB, photoBytes: 8 * MB, minS: 3, maxS: 60 };

function stageMedia(spec: AdSpec, runDir: string, publicDir: string, app?: string): AdSpec {
  const kitMedia = app ? loadKit(app).mediaDir : null;
  const map = new Map<string, string>();
  mediaPaths(spec).forEach((path, i) => {
    let source: string;
    if (path.startsWith("kit:")) {
      if (!kitMedia) throw new Error(`${path} needs --app <slug>`);
      source = join(kitMedia, path.slice(4));
    } else {
      source = isAbsolute(path) ? path : join(runDir, path);
    }
    if (!existsSync(source)) throw new Error(`Media not found: ${path} (${source})`);
    const staged = `m/${i}${extname(source).toLowerCase()}`;
    mkdirSync(join(publicDir, "m"), { recursive: true });
    copyFileSync(source, join(publicDir, staged));
    map.set(path, staged);
  });
  // Swap every media path in the spec for its staged name.
  return JSON.parse(JSON.stringify(spec), (_key, value) => (typeof value === "string" && map.has(value) ? map.get(value) : value)) as AdSpec;
}

const dataUrl = (buffer: Buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`;

await main(async () => {
  const args = parseArgs();
  const specPath = resolve(str(args, "spec"));
  const runDir = dirname(specPath);
  const parsed = adSpecSchema.safeParse(JSON.parse(readFileSync(specPath, "utf8")));
  if (!parsed.success) throw new Error(`ad.json is invalid:\n${parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`);

  const publicDir = join(runDir, "public");
  const outDir = join(runDir, "out");
  rmSync(publicDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const spec = stageMedia(parsed.data, runDir, publicDir, typeof args.app === "string" ? args.app : undefined);

  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir });
  const concurrency = Math.max(1, Math.min(4, availableParallelism() - 1));
  const files: { tiktok: string[]; instagram: string[]; video: string | null } = { tiktok: [], instagram: [], video: null };
  const problems: string[] = [];

  if (spec.kind === "slides") {
    for (const [size, key] of [["vertical", "tiktok"], ["portrait", "instagram"]] as const) {
      for (let index = 0; index < spec.scenes.length; index++) {
        const inputProps = { spec, size, index };
        const composition = await selectComposition({ serveUrl, id: "Slide", inputProps });
        const output = join(outDir, `${key}-${String(index + 1).padStart(2, "0")}.jpg`);
        await renderStill({ composition, serveUrl, output, inputProps, imageFormat: "jpeg", jpegQuality: 90 });
        if (statSync(output).size > LIMITS.photoBytes) problems.push(`${output} is over 8 MB`);
        files[key].push(output);
      }
    }
  }

  // Every ad gets a vertical video: the ad itself, or the slideshow's version for YouTube Shorts.
  const videoProps = { spec, size: "vertical" as SizeName };
  const adComposition = await selectComposition({ serveUrl, id: "Ad", inputProps: videoProps });
  files.video = join(outDir, "video.mp4");
  await renderMedia({
    composition: adComposition,
    serveUrl,
    codec: "h264",
    outputLocation: files.video,
    inputProps: videoProps,
    videoBitrate: "4M",
    enforceAudioTrack: true,
    concurrency,
  });

  const meta = await getVideoMetadata(files.video);
  const sizeBytes = statSync(files.video).size;
  if (meta.width !== 1080 || meta.height !== 1920) problems.push(`video is ${meta.width}×${meta.height}, expected 1080×1920`);
  if (meta.codec !== "h264") problems.push(`video codec is ${meta.codec}, expected h264`);
  if (meta.audioCodec !== "aac") problems.push(`audio codec is ${meta.audioCodec}, expected aac`);
  const durationS = meta.durationInSeconds ?? 0;
  if (durationS < LIMITS.minS || durationS > LIMITS.maxS) problems.push(`video is ${durationS.toFixed(1)}s; keep it ${LIMITS.minS}–${LIMITS.maxS}s`);
  if (sizeBytes > LIMITS.videoBytes) problems.push(`video is ${(sizeBytes / MB).toFixed(1)} MB; keep it under 45 MB`);

  // Contact sheet: every slide, or a frame from each scene ~60% in (after text has landed).
  const thumbs: { src: string; label: string }[] = [];
  if (spec.kind === "slides") {
    for (let index = 0; index < spec.scenes.length; index++) {
      const inputProps = { spec, size: "vertical" as SizeName, index };
      const composition = await selectComposition({ serveUrl, id: "Slide", inputProps });
      const { buffer } = await renderStill({ composition, serveUrl, inputProps, output: null, imageFormat: "jpeg", scale: 0.25 });
      thumbs.push({ src: dataUrl(buffer!), label: `slide ${index + 1}: ${spec.scenes[index].type}` });
    }
  } else {
    let start = 0;
    for (const scene of spec.scenes) {
      const frames = Math.round(sceneDurationS(scene) * FPS);
      const frame = start + Math.floor(frames * 0.6);
      start += frames;
      const { buffer } = await renderStill({ composition: adComposition, serveUrl, inputProps: videoProps, frame, output: null, imageFormat: "jpeg", scale: 0.25 });
      thumbs.push({ src: dataUrl(buffer!), label: `${(frame / FPS).toFixed(1)}s: ${scene.type}` });
    }
  }
  const sheetProps = { images: thumbs, columns: Math.min(6, thumbs.length) };
  const sheet = await selectComposition({ serveUrl, id: "Sheet", inputProps: sheetProps });
  const contactSheet = join(outDir, "contact-sheet.jpg");
  await renderStill({ composition: sheet, serveUrl, inputProps: sheetProps, output: contactSheet, imageFormat: "jpeg", jpegQuality: 85 });

  const result = {
    kind: spec.kind,
    files,
    contactSheet,
    video: { durationS: Math.round(durationS * 10) / 10, sizeMB: Math.round((sizeBytes / MB) * 10) / 10, width: meta.width, height: meta.height, codec: meta.codec, audio: meta.audioCodec },
    ok: problems.length === 0,
    problems,
  };
  writeFileSync(join(outDir, "render.json"), JSON.stringify(result, null, 2));
  return result;
});
