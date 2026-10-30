import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, oauthCookie, oauthCookiePath } from "@/lib/accounts/oauth";
import { saveConnectedAccount } from "@/lib/accounts/service";
import { env } from "@/lib/env";
import { adapterFor } from "@/lib/platforms";
import { getCurrentProject } from "@/lib/projects/current";
import { linkAccountToProject } from "@/lib/projects/service";

function back(params: Record<string, string>) {
  return NextResponse.redirect(`${env.appUrl()}/accounts?${new URLSearchParams(params)}`);
}

export async function GET(req: NextRequest, { params }: RouteContext<"/api/connect/[platform]/callback">) {
  const { userId } = await auth.protect();
  const { platform } = await params;
  const adapter = adapterFor(platform);
  if (!adapter) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  const url = req.nextUrl;
  const cookie = req.cookies.get(oauthCookie(platform))?.value;
  const saved = cookie ? (JSON.parse(cookie) as { state: string; codeVerifier: string; userId: string }) : null;

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const code = url.searchParams.get("code");
  let res: NextResponse;
  if (providerError) {
    res = back({ error: `${adapter.label}: ${providerError}` });
  } else if (!saved || saved.state !== url.searchParams.get("state") || saved.userId !== userId || !code) {
    res = back({ error: `${adapter.label} sign-in expired or didn't match. Try connecting again.` });
  } else {
    try {
      const tokens = await adapter.exchangeCode(code, { redirectUri: callbackUrl(platform), codeVerifier: saved.codeVerifier });
      const profile = await adapter.getProfile(tokens.accessToken, tokens);
      const accountId = await saveConnectedAccount(userId, adapter.platform, tokens, profile);
      // A newly connected account starts out posting for the project the user is working in.
      const project = await getCurrentProject(userId);
      if (project) await linkAccountToProject(userId, project.id, accountId);
      res = back({ connected: adapter.platform });
    } catch (err) {
      res = back({ error: err instanceof Error ? err.message : `Couldn't connect ${adapter.label}` });
    }
  }
  res.cookies.delete({ name: oauthCookie(platform), path: oauthCookiePath(platform) });
  return res;
}
