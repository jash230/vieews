import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
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

export const metadata: Metadata = {
  title: { default: "Vieews", template: "%s · Vieews" },
  description: "Your app's social marketing on autopilot: Vieews makes, schedules and publishes posts to YouTube, Instagram and TikTok while you check in.",
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
        </body>
      </html>
    </ClerkProvider>
  );
}
