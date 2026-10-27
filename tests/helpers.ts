import { vi } from "vitest";
import type { PublishContext } from "@/lib/platforms/types";
import type { MediaAssetRow, SocialAccountRow, TargetOptions } from "@/lib/types";

export type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Routes fetch calls through handlers in order of registration; records every call. */
export function mockFetch(routes: [RegExp | ((url: string, init: RequestInit) => boolean), Handler][]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    for (const [match, handler] of routes) {
      if (typeof match === "function" ? match(url, init) : match.test(url)) return handler(url, init);
    }
    throw new Error(`Unexpected fetch ${init.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export function fakeCtx(overrides: { media?: Partial<MediaAssetRow>; account?: Partial<SocialAccountRow>; options: TargetOptions; caption?: string }) {
  const steps: string[] = [];
  const statuses: string[] = [];
  const ctx: PublishContext = {
    account: { id: "acc", platform: overrides.options.platform, platform_account_id: "17841", ...overrides.account } as SocialAccountRow,
    media: { id: "m", kind: "video", mime: "video/mp4", size_bytes: 1000, storage_path: "u/m.mp4", duration_s: 10, ...overrides.media } as MediaAssetRow,
    caption: overrides.caption ?? "caption",
    options: overrides.options,
    run: async (id, fn) => {
      steps.push(id);
      return fn();
    },
    sleep: async (id) => void steps.push(id),
    accessToken: async () => "token",
    mediaUrl: async () => "https://storage.example/media.mp4",
    setStatus: async (s) => void statuses.push(s),
  };
  return { ctx, steps, statuses };
}

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

/** Serves byte ranges of a fake file of `size` bytes. */
export function rangeHandler(size: number): Handler {
  return (_url, init) => {
    const range = new Headers(init.headers).get("range")!;
    const [, s, e] = range.match(/bytes=(\d+)-(\d+)/)!;
    const len = Math.min(Number(e), size - 1) - Number(s) + 1;
    return new Response(new Uint8Array(len), { status: 206 });
  };
}
