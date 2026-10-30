import type { CSSProperties } from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { isMediaBackground, type Scene, type SizeName, type Theme } from "../src/spec";
import { UI_FONT, fontFamily } from "./fonts";
import { safeArea } from "./layout";
import { TextOverlay } from "./Text";

export interface SceneProps<S extends Scene = Scene> {
  scene: S;
  theme: Theme;
  size: SizeName;
  /** Length of this scene in frames. */
  frames: number;
  /** Render the settled final state (slides) instead of animating. */
  still: boolean;
}

const src = (path: string) => (path.startsWith("data:") ? path : staticFile(path));
const cover: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

function useProgress(frames: number, still: boolean) {
  const frame = useCurrentFrame();
  return still ? 1 : Math.min(1, frame / Math.max(1, frames - 1));
}

function PhotoScene({ scene, theme, size, frames, still }: SceneProps<Extract<Scene, { type: "photo" }>>) {
  const p = useProgress(frames, still);
  const frame = useCurrentFrame();
  const t = still ? 0.5 : p;
  const transforms: Record<typeof scene.motion, string> = {
    none: "none",
    "zoom-in": `scale(${1 + 0.12 * t})`,
    "zoom-out": `scale(${1.12 - 0.12 * t})`,
    "pan-up": `scale(1.12) translateY(${interpolate(t, [0, 1], [3, -3])}%)`,
    "pan-down": `scale(1.12) translateY(${interpolate(t, [0, 1], [-3, 3])}%)`,
    // A phone held in a hand: small drifting offsets and a hint of rotation.
    handheld: still
      ? "scale(1.06)"
      : `scale(1.06) translate(${Math.sin(frame / 11) * 6}px, ${Math.cos(frame / 13) * 8}px) rotate(${Math.sin(frame / 17) * 0.4}deg)`,
  };
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img src={src(scene.src)} style={{ ...cover, transform: transforms[scene.motion] }} />
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${scene.dim})` }} />
      {scene.text && <TextOverlay text={scene.text} theme={theme} size={size} still={still} />}
    </AbsoluteFill>
  );
}

function ScreenScene({ scene, theme, size, frames, still }: SceneProps<Extract<Scene, { type: "screen" }>>) {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const p = useProgress(frames, still);
  const enter = still ? 1 : spring({ frame, fps, config: { damping: 16 }, durationInFrames: 12 });
  const zoom = scene.zoom ? interpolate(p, [0.15, 0.55], [1, scene.zoom.scale], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const tapT = interpolate(p, [0.3, 0.55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const inner: CSSProperties = {
    ...cover,
    objectPosition: "top",
    transform: `scale(${zoom})`,
    transformOrigin: scene.zoom ? `${scene.zoom.x * 100}% ${scene.zoom.y * 100}%` : "50% 50%",
  };
  const tap = scene.tap && !still && tapT > 0 && tapT < 1 && (
    <div
      style={{
        position: "absolute",
        left: `${scene.tap.x * 100}%`,
        top: `${scene.tap.y * 100}%`,
        width: 120,
        height: 120,
        marginLeft: -60,
        marginTop: -60,
        borderRadius: "50%",
        background: "rgba(255,255,255,.45)",
        border: "4px solid rgba(255,255,255,.9)",
        transform: `scale(${0.4 + tapT})`,
        opacity: 1 - tapT,
      }}
    />
  );

  if (scene.frame === "full") {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
        <Img src={src(scene.src)} style={inner} />
        {tap}
        {scene.text && <TextOverlay text={scene.text} theme={theme} size={size} still={still} />}
      </AbsoluteFill>
    );
  }

  const safe = safeArea(size);
  // Leave room above the phone for top text; the phone may dip a little into the bottom UI zone.
  const textAbove = scene.text && (scene.text.position === "top" || scene.text.position === "upper");
  const areaTop = safe.top + (textAbove ? (size === "vertical" ? 290 : 230) : 30);
  const areaBottom = height - (size === "vertical" ? safe.bottom - 80 : safe.bottom);
  const phoneH = Math.min((width * (size === "vertical" ? 0.62 : 0.5)) * 2.05, areaBottom - areaTop);
  const phoneW = phoneH / 2.05;
  const top = areaBottom - phoneH;
  const background = scene.background ?? `linear-gradient(160deg, ${theme.primary} 0%, #000 100%)`;
  return (
    <AbsoluteFill style={{ background: isMediaBackground(background) ? "#000" : background, overflow: "hidden" }}>
      {isMediaBackground(background) && <Img src={src(background)} style={{ ...cover, filter: "blur(40px) brightness(.55)", transform: "scale(1.2)" }} />}
      <div
        style={{
          position: "absolute",
          left: (width - phoneW) / 2,
          top: top + (1 - enter) * 120,
          width: phoneW,
          height: phoneH,
          borderRadius: phoneW * 0.13,
          border: `${Math.round(phoneW * 0.025)}px solid #0b0b0b`,
          boxShadow: "0 40px 90px rgba(0,0,0,.55)",
          overflow: "hidden",
          background: "#000",
          opacity: enter,
        }}
      >
        <Img src={src(scene.src)} style={inner} />
        {tap}
      </div>
      {scene.text && <TextOverlay text={scene.text} theme={theme} size={size} still={still} />}
    </AbsoluteFill>
  );
}

function ChatScene({ scene, theme, size, frames, still }: SceneProps<Extract<Scene, { type: "chat" }>>) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const safe = safeArea(size);
  const n = scene.messages.length;
  const every = (frames * 0.8) / n;
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff", fontFamily: UI_FONT }}>
      <div style={{ position: "absolute", top: safe.top - 60, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ width: 132, height: 132, margin: "0 auto", borderRadius: "50%", background: "linear-gradient(#a8adb7,#858a94)", color: "#fff", fontSize: 60, fontWeight: 600, display: "grid", placeItems: "center" }}>
          {[...scene.contact][0]?.toUpperCase()}
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 40, color: "#111" }}>{scene.contact} ›</p>
      </div>
      <div style={{ position: "absolute", top: safe.top + 190, left: 44, right: 44, display: "flex", flexDirection: "column", gap: 22 }}>
        {scene.messages.map((m, i) => {
          const appear = still ? 1 : spring({ frame: frame - i * every, fps, config: { damping: 15 }, durationInFrames: 8 });
          if (appear <= 0.01) return null;
          const me = m.from === "me";
          return (
            <div key={i} style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", opacity: appear, transform: `translateY(${(1 - appear) * 30}px)` }}>
              <p
                style={{
                  margin: 0,
                  maxWidth: width * 0.74,
                  padding: "26px 38px",
                  borderRadius: 52,
                  fontSize: 54,
                  lineHeight: 1.25,
                  background: me ? "#0A84FF" : "#E9E9EB",
                  color: me ? "#fff" : "#000",
                }}
              >
                {m.text}
              </p>
            </div>
          );
        })}
      </div>
      {scene.text && <TextOverlay text={{ ...scene.text, position: "lower" }} theme={theme} size={size} still={still} />}
    </AbsoluteFill>
  );
}

function TextScene({ scene, theme, size, still }: SceneProps<Extract<Scene, { type: "text" }>>) {
  const media = isMediaBackground(scene.background);
  return (
    <AbsoluteFill style={{ background: media ? "#000" : scene.background, overflow: "hidden" }}>
      {media && <Img src={src(scene.background)} style={{ ...cover, filter: "blur(28px) brightness(.5)", transform: "scale(1.15)" }} />}
      <TextOverlay text={scene.text} theme={theme} size={size} still={still} />
    </AbsoluteFill>
  );
}

function SplitScene({ scene, theme, size, frames, still }: SceneProps<Extract<Scene, { type: "split" }>>) {
  const p = useProgress(frames, still);
  const reveal = still ? 1 : interpolate(p, [0.25, 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pill: CSSProperties = { position: "absolute", left: 40, bottom: 28, padding: "8px 22px", borderRadius: 999, background: "rgba(0,0,0,.6)", color: "#fff", fontFamily: fontFamily(theme), fontWeight: 700, fontSize: 36 };
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ position: "absolute", inset: 0, bottom: "50%", overflow: "hidden" }}>
        <Img src={src(scene.before)} style={cover} />
        <span style={pill}>{scene.labels[0]}</span>
      </div>
      <div style={{ position: "absolute", inset: 0, top: "50%", overflow: "hidden", clipPath: `inset(0 ${100 - reveal * 100}% 0 0)` }}>
        <Img src={src(scene.after)} style={cover} />
        <span style={pill}>{scene.labels[1]}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 6, marginTop: -3, background: "#fff" }} />
      {scene.text && <TextOverlay text={scene.text} theme={theme} size={size} still={still} />}
    </AbsoluteFill>
  );
}

function EndScene({ scene, theme, size, still }: SceneProps<Extract<Scene, { type: "end" }>>) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = still ? 1 : spring({ frame, fps, config: { damping: 12 }, durationInFrames: 14 });
  const family = fontFamily(theme);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${theme.primary}, #000)`, alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 90px" }}>
      <div style={{ transform: `scale(${0.8 + 0.2 * pop})`, opacity: pop, marginTop: size === "vertical" ? -160 : 0 }}>
        {scene.logo && <Img src={src(scene.logo)} style={{ width: 230, height: 230, borderRadius: 52, boxShadow: "0 24px 60px rgba(0,0,0,.45)" }} />}
        <p style={{ margin: "36px 0 0", fontFamily: family, fontWeight: 900, fontSize: 92, color: "#fff", lineHeight: 1.05 }}>{scene.appName}</p>
        <p style={{ margin: "22px 0 0", fontFamily: family, fontWeight: 700, fontSize: 50, color: theme.accent, lineHeight: 1.2 }}>{scene.line}</p>
        {scene.sub && <p style={{ margin: "18px 0 0", fontFamily: family, fontWeight: 400, fontSize: 38, color: "rgba(255,255,255,.8)" }}>{scene.sub}</p>}
      </div>
    </AbsoluteFill>
  );
}

export function SceneView(props: SceneProps) {
  const { scene } = props;
  switch (scene.type) {
    case "photo":
      return <PhotoScene {...props} scene={scene} />;
    case "screen":
      return <ScreenScene {...props} scene={scene} />;
    case "chat":
      return <ChatScene {...props} scene={scene} />;
    case "text":
      return <TextScene {...props} scene={scene} />;
    case "split":
      return <SplitScene {...props} scene={scene} />;
    case "end":
      return <EndScene {...props} scene={scene} />;
  }
}
