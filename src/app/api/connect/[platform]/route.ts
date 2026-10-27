import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/crypto";
import { callbackUrl, oauthCookie, oauthCookiePath } from "@/lib/accounts/oauth";
import { env } from "@/lib/env";
import { adapterFor } from "@/lib/platforms";

export async function GET(_req: NextRequest, { params }: RouteContext<"/api/connect/[platform]">) {
  const { userId } = await auth.protect();
  const { platform } = await params;
  const adapter = adapterFor(platform);
  if (!adapter) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  let authorizeUrl: string;
  try {
    authorizeUrl = adapter.authorizeUrl({ redirectUri: callbackUrl(platform), state, codeVerifier });
  } catch (err) {
    const error = `${adapter.label} isn't set up: ${err instanceof Error ? err.message : "missing configuration"}`;
    return NextResponse.redirect(`${env.appUrl()}/accounts?${new URLSearchParams({ error })}`);
  }
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(oauthCookie(platform), JSON.stringify({ state, codeVerifier, userId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: oauthCookiePath(platform),
    maxAge: 10 * 60,
  });
  return res;
}
