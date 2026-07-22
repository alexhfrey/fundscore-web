// ============================================================================
// FeeReceipt — Crescent v2 Block 3 (Step 5). Server component.
// ----------------------------------------------------------------------------
// Ports renderReceipt from the design source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
//   renderReceipt (~L818-840), receiptModel (~L534-538).
// Every dollar/bps figure goes through the ALREADY-COMMITTED crescent.ts
// receiptModel — never re-derived — so this can never disagree with
// VerdictBlock's own multiple/dollar language for the same fund (crescent.ts's
// own design goal).
//
// Below-the-line "what the surcharge bought" rows read the 5Y/SI legs off the
// SERVED nav_series.period_table (profile-nav-series). The real NavPeriodRow
// carries no window_start/window_end/n_months (unlike the mockup's own
// illustrative dataset) — those date-range sub-labels are dropped rather than
// fabricated; only the period label + diff survive.
// ============================================================================
import type { NavPeriodRow } from "@/lib/serving/profile-v2";
import { receiptModel } from "@/lib/crescent";
import { EM_DASH, fmtBps, fmtSignedBps } from "@/lib/serving/format";
import { LockedNotice, Unavailable } from "../../primitives";

interface FeesShape {
  net_expense_ratio_bps?: number | null;
  fair_fee?: {
    passive_fee_bps?: number | null;
    active_fee_over_passive_bps?: number | null;
  } | null;
}

const EYEBROW = "Fee receipt · per $10,000 / year";

/** SI = the common paired window start, NOT the fund's inception — same
 *  honesty convention as HistoricalPerformance.tsx's own periodLabel. */
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

export function FeeReceipt({
  fees,
  periodTable,
  seriesStart,
  free,
}: {
  fees: FeesShape | null;
  /** SERVED nav_series.period_table, whatever the page's tier already left it as. */
  periodTable: NavPeriodRow[] | null;
  seriesStart: string | null;
  free: boolean;
}) {
  if (!free) {
    return (
      <Card>
        <Eyebrow />
        <div className="mt-3">
          <LockedNotice tier="free">
            See the twin&apos;s fee, the active surcharge, and what it bought — per $10,000, every
            year.
          </LockedNotice>
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

  if (!receipt) {
    return (
      <Card>
        <Eyebrow />
        <div className="mt-3">
          <Unavailable>Fee data isn&apos;t available for this fund.</Unavailable>
        </div>
      </Card>
    );
  }

  // Guaranteed non-null by receiptModel's own contract: it returns null only
  // when there is no total to anchor the receipt at all (crescent.ts doc).
  const totalBps = receipt.totalBps as number;
  const totalDollars = receipt.totalDollars as number;

  // Two distinct honest states behind sumOK=false (review finding, step 5):
  // a leg that's ABSENT (e.g. passive funds serve active_fee_over_passive_bps
  // = null by design) is not a failed reconciliation — the em-dash row says it;
  // the "don't sum exactly" caveat is reserved for legs that are both present
  // and genuinely off by > 0.1 bps.
  const legsPresent = receipt.passiveDollars != null && receipt.surchargeDollars != null;

  // The "=" claim must hold for the digits we actually print: independent
  // rounding can show $10 + $10 = $21 from legs that reconcile pre-rounding.
  // Pick the fewest decimals (0, then 1) at which the printed rows really sum;
  // if neither works, drop the "=" claim rather than print false arithmetic.
  const roundTo = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  let dollarDecimals = 0;
  let displaySums = false;
  if (receipt.sumOK && legsPresent) {
    for (const d of [0, 1]) {
      if (
        Math.abs(
          roundTo(receipt.passiveDollars!, d) +
            roundTo(receipt.surchargeDollars!, d) -
            roundTo(totalDollars, d),
        ) < 1e-9
      ) {
        dollarDecimals = d;
        displaySums = true;
        break;
      }
    }
  }

  const belowRows = ["5Y", "SI"]
    .map((p) => periodTable?.find((r) => r.period === p) ?? null)
    .filter((r): r is NavPeriodRow => r != null && r.diff_bps != null);

  return (
    <Card>
      <Eyebrow />

      <div className="mt-4 font-mono text-[13.5px]">
        <ReceiptRow
          label="Twin's fee (would pay anyway)"
          dollars={receipt.passiveDollars}
          bps={receipt.passiveBps}
          decimals={dollarDecimals}
        />
        <ReceiptRow
          label="Active surcharge"
          dollars={receipt.surchargeDollars}
          bps={receipt.surchargeBps}
          decimals={dollarDecimals}
          accent
        />

        <div className="mt-1 flex items-baseline justify-between border-t-2 border-gray-900 pt-2.5 text-[15px]">
          <span className="font-semibold text-gray-900">
            {displaySums ? "= Your fee" : "Your fee (net expense ratio)"}
          </span>
          <span className="text-right font-semibold tabular-nums text-gray-900">
            {`$${roundTo(totalDollars, dollarDecimals).toFixed(dollarDecimals)}`}
            <small className="block text-[11px] font-normal text-gray-400">
              {fmtBps(totalBps)} net ER
            </small>
          </span>
        </div>

        {legsPresent && !receipt.sumOK && (
          <p className="mt-2 font-sans text-[11.5px] leading-relaxed text-gray-400">
            Twin fee and surcharge are computed independently in the fee pipeline; for this fund
            they do not sum exactly, so no total is claimed.
          </p>
        )}
      </div>

      {receipt.multiple != null && (
        <p className="mt-3 text-[12.5px] text-gray-500">
          <span className="font-semibold text-crescent-accent-text">
            {receipt.multiple.toFixed(1)}×
          </span>{" "}
          its twin&apos;s fee.
        </p>
      )}

      {belowRows.length > 0 && (
        <div className="mt-4 border-t border-dashed border-gray-200 pt-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-gray-400">
            Past performance — estimate, not a promise
          </p>
          <p className="mt-1.5 text-[12px] text-gray-500">
            What the surcharge bought — after all fees, vs its free twin:
          </p>
          <div className="mt-1.5 space-y-1 font-mono text-[12.5px]">
            {belowRows.map((r) => (
              <div key={r.period} className="flex items-baseline justify-between">
                <span className="text-gray-500">{periodLabel(r.period, seriesStart)}</span>
                <span className={r.diff_bps! >= 0 ? "text-crescent-good" : "text-crescent-bad"}>
                  {fmtSignedBps(r.diff_bps)}/yr
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReceiptRow({
  label,
  dollars,
  bps,
  decimals = 0,
  accent,
}: {
  label: string;
  dollars: number | null;
  bps: number | null;
  /** Shared with the total row so the printed receipt actually sums. */
  decimals?: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-dotted border-gray-200 py-2">
      <span className={accent ? "font-semibold text-crescent-accent-text" : "text-gray-600"}>
        {label}
      </span>
      <span
        className={`text-right tabular-nums ${accent ? "font-semibold text-crescent-accent-text" : "text-gray-900"}`}
      >
        {dollars != null && bps != null ? (
          <>
            {`$${(Math.round(dollars * 10 ** decimals) / 10 ** decimals).toFixed(decimals)}`}
            <small className="block text-[11px] font-normal text-gray-400">{fmtBps(bps)}</small>
          </>
        ) : (
          EM_DASH
        )}
      </span>
    </div>
  );
}
