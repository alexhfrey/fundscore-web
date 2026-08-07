// ============================================================================
// DistributionStrip — the published fill-band bar + this fund's marker.
// Server component, pure CSS/Tailwind (no canvas). Ports the segmented-bar +
// marker geometry from the design source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
//   renderStrip (~L782-817). Band shares/ranges are the LOCKED served
// constant (crescent.ts FILL_BANDS) — never re-derived here.
// ============================================================================
import { FILL_BANDS, stripMarkerPos } from "@/lib/crescent";

// Segment tints — verbatim from renderStrip's own `tints` array (mockup L787).
const TINTS = [8, 16, 26, 38, 52];

// FILL_BANDS.shares are derived from this same N (crescent.ts's own doc
// comment: "N=2708 EQ active series with a returns-basis fill" — fund_score
// mockup L525-532 / bandData()). Not re-derivable from the exported constant
// alone, so it is pinned here with the same provenance.
const BAND_TOTAL_N = 2708;

// Provenance (fund_score reports/product/crescent_data_validation.md,
// 2026-07-18): among funds that clear the FULL scoring gate (mark + verdict +
// receipt + hurdle), observed fill tops out at ~24.9% — higher-fill funds
// exist but overwhelmingly fail the verdict gate (young track record / no
// fair twin), so the upper bands are dominated by funds without a scored
// verdict. This is a property of the SCORED set, not of the 7-fund exemplar
// fixture (JEPSX's 24.9% max there is a coincidence of the same ceiling).
const SCORED_MAX_FILL_PCT = "24.9";

export function DistributionStrip({
  ticker,
  fill,
  fillPct,
}: {
  ticker: string;
  /** Gold-fill fraction in [0,1]; null when the fund has no verdict. */
  fill: number | null;
  /** The SAME fillPctStr string the verdict sentence and Crescent mark use —
   *  never re-derived here, so the marker label can't disagree with them. */
  fillPct: string | null;
}) {
  const pos = fill != null ? stripMarkerPos(fill) : null;

  return (
    <div className="border-t border-gray-100 px-6 py-6">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gray-400">
        Where {ticker} sits · gold fill across {BAND_TOTAL_N} EQ funds
      </p>

      <div className="relative mt-8">
        {pos != null && fillPct != null && (
          <div
            className="absolute -top-7 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pos}%` }}
          >
            <span className="whitespace-nowrap rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-900 shadow-sm">
              {ticker} · {fillPct}%
            </span>
            <span className="mt-0.5 h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-gray-900" />
          </div>
        )}
        <div className="flex h-7 overflow-hidden rounded-lg border border-gray-200">
          {FILL_BANDS.names.map((name, i) => (
            <div
              key={name}
              style={{
                width: `${FILL_BANDS.shares[i]}%`,
                backgroundColor: `color-mix(in srgb, var(--crescent-accent) ${TINTS[i]}%, #eef1f5)`,
              }}
              title={`${name} fill: ${FILL_BANDS.shares[i]}% of funds`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex">
          {FILL_BANDS.names.map((name, i) => (
            <div
              key={name}
              style={{ width: `${FILL_BANDS.shares[i]}%` }}
              className="truncate text-center font-mono text-[10px] text-gray-400"
            >
              {name.replace("-", "–")} · {FILL_BANDS.shares[i]}%
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 max-w-[72ch] text-[12.5px] leading-relaxed text-gray-500">
        Distribution of fill (1 − twin R²) across {BAND_TOTAL_N} equity funds with a computable
        fill. Reading the scale honestly: funds with a scored verdict top out around{" "}
        {SCORED_MAX_FILL_PCT}% fill — the higher bands are dominated by funds we can&apos;t fully
        grade yet (young track record, or no fair passive twin).
      </p>
    </div>
  );
}
