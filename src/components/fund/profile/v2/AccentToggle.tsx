"use client";
// ============================================================================
// AccentToggle — Gold/Blue segmented control for the Crescent preview banner.
// Client island: flips the Crescent accent by setting (gold, default) or
// removing (blue) `data-accent="blue"` on <html>, per the swappable tokens
// already wired in globals.css (`:root[data-accent="blue"] { --crescent-accent: ... }`,
// consumed by CrescentMark/VerdictBlock/FeeReceipt/HurdlePanel/AnatomySection
// via the `crescent-accent*` Tailwind aliases). Preview-tool only.
//
// Reads the persisted choice via useSyncExternalStore, NOT a mount effect +
// setState: this is the SSR-safe way to sync React state with a browser-only
// external store (localStorage isn't available server-side) — React renders
// `getServerSnapshot` ("gold") on the server AND on the initial client
// hydration pass, then re-renders with the real stored value right after
// mount. That is the one-frame pre-hydration flash the design accepts; no
// inline bootstrap script is used to avoid it.
// ============================================================================
import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "crescent-accent-preview";
type Accent = "gold" | "blue";

// The native `storage` event fires only in OTHER tabs, never the tab that
// wrote the value — this same-tab listener set is what makes a same-tab
// click take effect immediately.
const listeners = new Set<() => void>();
function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
function notify() {
  for (const l of listeners) l();
}

function readAccent(): Accent {
  return window.localStorage.getItem(STORAGE_KEY) === "blue" ? "blue" : "gold";
}
function readServerAccent(): Accent {
  return "gold"; // no localStorage on the server — gold is the documented default.
}

function applyAccent(accent: Accent) {
  if (accent === "blue") {
    document.documentElement.setAttribute("data-accent", "blue");
  } else {
    document.documentElement.removeAttribute("data-accent");
  }
}

export function AccentToggle() {
  const accent = useSyncExternalStore(subscribe, readAccent, readServerAccent);

  // Reflect the synced value onto <html> — on mount and on every later change.
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const choose = useCallback((next: Accent) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    notify();
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Crescent accent color"
      className="inline-flex items-center overflow-hidden rounded-full border border-amber-300 bg-white text-[11px] font-semibold uppercase tracking-wide"
    >
      <button
        type="button"
        role="radio"
        aria-checked={accent === "gold"}
        onClick={() => choose("gold")}
        className={`px-2.5 py-1 transition-colors ${
          accent === "gold" ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-50"
        }`}
      >
        Gold
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={accent === "blue"}
        onClick={() => choose("blue")}
        className={`px-2.5 py-1 transition-colors ${
          accent === "blue" ? "bg-[#1466b8] text-white" : "text-amber-700 hover:bg-amber-50"
        }`}
      >
        Blue
      </button>
    </div>
  );
}
