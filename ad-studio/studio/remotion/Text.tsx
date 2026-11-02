import type { CSSProperties } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneText, SizeName, Theme } from "../src/spec";
import { fontFamily } from "./fonts";
import { fontSizeFor, safeArea } from "./layout";

const OUTLINE = [
  [3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, -3], [3, -3], [-3, 3], [5, 0], [-5, 0], [0, 5], [0, -5],
]
  .map(([x, y]) => `${x}px ${y}px 0 #000`)
  .join(", ");

const TOP: Record<SceneText["position"], number> = { top: 0, upper: 0.12, center: 0.36, lower: 0.56 };

/** On-screen text in the styles people use natively on TikTok and Reels. */
export function TextOverlay({ text, theme, size, still }: { text: SceneText; theme: Theme; size: SizeName; still: boolean }) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const safe = safeArea(size);
  const pop = still ? 1 : spring({ frame, fps, config: { damping: 14, stiffness: 180 }, durationInFrames: 10 });
  const fontSize = fontSizeFor(text.text, text.style, size);
  const usable = height - safe.top - safe.bottom;
  const small = text.style === "small";

  const box: CSSProperties = {
    position: "absolute",
    left: safe.left + (small ? 10 : 0),
    right: safe.right + (small ? width * 0.22 : 0),
    top: safe.top + usable * TOP[text.position],
    display: "flex",
    justifyContent: text.align === "left" || small ? "flex-start" : "center",
    textAlign: text.align === "left" || small ? "left" : "center",
    transform: `scale(${0.88 + 0.12 * pop})`,
    transformOrigin: "50% 0%",
    opacity: pop,
  };

  const base: CSSProperties = {
    fontFamily: fontFamily(theme),
    fontSize,
    lineHeight: 1.18,
    whiteSpace: "pre-line",
    overflowWrap: "break-word",
    margin: 0,
  };

  if (text.style === "box") {
    return (
      <div style={box}>
        <p style={{ ...base, lineHeight: 1.62, fontWeight: 700 }}>
          <span style={{ background: "#fff", color: "#000", padding: "6px 18px", borderRadius: 14, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
            {text.text}
          </span>
        </p>
      </div>
    );
  }

  const styles: Record<Exclude<SceneText["style"], "box">, CSSProperties> = {
    outline: { color: "#fff", fontWeight: 800, textShadow: OUTLINE },
    headline: { color: "#fff", fontWeight: 900, textShadow: OUTLINE, letterSpacing: -1 },
    clean: { color: "#fff", fontWeight: 700, textShadow: "0 4px 22px rgba(0,0,0,.6), 0 1px 3px rgba(0,0,0,.5)" },
    small: { color: "#fff", fontWeight: 500, textShadow: "0 2px 10px rgba(0,0,0,.55)" },
  };
  return (
    <div style={box}>
      <p style={{ ...base, ...styles[text.style] }}>{text.text}</p>
    </div>
  );
}
