import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { captionPages, FPS, sceneDurationS, type AdSpec, type SizeName, type Theme } from "../src/spec";
import { fontFamily } from "./fonts";
import { safeArea } from "./layout";
import { SceneView } from "./Scenes";

export type AdProps = { spec: AdSpec; size: SizeName };

function Captions({ text, durationS, theme, size }: { text: string; durationS: number; theme: Theme; size: SizeName }) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = frame / FPS;
  const page = captionPages(text, durationS).find((p) => t >= p.startS && t < p.endS);
  if (!page) return null;
  const within = (t - page.startS) / (page.endS - page.startS);
  const active = Math.min(page.words.length - 1, Math.floor(within * page.words.length));
  const safe = safeArea(size);
  return (
    <div style={{ position: "absolute", left: safe.left, right: safe.right, top: height - safe.bottom - 170, textAlign: "center" }}>
      <p style={{ margin: 0, fontFamily: fontFamily(theme), fontWeight: 900, fontSize: 70, lineHeight: 1.1, color: "#fff", textShadow: "0 0 3px #000, 0 4px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000" }}>
        {page.words.map((w, i) => (
          <span key={i} style={{ color: i === active ? theme.accent : "#fff" }}>
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

/** The video version: scenes back to back with hard cuts (native to TikTok and Reels). */
export function Ad({ spec, size }: AdProps) {
  const lengths = spec.scenes.map((scene) => Math.round(sceneDurationS(scene) * FPS));
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {spec.scenes.map((scene, i) => {
        const frames = lengths[i];
        const start = starts[i];
        return (
          <Sequence key={i} from={start} durationInFrames={frames} name={`${i + 1}. ${scene.type}`}>
            <SceneView scene={scene} theme={spec.theme} size={size} frames={frames} still={false} />
            {scene.voice && (
              <>
                <Audio src={staticFile(scene.voice.src)} />
                <Captions text={scene.voice.text} durationS={scene.voice.durationS} theme={spec.theme} size={size} />
              </>
            )}
          </Sequence>
        );
      })}
      {spec.music && <Audio src={staticFile(spec.music.src)} volume={spec.music.volume} loop />}
    </AbsoluteFill>
  );
}

/** One scene as a finished slide (TikTok photo post or Instagram carousel image). */
export function Slide({ spec, size, index }: AdProps & { index: number }) {
  const scene = spec.scenes[index];
  return <SceneView scene={scene} theme={spec.theme} size={size} frames={Math.round(sceneDurationS(scene) * FPS)} still />;
}

export type SheetProps = { images: { src: string; label: string }[]; columns: number };

/** A contact sheet of thumbnails so a reviewer can check the whole ad in one image. */
export function Sheet({ images, columns }: SheetProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1b1b1b", padding: 24, display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 20, alignContent: "start" }}>
      {images.map((img, i) => (
        <figure key={i} style={{ margin: 0 }}>
          <Img src={img.src} style={{ width: "100%", display: "block", borderRadius: 8 }} />
          <figcaption style={{ color: "#ddd", fontFamily: "Inter, sans-serif", fontSize: 22, marginTop: 6 }}>{img.label}</figcaption>
        </figure>
      ))}
    </AbsoluteFill>
  );
}
