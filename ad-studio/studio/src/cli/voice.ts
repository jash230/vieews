import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { KokoroTTS } from "kokoro-js";
import { loadConfig } from "../config";
import { main, parseArgs, str } from "./util";

// npm run voice -- --text "..." --out runs/<id>/vo/1.wav [--voice af_heart] [--speed 1.1]
// npm run voice -- --lines runs/<id>/lines.json --dir runs/<id>/vo   (lines: [{ "id": "1", "text": "..." }])
// Speaks with Kokoro-82M (open weights, Apache-2.0) on the CPU. One file per scene keeps captions in sync.

export const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
type KokoroVoice = NonNullable<NonNullable<Parameters<KokoroTTS["generate"]>[1]>["voice"]>;

await main(async () => {
  const args = parseArgs();
  const voice = str(args, "voice", loadConfig().voice);
  const speed = Number(str(args, "speed", "1.08"));
  const lines: { id: string; text: string; out: string }[] =
    typeof args.lines === "string"
      ? (JSON.parse(readFileSync(args.lines, "utf8")) as { id: string; text: string }[]).map((l) => ({ ...l, out: join(str(args, "dir"), `${l.id}.wav`) }))
      : [{ id: "1", text: str(args, "text"), out: str(args, "out") }];

  const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "cpu" });
  const results = [];
  for (const line of lines) {
    const audio = await tts.generate(line.text, { voice: voice as KokoroVoice, speed });
    mkdirSync(dirname(line.out), { recursive: true });
    await audio.save(line.out);
    results.push({ id: line.id, src: resolve(line.out), text: line.text, durationS: Math.round((audio.audio.length / audio.sampling_rate) * 100) / 100 });
  }
  return { voice, lines: results };
});
