"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>
        <div style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f11",
          color: "#ffffff",
        }}>
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, color: "#6b6f76", marginTop: 8 }}>
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 24,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #1c1e21",
                background: "transparent",
                color: "#ffffff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
