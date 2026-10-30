import { ImageResponse } from "next/og";

export const alt = "Vieews: upload once, post to YouTube, Instagram and TikTok";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview for shared Vieews URLs, in the brand palette.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 88, background: "#011936", color: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 120, height: 120, borderRadius: 32, background: "#c0dfa1", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 0 #9fc490" }}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#011936" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l8 13 8-13" />
              <circle cx="12" cy="6" r="1.5" fill="#011936" stroke="none" />
            </svg>
          </div>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>Vieews</div>
        </div>
        <div style={{ marginTop: 56, fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>Upload once, post everywhere.</div>
        <div style={{ marginTop: 20, fontSize: 34, color: "#c0dfa1" }}>YouTube · Instagram · TikTok, now or on a schedule.</div>
      </div>
    ),
    size,
  );
}
