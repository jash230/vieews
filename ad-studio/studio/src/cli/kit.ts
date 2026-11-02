import { listKits, loadKit } from "../kit";
import { main, parseArgs } from "./util";

// npm run kit -- <slug>     validates a kit and prints what the ad can use
// npm run kit -- --list     lists kits
await main(async () => {
  const args = parseArgs();
  if (args.list) return { kits: listKits() };
  const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!slug) throw new Error("Usage: npm run kit -- <slug>");
  const { kit, notes, mediaDir } = loadKit(slug);
  return { ok: true, mediaDir, ...kit, notes };
});
