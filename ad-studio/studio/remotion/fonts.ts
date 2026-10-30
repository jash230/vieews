import inter500 from "@fontsource/inter/files/inter-latin-500-normal.woff2";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2";
import inter800 from "@fontsource/inter/files/inter-latin-800-normal.woff2";
import tt400 from "@fontsource/tiktok-sans/files/tiktok-sans-latin-400-normal.woff2";
import tt700 from "@fontsource/tiktok-sans/files/tiktok-sans-latin-700-normal.woff2";
import tt800 from "@fontsource/tiktok-sans/files/tiktok-sans-latin-800-normal.woff2";
import tt900 from "@fontsource/tiktok-sans/files/tiktok-sans-latin-900-normal.woff2";
import { loadFont } from "@remotion/fonts";
import type { Theme } from "../src/spec";

// Fonts ship in node_modules (OFL), so rendering never needs the network.
const faces: [string, string, string][] = [
  ["TikTok Sans", tt400, "400"],
  ["TikTok Sans", tt700, "700"],
  ["TikTok Sans", tt800, "800"],
  ["TikTok Sans", tt900, "900"],
  ["Inter", inter500, "500"],
  ["Inter", inter700, "700"],
  ["Inter", inter800, "800"],
];
for (const [family, url, weight] of faces) void loadFont({ family, url, weight });

export const fontFamily = (theme: Pick<Theme, "font">) =>
  theme.font === "inter" ? "Inter, sans-serif" : "'TikTok Sans', Inter, sans-serif";

/** Chat bubbles look like iMessage, which uses the system UI font. */
export const UI_FONT = "Inter, -apple-system, sans-serif";
