// ============================================================================
// /screener results table — SERVER component.
// ----------------------------------------------------------------------------
// Renders only columns that exist on the served fact row. Every null is an
// em-dash or an honest state label; nothing here derives, defaults or rounds a
// value into existence.
//
// THE VERDICT IS READ, NEVER DERIVED. The chip below keys on the served
// `value_coverage_state` + `value_score.breakeven_state` — the same two fields
// the profile hero reads (ValueScoreHero.tsx:39-40) — so the screener and a
// fund's own page cannot disagree on its verdict. There is no numeric threshold
// in this file: `breakevenState()` (the score100 → state derivation) is
// deliberately NOT imported.
//
// THE "vs {alt}" CAPTION IS SCORED-ONLY (spec ADDENDUM 1). `passive_alt_label`
// is populated on 1,329 UNSCORED funds, so keying the caption on label presence
// would assert a fee-vs-passive comparison for funds the pipeline refuses to
// judge. The reader already suppresses the field outside the scored branch, and
// the render guards on the state again — defense in depth on the one surface
// that would silently manufacture a verdict.
// ============================================================================
import Link from "next/link";
import {
  EM_DASH,
  breakevenStateChip,
  breakevenStateChipLabel,
  coverageStateLabel,
  fmtAum,
  fmtBps,
} from "@/lib/serving/format";
import { isScored, showsPassiveAltCaption } from "@/lib/serving/screener-select";
import type { ScreenerFilters, ScreenerRow } from "@/lib/serving/screener-select";
import { SortHeader } from "./SortHeader";

/**
 * The chip: the qualitative breakeven verdict for scored funds, the honest
 * reason otherwise. `coverageStateLabel` has a DEFAULT branch by design — a
 * coverage state we have not seen (today `unavailable` (1,944) and
 * `fee_at_other_level` (30) already fall through) reads "Not scored" rather than
 * throwing or, far worse, rendering a verdict it does not have.
 */
function verdictChip(row: ScreenerRow): { chip: string; label: string } {
  if (isScored(row) && row.value_breakeven_state) {
    return {
      chip: breakevenStateChip(row.value_breakeven_state),
      label: breakevenStateChipLabel(row.value_breakeven_state),
    };
  }
  return {
    chip: "bg-gray-50 text-gray-600 border-gray-200",
    label: coverageStateLabel(row.value_coverage_state),
  };
}

export function ScreenerTable({
  rows,
  filters,
}: {
  rows: ScreenerRow[];
  filters: ScreenerFilters;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <SortHeader label="Fund" sortKey="ticker" filters={filters} />
              {/* The verdict sits immediately after identity, and is the one
                  column never hidden: it is what this page exists to show, and
                  on a phone the columns to its right scroll out of view. */}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Value verdict
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">
                Peer group
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
                Type
              </th>
              <SortHeader
                label="Net fee"
                sortKey="fee"
                filters={filters}
                align="right"
              />
              <SortHeader
                label="Assets"
                sortKey="aum"
                filters={filters}
                align="right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  No served fund matches these filters. Widen them, or clear one.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const chip = verdictChip(row);
                const showAlt = showsPassiveAltCaption(row);
                return (
                  <tr key={row.series_id} className="hover:bg-blue-50/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/funds/${row.canonical_ticker}`}
                        className="group block"
                      >
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-[#1466b8]">
                          {row.canonical_ticker}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {row.fund_name ?? EM_DASH}
                        </span>
                        {showAlt && (
                          <span className="mt-0.5 block text-xs text-gray-400">
                            vs {row.value_passive_alt}
                            {row.value_confidence === "limited" &&
                              " · limited confidence"}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${chip.chip}`}
                      >
                        {chip.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {row.peer_group ? (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {row.peer_group}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{EM_DASH}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="text-xs text-gray-500">
                        {row.vehicle_type ?? EM_DASH}
                        {row.management_style ? ` · ${row.management_style}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {fmtBps(row.net_expense_ratio_bps)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {fmtAum(row.aum_usd)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
