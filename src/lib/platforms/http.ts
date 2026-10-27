import { PlatformError } from "./types";

/** Reads bytes [start, end] (inclusive) of a file from a URL that supports Range requests. */
export async function fetchRange(url: string, start: number, end: number): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
  if (res.status !== 206 && res.status !== 200) {
    throw new PlatformError(`Reading media failed (${res.status})`, { retryable: res.status >= 500 });
  }
  const buf = await res.arrayBuffer();
  // A server that ignores Range returns the whole file with 200.
  return res.status === 200 ? buf.slice(start, end + 1) : buf;
}

export function form(data: Record<string, string>): URLSearchParams {
  return new URLSearchParams(data);
}

export function scopesFrom(value: unknown, sep = " "): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(sep).map((s) => s.trim()).filter(Boolean);
  return [];
}
