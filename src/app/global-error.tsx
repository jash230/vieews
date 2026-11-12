"use client";

// Replaces the root layout when it fails, so it brings its own document and plain styles.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fff", color: "#011936" }}>
        <title>Something went wrong · Vieews</title>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 24px", color: "#55606e" }}>Vieews hit an unexpected error. Your posts and accounts are safe.</p>
          <button
            onClick={() => retry()}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 16, border: 0, background: "#011936", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
