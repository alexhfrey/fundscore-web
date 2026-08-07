"use client";

import { useEffect } from "react";

import { reportClientError } from "@/components/ops/OpsBeacon";

/**
 * Root error boundary — the only thing that catches a crash in the root layout
 * itself, which every nested boundary sits inside and therefore cannot see.
 * It replaces the whole document, so it must render its own <html>/<body>.
 *
 * Deliberately plain: no fonts, no Tailwind theme tokens, no imports beyond the
 * reporter. This screen renders when the app is already broken, so it must not
 * depend on anything that could be broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f9fafb",
          color: "#111827",
        }}
      >
        <main style={{ maxWidth: "32rem", padding: "2rem", textAlign: "left" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Something went wrong on our side.
          </h1>
          <p style={{ color: "#4b5563", lineHeight: 1.6 }}>
            This is a bug in FundScore, not something you did. We&apos;ve
            recorded it automatically.
          </p>
          {error.digest ? (
            <p style={{ color: "#6b7280", fontSize: "0.8125rem" }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#1466b8",
              color: "#fff",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
