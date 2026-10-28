import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
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
  description: "Upload once, publish to YouTube, Instagram and TikTok.",
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
        <body className="min-h-dvh bg-background text-foreground">{children}</body>
      </html>
    </ClerkProvider>
  );
}
