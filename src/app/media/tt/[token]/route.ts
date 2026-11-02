import { env } from "@/lib/env";
import { readAppMediaToken, signedReadUrl } from "@/lib/media/service";

// TikTok photo posts only pull images from URL prefixes the developer has verified, so
// Vieews serves them from its own domain: /media/tt/<signed token>.<ext>. The same prefix
// hosts TikTok's signature file for that verification. Tokens expire after an hour.
export async function GET(_req: Request, ctx: RouteContext<"/media/tt/[token]">) {
  const { token } = await ctx.params;

  const verification = env.tiktokUrlVerification();
  if (verification && token === verification.file) {
    return new Response(verification.content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const media = readAppMediaToken(token);
  if (!media) return new Response("Not found", { status: 404 });

  const upstream = await fetch(await signedReadUrl(media.storagePath, 5 * 60));
  if (!upstream.ok || !upstream.body) return new Response("Not found", { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "private, max-age=300",
      ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length")! } : {}),
    },
  });
}
