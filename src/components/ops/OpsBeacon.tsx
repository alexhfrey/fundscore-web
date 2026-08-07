"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The pageview counter. Mounted once in the ROOT layout, so it covers the
 * marketing landing page and every product route from a single place.
 *
 * Why a client beacon rather than a write inside a server layout: a DB write in
 * a layout would run at build time for prerendered routes (/q/[slug]) and would
 * force `/` out of its `force-static` rendering. Mounting a client component
 * does neither — the page is still statically rendered and the beacon fires
 * after hydration.
 *
 * Failure is silent by design: analytics must never surface an error to a user
 * or block a navigation.
 */
export function OpsBeacon() {
  const pathname = usePathname();
  // Guards React 18/19 double-invocation in dev and repeat effects on
  // re-render, so one navigation is one row.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    lastSent.current = pathname;

    void fetch("/api/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "pageview",
        path: pathname,
        referrer: document.referrer || null,
      }),
      // Survives the page being torn down by the navigation that triggered it.
      keepalive: true,
    }).catch(() => {
      /* analytics is never worth a user-visible failure */
    });
  }, [pathname]);

  return null;
}

/**
 * Shared client-side error reporter for the error boundaries. Same silence
 * contract: the boundary is already showing the user a failure, so a failed
 * report must not add a second one.
 */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    void fetch("/api/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "error",
        path: window.location.pathname,
        digest: error.digest ?? null,
        // Trimmed HERE, before the post, not only on the server. A deep stack
        // can run to tens of kilobytes, and a report that the intake rejects
        // for size is a report we never see — precisely for the gnarliest
        // errors. The head of a stack is the part that identifies the fault.
        message: clipForPost(error.message, 4_000),
        stack: clipForPost(error.stack, 8_000),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* no-op */
  }
}

/** Keeps the posted payload inside the intake's body cap. */
function clipForPost(v: string | undefined, max: number): string | null {
  if (!v) return null;
  return v.length > max ? `${v.slice(0, max)}\n…[truncated]` : v;
}
