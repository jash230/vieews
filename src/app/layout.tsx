import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { env } from "@/lib/env";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION = "Upload a video once and publish it to YouTube Shorts, Instagram Reels and TikTok, now or on a schedule.";

// Link previews (opengraph-image.png next to this file) need absolute URLs, so they resolve against the public app URL.
export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl()),
  applicationName: "Vieews",
  title: { default: "Vieews", template: "%s · Vieews" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Vieews", title: "Vieews: upload once, post everywhere", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Vieews: upload once, post everywhere", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: "#011936", borderRadius: "0.75rem", fontFamily: "var(--font-nunito)" },
      }}
    >
      <html lang="en" className={`${nunito.variable} ${fredoka.variable} h-full`}>
        <body className="min-h-dvh bg-background text-foreground">
          {children}
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
