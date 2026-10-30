import type { SizeName } from "../src/spec";

/**
 * Where text may go. TikTok/Reels cover the top (tabs), the bottom (caption, username) and the
 * right edge (like/comment/share buttons); Instagram carousel slides have no overlay UI.
 */
export function safeArea(size: SizeName) {
  return size === "vertical" ? { top: 190, bottom: 440, left: 70, right: 160 } : { top: 80, bottom: 90, left: 80, right: 80 };
}

/** Font size from text length, so short hooks are big and long ones still fit. */
export function fontSizeFor(text: string, style: string, size: SizeName): number {
  const n = [...text].length;
  const scale = size === "portrait" ? 0.92 : 1;
  if (style === "headline") return Math.round((n <= 14 ? 150 : n <= 28 ? 118 : 96) * scale);
  if (style === "small") return Math.round(46 * scale);
  const base = n <= 24 ? 86 : n <= 48 ? 74 : n <= 90 ? 64 : n <= 150 ? 56 : 48;
  return Math.round(base * scale);
}
