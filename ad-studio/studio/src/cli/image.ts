import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../config";
import { list, main, parseArgs, str } from "./util";

// npm run image -- --prompt "..." --out runs/<id>/img/hook.jpg [--size 720x1280] [--ref img/a.jpg ...] [--model ...]
// Generates one image with an open-weights FLUX model on Cloudflare Workers AI's free tier.
// --ref passes earlier images as references (flux-2-klein only), e.g. to keep the same person across slides.

const TILE = 512 * 512;

export function estimateNeurons(model: string, width: number, height: number, refs: number): number {
  if (model.endsWith("flux-1-schnell")) return Math.round(4 * 4.8 + 6 * 9.6);
  const tiles = Math.ceil((width * height) / TILE);
  return Math.round(tiles * 26.05 + refs * 4 * 5.37);
}

async function run(model: string, prompt: string, width: number, height: number, refs: string[]): Promise<Buffer> {
  const account = process.env.CF_ACCOUNT_ID;
  if (!account) throw new Error("Set CF_ACCOUNT_ID (your Cloudflare account id).");
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`;
  // In a cloud environment the token is a network secret: the proxy adds the header.
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  let init: RequestInit;
  if (model.endsWith("flux-1-schnell")) {
    init = { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ prompt, steps: 6 }) };
  } else {
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("width", String(width));
    form.set("height", String(height));
    refs.forEach((ref, i) => form.set(`input_image_${i}`, new Blob([readFileSync(ref)], { type: "image/jpeg" }), `ref${i}.jpg`));
    init = { method: "POST", headers: auth, body: form };
  }

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, init);
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.startsWith("image/")) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    if (res.ok) {
      const json = JSON.parse(body) as { result?: { image?: string }; success?: boolean };
      if (json.result?.image) return Buffer.from(json.result.image, "base64");
      throw new Error(`Workers AI returned no image: ${body.slice(0, 300)}`);
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 3) {
      const hint = /neuron|allocation|quota/i.test(body) ? " (daily free allowance used up: use a format without AI images)" : "";
      throw new Error(`Workers AI ${res.status}${hint}: ${body.slice(0, 400)}`);
    }
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
}

await main(async () => {
  const args = parseArgs();
  const config = loadConfig();
  const model = str(args, "model", config.imageModel);
  const prompt = typeof args["prompt-file"] === "string" ? readFileSync(args["prompt-file"], "utf8").trim() : str(args, "prompt");
  const out = str(args, "out");
  const [width, height] = str(args, "size", "720x1280").split("x").map(Number);
  if (!(width >= 256 && width <= 1920 && height >= 256 && height <= 1920)) throw new Error("--size must be WxH between 256 and 1920");
  const refs = list(args, "ref").slice(0, 4);

  const image = await run(model, prompt.slice(0, 2048), width, height, model.endsWith("flux-1-schnell") ? [] : refs);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, image);
  const square = model.endsWith("flux-1-schnell");
  return { out: resolve(out), model, width: square ? 1024 : width, height: square ? 1024 : height, neurons: estimateNeurons(model, width, height, refs.length) };
});
