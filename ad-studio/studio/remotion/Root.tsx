import { Composition, Still } from "remotion";
import { FPS, SIZES, totalFrames, type AdSpec } from "../src/spec";
import { Ad, Sheet, Slide, type AdProps, type SheetProps } from "./Ad";
import "./fonts";

const sample: AdSpec = {
  id: "sample",
  kind: "video",
  theme: { primary: "#1d3557", accent: "#25F4EE", font: "tiktok-sans" },
  scenes: [
    { type: "text", durationS: 2.5, background: "#1d3557", text: { text: "Stop doing this every morning", position: "center", style: "headline", align: "center" } },
    { type: "end", durationS: 2.5, appName: "Your app", line: "Free on the App Store" },
  ],
};

const SHEET_THUMB = { width: 270, height: 480 };

export function Root() {
  return (
    <>
      <Composition
        id="Ad"
        component={Ad}
        fps={FPS}
        width={SIZES.vertical.width}
        height={SIZES.vertical.height}
        durationInFrames={totalFrames(sample)}
        defaultProps={{ spec: sample, size: "vertical" } satisfies AdProps}
        calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props.spec), ...SIZES[props.size] })}
      />
      <Still
        id="Slide"
        component={Slide}
        width={SIZES.vertical.width}
        height={SIZES.vertical.height}
        defaultProps={{ spec: sample, size: "vertical", index: 0 } satisfies AdProps & { index: number }}
        calculateMetadata={({ props }) => SIZES[props.size]}
      />
      <Still
        id="Sheet"
        component={Sheet}
        width={1200}
        height={800}
        defaultProps={{ images: [], columns: 4 } satisfies SheetProps}
        calculateMetadata={({ props }) => {
          const rows = Math.max(1, Math.ceil(props.images.length / props.columns));
          return { width: props.columns * (SHEET_THUMB.width + 20) + 28, height: rows * (SHEET_THUMB.height + 56) + 28 };
        }}
      />
    </>
  );
}
