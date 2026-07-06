// ============================================================================
// Fee Fairness (spec #3 / #11) + True Active Fee. Compares the fund's fee with
// peers and its passive alternative. For passive funds, fair_fee is null →
// honest cost-comparison state instead of an active-fee judgment.
// ============================================================================
import { Section, Card, Unavailable, AsOf } from "./primitives";
import {
  fmtBps,
  fmtSignedBps,
  fmtDollars,
  fmtDate,
  fairnessChip,
  feeDollars,
  EM_DASH,
} from "@/lib/serving/format";
import type { SourceStamp } from "@/lib/serving/profile";

interface FairFee {
  gap_bps: number | null;
  fair_fee_bps: number | null;
  perf_fee_bps: number | null;
  quality_tier: string | null;
  active_fee_bps: number | null;
  passive_fee_bps: number | null;
  fee_fairness_label: string | null;
  method_version?: string | null;
  eval_date?: string | null;
}

interface Fees {
  fair_fee: FairFee | null;
  net_expense_ratio_bps: number | null;
  gross_expense_ratio_bps: number | null;
  management_fee_bps: number | null;
  twelve_b1_fee_bps: number | null;
  front_load_bps: number | null;
  deferred_load_bps: number | null;
  redemption_fee_bps: number | null;
}

export function FeeFairness({
  fees,
  isPassive,
  expenseStamp,
}: {
  fees: Fees | null;
  isPassive: boolean;
  expenseStamp?: SourceStamp | null;
}) {
  if (!fees || fees.net_expense_ratio_bps == null) {
    return (
      <Section id="fees" title="Fee Fairness" methodologyAnchor="fee-fairness">
        <Unavailable>
          We don&apos;t have a recent filed expense ratio for this fund, so we
          suppress the fee comparison rather than guess.
        </Unavailable>
      </Section>
    );
  }

  const ff = fees.fair_fee;
  const net = fees.net_expense_ratio_bps;
  const activeFee = ff?.active_fee_bps ?? null;
  const passiveFee = ff?.passive_fee_bps ?? null;

  return (
    <Section
      id="fees"
      title="Fee Fairness"
      subtitle={
        isPassive
          ? "How this vehicle's cost compares with similar passive options."
          : "What you pay above the closest passive mix, and how that fee compares."
      }
      methodologyAnchor="fee-fairness"
    >
      <Card>
        {/* Fairness band (active funds with a fair-fee read) */}
        {!isPassive && ff?.fee_fairness_label && (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-md border px-3 py-1 text-sm font-bold ${fairnessChip(
                  ff.fee_fairness_label,
                )}`}
              >
                {ff.fee_fairness_label}
              </span>
              <span className="text-sm text-gray-600">
                Fair-fee band <strong>{fmtBps(ff.fair_fee_bps)}</strong>; this fund
                is{" "}
                {ff.gap_bps != null
                  ? ff.gap_bps > 0
                    ? `${fmtBps(Math.abs(ff.gap_bps))} below the band`
                    : `${fmtBps(Math.abs(ff.gap_bps))} above the band`
                  : EM_DASH}
                .
              </span>
            </div>
            {/* Reconcile the two verdicts a reader sees: Fee Fairness judges the
                fee in isolation; the value verdict up top nets that fee against
                how well selection has been evidenced. They are allowed to differ.
                References only already-shown labels — no gated number here. */}
            <p className="mt-2 text-sm text-gray-500">
              Fee Fairness judges only whether this fund&apos;s fee is reasonable
              for what it charges. The value verdict at the top of this page also
              weighs how well its stock-picking has been evidenced — so a fund can
              be fairly priced yet still land lower there.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FeeStat label="Net expense ratio" value={fmtBps(net)} />
          <FeeStat label="Gross expense ratio" value={fmtBps(fees.gross_expense_ratio_bps)} />
          {!isPassive && (
            <>
              <FeeStat
                label="Passive alternative fee"
                value={fmtBps(passiveFee)}
              />
              <FeeStat
                label="True active fee"
                value={fmtSignedBps(activeFee)}
                emphasis
              />
            </>
          )}
          {isPassive && (
            <>
              <FeeStat label="Management fee" value={fmtBps(fees.management_fee_bps)} />
              <FeeStat label="12b-1 fee" value={fmtBps(fees.twelve_b1_fee_bps)} />
            </>
          )}
        </div>

        {/* Fee dollars — recomputable from the displayed bps */}
        <div className="mt-5 rounded-lg bg-gray-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            What the fee costs per year
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <DollarRow
              notional={10000}
              fundBps={net}
              passiveBps={isPassive ? null : passiveFee}
            />
            <DollarRow
              notional={100000}
              fundBps={net}
              passiveBps={isPassive ? null : passiveFee}
            />
          </div>
        </div>

        {!isPassive && ff && ff.fee_fairness_label == null && (
          <div className="mt-4">
            <Unavailable>
              A fair-fee band isn&apos;t available for this fund yet; we show the
              active fee gap above and suppress the band rather than imply a
              judgment from the gap alone.
            </Unavailable>
          </div>
        )}
      </Card>

      <AsOf>
        Expense data: SEC MFRR / prospectus filings
        {/* Guard on the as-of date, not stamp presence: a `missing` stamp carries
            a null date (e.g. CHNTX), so we fall back to the base copy with no
            "as of —" literal and no stale note. */}
        {expenseStamp?.as_of_date != null ? (
          <>
            , as of {fmtDate(expenseStamp.as_of_date)}
            {expenseStamp.status === "stale" ? (
              <span className="text-gray-400"> (carried — awaiting newer filing)</span>
            ) : null}
          </>
        ) : null}
        . Passive fee: matched ETF blend.{" "}
        {ff?.method_version ? `Method ${ff.method_version}.` : ""}
        {ff?.eval_date ? ` Evaluated ${ff.eval_date}.` : ""}
      </AsOf>
    </Section>
  );
}

function FeeStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div
        className={`mt-0.5 tabular-nums ${
          emphasis ? "text-xl font-bold text-gray-900" : "text-lg font-semibold text-gray-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DollarRow({
  notional,
  fundBps,
  passiveBps,
}: {
  notional: number;
  fundBps: number | null;
  passiveBps: number | null;
}) {
  const fund = feeDollars(fundBps, notional);
  const passive = feeDollars(passiveBps, notional);
  const gap = fund != null && passive != null ? fund - passive : null;
  return (
    <div>
      <div className="text-xs text-gray-500">On {fmtDollars(notional)}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-gray-900">
        {fund != null ? `${fmtDollars(fund)}/yr` : EM_DASH}
      </div>
      {passive != null && (
        <div className="text-xs text-gray-500">
          passive {fmtDollars(passive)}/yr · gap {gap != null ? fmtDollars(gap) : EM_DASH}
        </div>
      )}
    </div>
  );
}
