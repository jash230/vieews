import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
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
        variables: { colorPrimary: "#e11d48", borderRadius: "0.75rem", fontFamily: "var(--font-jakarta)" },
      }}
    >
      <html lang="en" className={`${jakarta.variable} h-full`}>
        <body className="min-h-dvh bg-background text-foreground">{children}</body>
      </html>
    </ClerkProvider>
  );
}
