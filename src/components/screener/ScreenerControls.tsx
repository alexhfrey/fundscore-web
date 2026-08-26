"use client";
// ============================================================================
// /screener filter controls — CLIENT.
// ----------------------------------------------------------------------------
// Writes URL searchParams and lets the server re-render; it holds no fund data
// and makes no fetch of its own. Every control's value set is closed and matches
// the reader's whitelist, so nothing a user can type here reaches SQL
// un-normalized (the reader re-validates regardless — this is convenience, not
// the boundary).
//
// The verdict facet is the Value Score axis (above / ≈ / below breakeven, or
// "not scored"), NOT a rating. There is no "best funds" control, no ranking
// preset, and no sort by any gated figure.
//
// NO ASSET-CLASS CONTROL, deliberately: `asset_class` is `EQ` for all 5,819
// served rows, so the filter would be a dead control that implies a universe we
// do not serve.
// ============================================================================
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { useDebounce } from "@/hooks";
import {
  MANAGEMENT_STYLES,
  VEHICLE_TYPES,
  type ScreenerFilters,
  type VerdictKey,
} from "@/lib/serving/screener-select";
import { screenerHref } from "./params";

const VERDICT_OPTIONS: { value: VerdictKey | ""; label: string }[] = [
  { value: "", label: "Any verdict" },
  { value: "above", label: "Above breakeven" },
  { value: "near", label: "≈ Breakeven" },
  { value: "below", label: "Below breakeven" },
  { value: "not_scored", label: "Not scored" },
];

const FEE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any fee" },
  { value: "10", label: "≤ 10 bps" },
  { value: "25", label: "≤ 25 bps" },
  { value: "50", label: "≤ 50 bps" },
  { value: "100", label: "≤ 100 bps" },
];

const SELECT_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1466b8]";

export function ScreenerControls({ filters }: { filters: ScreenerFilters }) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.q);
  const debounced = useDebounce(query, 300);

  // Re-sync the box when the URL's `q` changes from outside this component
  // (back/forward, or the Clear button). Adjusting state DURING RENDER off a
  // previous-prop mirror is React's documented pattern for this; doing it in an
  // effect would cascade a second render on every keystroke.
  const [lastUrlQ, setLastUrlQ] = useState(filters.q);
  if (lastUrlQ !== filters.q) {
    setLastUrlQ(filters.q);
    setQuery(filters.q);
  }

  // The search box is the one free-text control, so it is debounced rather than
  // navigating per keystroke. The guard keeps a server-driven filter change from
  // bouncing the URL back to a stale query.
  useEffect(() => {
    if (debounced === filters.q) return;
    router.replace(screenerHref(filters, { q: debounced }));
  }, [debounced, filters, router]);

  const go = (overrides: Parameters<typeof screenerHref>[1]) =>
    router.replace(screenerHref({ ...filters, q: query }, overrides));

  const anyFilter =
    Boolean(filters.q) ||
    Boolean(filters.vehicle) ||
    Boolean(filters.style) ||
    Boolean(filters.verdict) ||
    filters.maxFeeBps != null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Ticker, fund name, or family…"
        className="min-w-[16rem] flex-1"
      />
      <select
        aria-label="Vehicle type"
        className={SELECT_CLASS}
        value={filters.vehicle ?? ""}
        onChange={(e) => go({ vehicle: e.target.value || null })}
      >
        <option value="">Any vehicle</option>
        {VEHICLE_TYPES.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <select
        aria-label="Management style"
        className={SELECT_CLASS}
        value={filters.style ?? ""}
        onChange={(e) => go({ style: e.target.value || null })}
      >
        <option value="">Any style</option>
        {MANAGEMENT_STYLES.map((s) => (
          <option key={s} value={s}>
            {s === "active" ? "Active" : "Passive"}
          </option>
        ))}
      </select>
      <select
        aria-label="Value verdict"
        className={SELECT_CLASS}
        value={filters.verdict ?? ""}
        onChange={(e) =>
          go({ verdict: (e.target.value as VerdictKey | "") || null })
        }
      >
        {VERDICT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Maximum net expense ratio"
        className={SELECT_CLASS}
        value={filters.maxFeeBps != null ? String(filters.maxFeeBps) : ""}
        onChange={(e) =>
          go({ maxFeeBps: e.target.value ? Number(e.target.value) : null })
        }
      >
        {FEE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {anyFilter && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            router.replace("/screener");
          }}
          className="text-sm font-medium text-[#1466b8] hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
