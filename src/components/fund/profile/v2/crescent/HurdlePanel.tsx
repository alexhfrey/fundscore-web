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

const EYEBROW = "The hurdle · after all fees vs its free twin";
const PERIOD_ORDER = ["1Y", "3Y", "5Y", "SI"];

function periodLabel(period: string, seriesStart: string | null): string {
  return period === "SI" ? `Since ${seriesStart ?? "series start"}` : period;
}

function Eyebrow() {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-400">{EYEBROW}</p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>;
}

/** Ports hurdleCopyStr (mockup L557-562): "Must beat X by ≈Y bps/yr just to
 *  cover its extra fee; over its {period} window it beat/trailed by Z bps/yr
 *  after all fees." Either clause is independently omittable when its inputs
 *  are missing — never a fabricated number. */
function hurdleLede({
  passiveLabel,
  surchargeBps,
  row,
}: {
  passiveLabel: string | null;
  surchargeBps: number | null;
  row: NavPeriodRow | null;
}): string | null {
  const clauses: string[] = [];
  if (surchargeBps != null) {
    clauses.push(
      `Must beat ${passiveLabel ?? "its free twin"} by ≈${Math.round(surchargeBps)} bps/yr just to cover its extra fee`,
    );
  }
  if (row && row.diff_bps != null) {
    const verb = row.diff_bps >= 0 ? "beat" : "trailed";
    clauses.push(
      `over its ${row.period} window it ${verb} it by ${Math.abs(Math.round(row.diff_bps))} bps/yr after all fees`,
    );
  }
  if (clauses.length === 0) return null;
  return `${clauses.join("; ")}.`;
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
        <Eyebrow />
        <div className="mt-3">
          <Unavailable>Performance history isn&apos;t available for this fund.</Unavailable>
        </div>
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
  const repRow = table.find((r) => r.period === "5Y") ?? table.find((r) => r.period === "SI") ?? null;
  const lede = hurdleLede({ passiveLabel, surchargeBps: receipt?.surchargeBps ?? null, row: repRow });

  const scale = hurdleScale(table);
  const ordered = PERIOD_ORDER.map((p) => table.find((r) => r.period === p)).filter(
    (r): r is NavPeriodRow => r != null,
  );
  // Belt-and-braces: if a served period label falls outside the canonical
  // 1Y/3Y/5Y/SI set, still render it rather than silently dropping a row.
  const rows = ordered.length > 0 ? ordered : table;

  return (
    <Card>
      <Eyebrow />
      {lede && <p className="mt-3 text-[13.5px] leading-relaxed text-gray-600">{lede}</p>}

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
