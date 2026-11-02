"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

// Sonner's own styles, themed through its CSS variables so toasts match the cards and Notice tones.
const THEME = {
  "--normal-bg": "var(--background)",
  "--normal-text": "var(--foreground)",
  "--normal-border": "var(--border)",
  "--success-bg": "var(--success-soft)",
  "--success-text": "var(--success)",
  "--success-border": "color-mix(in srgb, var(--success) 25%, transparent)",
  "--error-bg": "var(--destructive-soft)",
  "--error-text": "var(--destructive)",
  "--error-border": "color-mix(in srgb, var(--destructive) 25%, transparent)",
  "--warning-bg": "var(--warning-soft)",
  "--warning-text": "var(--warning)",
  "--warning-border": "color-mix(in srgb, var(--warning) 25%, transparent)",
  "--info-bg": "var(--accent-soft)",
  "--info-text": "var(--accent)",
  "--info-border": "color-mix(in srgb, var(--accent) 20%, transparent)",
  "--border-radius": "1rem",
} as CSSProperties;

/** One per app. Top-center, just under the 56px app header, so it never covers bottom bars or the copilot. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={{ top: 68 }}
      mobileOffset={{ top: 64 }}
      richColors
      closeButton
      style={THEME}
      toastOptions={{
        classNames: {
          toast: "font-sans !shadow-lg",
          title: "!font-semibold",
        },
      }}
    />
  );
}
