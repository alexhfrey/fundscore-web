// ============================================================================
// HurdlePanel — Crescent v2 Block 4 (Step 5). Server component; bars are pure
// divs (no canvas, no client JS).
// ----------------------------------------------------------------------------
// Ports renderHurdle + hurdleCopyStr from the design source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
//   renderHurdle (~L841-869), hurdleCopyStr (~L557-562).
// Scale math and the lede's surcharge figure go through the ALREADY-COMMITTED
// crescent.ts (hurdleScale, receiptModel) — never re-derived.
//
// Adaptations from the mockup (real served shape has fewer fields than the
// mockup's own illustrative dataset):
//  - NavPeriodRow carries no window_start/window_end/n_months, so the lede's
//    date range and the mockup's bottom "hurdleWindows" footer line are
//    dropped rather than fabricated.
//  - The mockup's per-row hover tooltip (fund/twin annualized %, requires
//    client JS) is rendered as an always-visible small-print line instead —
//    this is a pure server component.
//  - SI is labeled "Since {series_start}", NOT "Since inception": series_start
//    is the common PAIRED WINDOW start, not the fund's inception date — the
//    exact convention HistoricalPerformance.tsx's own periodLabel enforces a
//    few components away. Using "inception" here would contradict that
//    established, deliberate label and misstate the basis.
// ============================================================================
import type { NavPeriodRow, NavSeries } from "@/lib/serving/profile-v2";
import { hurdleScale, receiptModel } from "@/lib/crescent";
import { EM_DASH, fmtSignedBps } from "@/lib/serving/format";
import { Unavailable, UnlockLine } from "../../primitives";

interface FeesShape {
  net_expense_ratio_bps?: number | null;
  fair_fee?: {
    passive_fee_bps?: number | null;
    active_fee_over_passive_bps?: number | null;
  } | null;
}

const PERIOD_ORDER = ["1Y", "3Y", "5Y", "SI"];
/** Longest-first — the headline speaks for the longest served window. */
const HEADLINE_ORDER = ["SI", "5Y", "3Y", "1Y"];

function periodLabel(period: string, seriesStart: string | null): string {
  return period === "SI" ? `Since ${seriesStart ?? "series start"}` : period;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>;
}

/**
 * The Performance section's serif headline (design pass 2026-07-22): one
 * sentence for the LONGEST served window with a real diff — "Since 2008, it
 * has trailed SPY by 111 bps a year after all fees." Plain diff_bps basis
 * only (the β-adjusted read stays a labeled secondary inside the card);
 * the SI clock is the common paired window's start year (series_start),
 * consistent with the row labels. Falls back to a plain question when no
 * window has a diff — never a fabricated number.
 */
export function HurdleHeadline({
  navSeries,
  passiveLabel,
}: {
  navSeries: NavSeries | null;
  passiveLabel: string | null;
}) {
  const table = navSeries?.period_table ?? [];
  const row =
    HEADLINE_ORDER.map((p) => table.find((r) => r.period === p && r.diff_bps != null)).find(
      (r) => r != null,
    ) ?? null;
  if (!row) return <>Did it earn its keep?</>;

  const beat = (row.diff_bps as number) >= 0;
  const twin = passiveLabel ?? "its free twin";
  const amount = `${Math.abs(Math.round(row.diff_bps as number))} bps a year`;
  const verbSpan = (
    <span className={beat ? "text-crescent-good" : "text-crescent-bad"}>
      {beat ? "beaten" : "trailed"} {twin} by {amount}
    </span>
  );
  if (row.period === "SI") {
    const year = navSeries?.series_start ? navSeries.series_start.slice(0, 4) : null;
    return (
      <>
        {year ? `Since ${year}, ` : "Over its full paired history, "}it has {verbSpan} after all
        fees.
      </>
    );
  }
  const windowWord = row.period === "1Y" ? "the last year" : `the last ${row.period.replace("Y", " years")}`;
  return (
    <>
      Over {windowWord}, it has {verbSpan} after all fees.
    </>
  );
}

/** Ports hurdleCopyStr's first clause (mockup L557-562). The outcome clause
 *  moved up to HurdleHeadline (the section headline) in the 2026-07-22 design
 *  pass — keeping it here too would say the same thing twice on one screen. */
function hurdleLede({
  passiveLabel,
  surchargeBps,
}: {
  passiveLabel: string | null;
  surchargeBps: number | null;
}): string | null {
  if (surchargeBps == null) return null;
  return `The bar: must beat ${passiveLabel ?? "its free twin"} by ≈${Math.round(surchargeBps)} bps/yr just to cover its extra fee.`;
}

export function HurdlePanel({
  navSeries,
  fees,
  passiveLabel,
  paid,
}: {
  navSeries: NavSeries | null;
  fees: FeesShape | null;
  passiveLabel: string | null;
  /** Paid tier sees every served window; below paid the page has already
   *  collapsed period_table to one proof-point row (applyGates, nav_series
   *  field-gate) — this only decides whether the unlock line shows. */
  paid: boolean;
}) {
  if (!navSeries || navSeries.period_table.length === 0) {
    return (
      <Card>
        <Unavailable>Performance history isn&apos;t available for this fund.</Unavailable>
      </Card>
    );
  }

  const receipt = receiptModel(
    fees
      ? {
          net_expense_ratio_bps: fees.net_expense_ratio_bps ?? null,
          fair_fee: fees.fair_fee
            ? {
                passive_fee_bps: fees.fair_fee.passive_fee_bps ?? null,
                active_fee_over_passive_bps: fees.fair_fee.active_fee_over_passive_bps ?? null,
              }
            : null,
        }
      : null,
  );

  const table = navSeries.period_table;
  const lede = hurdleLede({ passiveLabel, surchargeBps: receipt?.surchargeBps ?? null });

  const scale = hurdleScale(table);
  const ordered = PERIOD_ORDER.map((p) => table.find((r) => r.period === p)).filter(
    (r): r is NavPeriodRow => r != null,
  );
  // Belt-and-braces: if a served period label falls outside the canonical
  // 1Y/3Y/5Y/SI set, still render it rather than silently dropping a row.
  const rows = ordered.length > 0 ? ordered : table;

  return (
    <Card>
      {lede && <p className="text-[13.5px] leading-relaxed text-gray-600">{lede}</p>}

      <div className="mt-5 grid grid-cols-[76px_1fr_120px] items-center gap-3 font-mono text-[10px] text-gray-400">
        <span />
        <div className="relative h-3">
          <span className="absolute left-0">{`−${scale}`}</span>
          <span className="absolute left-1/2 -translate-x-1/2">0</span>
          <span className="absolute right-0">{`+${scale} bps/yr`}</span>
        </div>
        <span />
      </div>

      <div className="mt-2 space-y-3">
        {rows.map((r) => (
          <HurdleRow key={r.period} row={r} scale={scale} seriesStart={navSeries.series_start} />
        ))}
      </div>

      {!paid && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <UnlockLine tier="paid">See every window (1Y/3Y/5Y/SI) and the β-adjusted read.</UnlockLine>
        </div>
      )}
    </Card>
  );
}

function HurdleRow({
  row,
  scale,
  seriesStart,
}: {
  row: NavPeriodRow;
  scale: number;
  seriesStart: string | null;
}) {
  const label = periodLabel(row.period, seriesStart);
  const hasDiff = row.diff_bps != null;
  const positive = hasDiff && (row.diff_bps as number) >= 0;
  const widthPct = hasDiff ? Math.min(50, (Math.abs(row.diff_bps as number) / scale) * 50) : 0;

  return (
    <div className="grid grid-cols-[76px_1fr_120px] items-center gap-3">
      <span className="font-mono text-[12px] text-gray-500">{label}</span>
      <div className="relative h-5">
        <span className="absolute left-1/2 -top-1 -bottom-1 w-px -translate-x-1/2 bg-gray-200" />
        {hasDiff && (
          <span
            className={
              positive
                ? "absolute left-1/2 top-0.5 h-4 rounded-r-md bg-crescent-good"
                : "absolute right-1/2 top-0.5 h-4 rounded-l-md bg-crescent-bad"
            }
            style={{ width: `${widthPct}%` }}
          />
        )}
      </div>
      <div className="text-right">
        {hasDiff ? (
          <>
            <div
              className={`font-mono text-[13px] font-semibold tabular-nums ${positive ? "text-crescent-good" : "text-crescent-bad"}`}
            >
              {`${fmtSignedBps(row.diff_bps)}/yr`}
            </div>
            {row.beta_adj_diff_bps != null && (
              <div className="font-mono text-[10.5px] text-gray-400">
                {`β-adjusted: ${fmtSignedBps(row.beta_adj_diff_bps)}/yr`}
              </div>
            )}
            {row.fund_ann_pct != null && row.passive_ann_pct != null && (
              <div className="font-mono text-[10px] text-gray-400">
                {`${row.fund_ann_pct.toFixed(2)}% vs ${row.passive_ann_pct.toFixed(2)}%`}
              </div>
            )}
          </>
        ) : (
          <span className="font-mono text-[13px] text-gray-400">{EM_DASH}</span>
        )}
      </div>
    </div>
  );
}
