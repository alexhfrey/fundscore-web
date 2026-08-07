// ============================================================================
// TwinPanel — Crescent v2 Block 5 lead card (Step 7). Server component.
// ----------------------------------------------------------------------------
// Ports the twin stat-card grid + the reframe blockquote from the design
// source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
//   section 5 "The Passive Twin" (twincols ~L368, renderTwin ~L870-897, the
//   .reframe blockquote ~L378-381).
//
// Deliberately narrower than the mockup's own section 5: the mockup also
// shows candidate/runner-up twins (a ranked selection table) and an annual
// twin-refit history strip — NEITHER is served today, so both are dropped
// rather than faked. Only what the page already serves ships here.
//
// The twin R² card reads valueScore.replica_r2 ONLY — the SAME number the
// Crescent mark's fill derives from (fillFromR2 / fillPctStr in crescent.ts).
// risk_behavior carries its own, DIFFERENT r_squared_3y (see RiskDetail3Y.tsx,
// "R² (3Y)") — that field must never appear on this panel: two sibling R²s on
// one card is the exact label/basis mismatch the project's data-integrity
// rules ban (AGENTS.md "Metric labels, units, and cross-panel coherence").
//
// The twin's fee goes through the already-committed receiptModel (same as
// FeeReceipt/HurdlePanel) — never re-derived — so this card can't disagree
// with the fee receipt on the same fund's twin fee.
// ============================================================================
import type { ValueScore } from "@/lib/serving/profile";
import { receiptModel } from "@/lib/crescent";
import { EM_DASH } from "@/lib/serving/format";

interface FeesShape {
  net_expense_ratio_bps?: number | null;
  fair_fee?: { passive_fee_bps?: number | null; active_fee_over_passive_bps?: number | null } | null;
}

const EYEBROW = "The passive twin · what we grade this fund against";

function Eyebrow() {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-400">{EYEBROW}</p>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-3">
      <div className="font-mono text-[10px] uppercase leading-tight tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[15px] tabular-nums text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-[10.5px] leading-snug text-gray-400">{sub}</div>}
    </div>
  );
}

export function TwinPanel({
  passiveLabel,
  fees,
  valueScore,
  teBps,
}: {
  /** The page's own passive-alternative label — the twin's name. */
  passiveLabel: string | null;
  fees: FeesShape | null;
  /** ONLY replica_r2 is read here — see file header re: the sibling-R² ban. */
  valueScore: ValueScore | null;
  /** positioningContext.te_bps — already free-gated upstream (null below the
   *  free tier, or when the fund has no served positioning context). */
  teBps: number | null;
}) {
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
  const twinFeeDollars = receipt?.passiveDollars != null ? Math.round(receipt.passiveDollars) : null;
  const twinFeeBps = receipt?.passiveBps ?? null;

  const r2 = valueScore?.replica_r2 ?? null;
  const teBasis = `weekly, β-adjusted vs ${passiveLabel ?? "the passive alternative"}`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <Eyebrow />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Passive twin" value={passiveLabel ?? EM_DASH} />
        <Stat
          label="Twin's fee"
          value={twinFeeDollars != null ? `$${twinFeeDollars} / $10k` : EM_DASH}
          sub={twinFeeBps != null ? `${twinFeeBps.toFixed(0)} bps/yr` : null}
        />
        <Stat
          label="Twin R² · weekly returns"
          value={r2 != null ? r2.toFixed(3) : EM_DASH}
        />
        <Stat
          label="Tracking error vs twin"
          value={teBps != null ? `${(teBps / 100).toFixed(1)}%/yr` : EM_DASH}
          sub={teBps != null ? teBasis : null}
        />
      </div>

      <blockquote className="mt-6 border-l-2 border-crescent-accent bg-gray-50/60 py-3.5 pl-4 pr-3 font-serif text-[15px] leading-relaxed text-gray-700">
        <strong className="font-semibold text-crescent-accent-text">
          We don&apos;t grade this fund against its marketing benchmark;
        </strong>{" "}
        we grade it against the cheapest thing that reproduces its returns.
      </blockquote>
    </div>
  );
}
