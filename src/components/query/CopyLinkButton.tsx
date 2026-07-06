"use client";

import { useState } from "react";

// Copy-to-clipboard for a share URL (query_results.md § 7). Builds the absolute
// URL from the current origin at click time so it works across local/preview/
// prod without a configured base URL. Falls back to selecting nothing if the
// clipboard API is unavailable (older/secure-context edge); never throws.
export function CopyLinkButton({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (non-secure context) — surface the URL via prompt so
      // the user can copy manually rather than silently failing.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-[#1466b8]/40 hover:bg-gray-50"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path d="M13 7h2a3 3 0 013 3v5a3 3 0 01-3 3h-5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1h-2V7z" />
        <path d="M7 13H5a3 3 0 01-3-3V5a3 3 0 013-3h5a3 3 0 013 3v2h-2V5a1 1 0 00-1-1H5a1 1 0 00-1 1v5a1 1 0 001 1h2v2z" />
      </svg>
      {copied ? "Copied!" : label}
    </button>
  );
}
