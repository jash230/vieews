/** `--key value` and `--flag` arguments; repeated keys become arrays. */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string | string[] | true> {
  const out: Record<string, string | string[] | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value: string | true = next !== undefined && !next.startsWith("--") ? (i++, next) : true;
    const prev = out[key];
    out[key] = prev === undefined ? value : [...(Array.isArray(prev) ? prev : [String(prev)]), String(value)];
  }
  return out;
}

export function str(args: Record<string, unknown>, key: string, fallback?: string): string {
  const v = args[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return String(v[v.length - 1]);
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${key}`);
}

export function list(args: Record<string, unknown>, key: string): string[] {
  const v = args[key];
  return v === undefined || v === true ? [] : Array.isArray(v) ? v.map(String) : [String(v)];
}

/** Prints JSON for the agent and exits non-zero on failure with a readable message. */
export async function main(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    if (result !== undefined) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
