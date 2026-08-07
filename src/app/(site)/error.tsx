"use client";

import Link from "next/link";
import { useEffect } from "react";

import { reportClientError } from "@/components/ops/OpsBeacon";

/**
 * Error boundary for every product surface (fund pages, screener, X-Ray,
 * lenses). Renders inside the site chrome, so the header, footer and the
 * feedback widget all stay reachable — a beta user who hits this can tell us
 * what they were doing without leaving the page.
 *
 * It never shows a stack trace: the digest is the handle that ties what the
 * user sees to the row in ops_error_events.
 */
export default function SiteError({
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
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Error
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">
        This page didn&apos;t load.
      </h1>
      <p className="mt-3 text-gray-600">
        Something broke on our side — it isn&apos;t anything you did. The error
        has been recorded automatically, and we&apos;re looking at it.
      </p>
      {error.digest ? (
        <p className="mt-3 text-sm text-gray-500">
          Reference:{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-data text-xs">
            {error.digest}
          </code>{" "}
          — quoting this in feedback helps us find it instantly.
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[#1466b8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#115899]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to home
        </Link>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        If it keeps happening, use the <strong>Feedback</strong> button in the
        corner — that reaches us directly.
      </p>
    </div>
  );
}
