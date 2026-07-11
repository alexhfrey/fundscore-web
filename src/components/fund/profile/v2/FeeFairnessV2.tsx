// ============================================================================
// 07 · FeeFairnessV2 — REAL served fees (not a fixture). Builds the mock's fee
// ruler from fees.fair_fee when present; falls back to the existing FeeFairness
// component when it is absent. Every figure is served directly; the only
// composition is the geometry of placing the fair marker its served over-passive
// premium to the right of the passive marker. Gated FREE.
// fee-peer-band-web: when fees.peer_percentile is served, one cohort sentence
// under the ruler + a percentile line on the fund's ruler mark; absent → nothing.
// ============================================================================
import { pctFromBps, fmtBps, fmtSignedBps, fairnessChip, EM_DASH } from "@/lib/serving/format";
import { ordinal } from "./format";
import { ChapterHeader, Panel, PanelNote } from "./primitives";
import { LockedNotice } from "../primitives";
import { FeeFairness } from "../FeeFairness";

interface FairFee {
  fair_fee_bps?: number | null;
  passive_fee_bps?: number | null;
  active_fee_bps?: number | null;
  active_fee_over_passive_bps?: number | null;
  fee_fairness_label?: string | null;
  gap_bps?: number | null;
  perf_fee_bps?: number | null;
  eval_date?: string | null;
}
interface PeerCohortConstituent {
  etf?: string | null;
  weight?: number | null;
}
interface PeerCohort {
  label?: string | null;
  n_funds?: number | null;
  is_blend?: boolean | null;
  constituents?: PeerCohortConstituent[] | null;
}
interface PeerPercentile {
  fee_percentile?: number | null;
  cohort?: PeerCohort | null;
}
interface FeesShape {
  fair_fee?: FairFee | null;
  peer_percentile?: PeerPercentile | null;
  net_expense_ratio_bps?: number | null;
  gross_expense_ratio_bps?: number | null;
  management_fee_bps?: number | null;
}

// Cohort description for the peer-percentile sentence. Blend-baseline funds get
// the owner-decided honest phrasing (constituent ETFs + weights); single-ETF
// cohorts name the ETF directly. Cohort name + n are ALWAYS in the copy.
function cohortPhrase(c: PeerCohort): string {
  if (c.is_blend && c.constituents?.length) {
    const weights = c.constituents
      .map((k) => `${k.etf} ${Math.round((k.weight ?? 0) * 100)}%`)
      .join(" / ");
    return `funds sharing its blended passive alternative (weighted across ${weights})`;
  }
  return `funds benchmarked to ${c.label}`;
}

function niceMax(v: number): number {
  return Math.ceil(v / 10) * 10;
}

export function FeeFairnessV2({
  fees,
  isPassive,
  free,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fees: any;
  isPassive: boolean;
  free: boolean;
}) {
  if (!free) {
    return (
      <section id="s7" className="scroll-mt-24">
        <ChapterHeader index={7} title="Fee fairness" />
        <LockedNotice tier="free">
          See what you pay above the closest passive alternative and how that fee
          compares with a fair-fee estimate for this fund&apos;s level of active work.
        </LockedNotice>
      </section>
    );
  }

  const f = fees as FeesShape | null;
  const ff = f?.fair_fee ?? null;

  // No fair-fee read → fall back to the shipped FeeFairness component.
  if (!ff || ff.fair_fee_bps == null || f?.net_expense_ratio_bps == null) {
    return (
      <section id="s7" className="scroll-mt-24">
        <FeeFairness fees={fees} isPassive={isPassive} />
      </section>
    );
  }

  const passive = ff.passive_fee_bps ?? null;
  const fundTotal = f.net_expense_ratio_bps as number;
  const fairPremium = ff.fair_fee_bps as number; // over-passive premium
  const fairTotal = passive != null ? passive + fairPremium : null;
  const overPassive = ff.active_fee_over_passive_bps ?? null;
  const label = ff.fee_fairness_label ?? null;

  // fee-peer-band-web: percentile of over-passive fee within the shared-passive-alt
  // cohort. Rendered ONLY when the served payload is complete; absent → nothing new.
  const peerRaw = f?.peer_percentile ?? null;
  const peerView =
    peerRaw?.fee_percentile != null &&
    peerRaw.cohort?.n_funds != null &&
    peerRaw.cohort.label != null &&
    overPassive != null
      ? {
          pct: peerRaw.fee_percentile,
          n: peerRaw.cohort.n_funds,
          phrase: cohortPhrase(peerRaw.cohort),
        }
      : null;

  const scaleMax = niceMax(Math.max(fundTotal, fairTotal ?? fundTotal, passive ?? 0) * 1.05);
  const pos = (v: number | null) => (v == null ? 0 : Math.max(0, Math.min(100, (v / scaleMax) * 100)));

  return (
    <section id="s7" className="scroll-mt-24">
      <ChapterHeader
        index={7}
        title="Fee fairness"
        asOf={ff.eval_date ? `SEC expense filings · FundScore fee analysis · eval ${ff.eval_date}` : undefined}
        takeaway={
          <>
            You pay{" "}
            <span className="tabular-nums">
              {overPassive != null ? `${Math.round(overPassive)} bps/yr` : EM_DASH}
            </span>{" "}
            above simply holding the passive alternative
            {passive != null ? ` (${pctFromBps(passive)})` : ""} — against a{" "}
            <span className="tabular-nums">
              {`≈${Math.round(fairPremium)} bps`}
            </span>{" "}
            fair-fee estimate for its level of active work. Fee fairness:{" "}
            <span className="font-bold">{label ?? EM_DASH}</span>.
          </>
        }
      />

      <Panel className="p-0">
        {/* Fund vs passive header */}
        <div className="grid sm:grid-cols-[1fr_auto_1fr]">
          <div className="px-5 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              This fund · active
            </div>
            <div className="mt-1.5 text-3xl font-bold tabular-nums text-gray-900">
              {pctFromBps(fundTotal)}
              <span className="text-sm font-medium text-gray-400">/yr</span>
            </div>
            <div className="mt-1.5 text-[12px] leading-snug text-gray-500">
              Net expense ratio
              {f.management_fee_bps != null && (
                <> · management fee {pctFromBps(f.management_fee_bps)}</>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center border-y border-gray-100 bg-gray-50 px-5 py-3 sm:border-x sm:border-y-0">
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {overPassive != null ? `${Math.round(overPassive)} bps` : EM_DASH}
            </div>
            <div className="mt-0.5 text-center text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
              fee above passive
            </div>
          </div>
          <div className="bg-gray-50/60 px-5 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Passive alternative
            </div>
            <div className="mt-1.5 text-3xl font-bold tabular-nums text-gray-900">
              {passive != null ? pctFromBps(passive) : EM_DASH}
              <span className="text-sm font-medium text-gray-400">/yr</span>
            </div>
            <div className="mt-1.5 text-[12px] leading-snug text-gray-500">
              The closest passive alternative
            </div>
          </div>
        </div>

        {/* The ruler: index fee → fair marker → fund fee on one 0→scale scale */}
        <div className="border-t border-gray-100 px-5 pb-5 pt-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[13px] font-semibold text-gray-900">
              The fee, on one 0–{scaleMax} bps scale
            </h4>
            {label && (
              <span className={`rounded-md border px-2.5 py-1 text-[12.5px] font-bold ${fairnessChip(label)}`}>
                {overPassive != null ? `${Math.round(overPassive)} over passive` : ""} vs ≈
                {Math.round(fairPremium)} fair → {label}
              </span>
            )}
          </div>
          <div className="relative pb-14 pt-8">
            {/* Track */}
            <div className="relative h-3 rounded-full border border-gray-200 bg-gray-100">
              {/* Fair zone: passive → fair total */}
              {fairTotal != null && passive != null && (
                <div
                  className="absolute top-0 h-3 rounded-full bg-emerald-100"
                  style={{ left: `${pos(passive)}%`, width: `${pos(fairTotal) - pos(passive)}%` }}
                />
              )}
              {/* Over-fair zone: fair total → fund (only if fund exceeds fair) */}
              {fairTotal != null && fundTotal > fairTotal && (
                <div
                  className="absolute top-0 h-3 rounded-full bg-amber-100"
                  style={{ left: `${pos(fairTotal)}%`, width: `${pos(fundTotal) - pos(fairTotal)}%` }}
                />
              )}
              <Mark left={pos(passive)} color="bg-gray-500" />
              {fairTotal != null && <Mark left={pos(fairTotal)} color="bg-amber-600" />}
              <Mark left={pos(fundTotal)} color="bg-gray-900" wide />
            </div>
            {/* Top labels */}
            {passive != null && (
              <RulerLabel left={pos(passive)} top color="text-gray-500" main={`${Math.round(passive)}`} sub="passive — just buy the index" />
            )}
            <RulerLabel
              left={pos(fundTotal)}
              top
              color="text-gray-900"
              main={`${Math.round(fundTotal)}`}
              sub="this fund — what it charges"
              sub2={peerView ? `${ordinal(peerView.pct)} percentile of ${peerView.n}` : undefined}
            />
            {/* Bottom label */}
            {fairTotal != null && (
              <RulerLabel
                left={pos(fairTotal)}
                color="text-amber-700"
                main={`≈${Math.round(fairTotal)} total`}
                sub={`fair — ≈${Math.round(fairPremium)} over passive`}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] font-semibold text-gray-400">
            <span>0 bps</span>
            <span>{scaleMax} bps</span>
          </div>

          {peerView && (
            <p className="mt-4 text-[12.5px] leading-relaxed text-gray-600">
              <b className="tabular-nums">{Math.round(overPassive as number)} bps over passive</b>{" "}
              is higher than {Math.round(peerView.pct)}% of the {peerView.n} {peerView.phrase}.
            </p>
          )}

          <p className="mt-4 text-[12.5px] leading-relaxed text-gray-600">
            Our fair-fee model estimates <b>≈{Math.round(fairPremium)} bps over passive</b>
            {fairTotal != null ? ` (≈${Math.round(fairTotal)} bps total)` : ""} is justified
            for this fund&apos;s level of active work
            {ff.eval_date ? ` (eval ${ff.eval_date})` : ""}. It charges{" "}
            <b>{overPassive != null ? `${Math.round(overPassive)} bps over passive` : EM_DASH}</b>
            {label ? ` → ${label}` : ""}.
          </p>
        </div>

        {/* Labeled fee inputs — shown, NOT summed into a total. */}
        <PanelNote>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FeeInput label="Net expense ratio" value={fmtBps(f.net_expense_ratio_bps)} />
            <FeeInput label="Gross expense ratio" value={fmtBps(f.gross_expense_ratio_bps)} />
            <FeeInput label="Passive alternative fee" value={fmtBps(passive)} />
            <FeeInput label="True active fee" value={fmtSignedBps(ff.active_fee_bps)} emphasis />
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
            Components are labeled inputs to the fair-fee model, not addends — they do
            not sum to the net expense ratio.{" "}
            <b>A fair fee is table stakes, not a verdict:</b> it buys access to the
            manager; whether the stock-picking adds value is the attribution section&apos;s
            question.
          </p>
        </PanelNote>
      </Panel>
    </section>
  );
}

function Mark({ left, color, wide }: { left: number; color: string; wide?: boolean }) {
  return (
    <span
      className={`absolute -top-1 h-5 -translate-x-1/2 rounded ${color} ${wide ? "w-1" : "w-0.5"}`}
      style={{ left: `${left}%` }}
    />
  );
}

function RulerLabel({
  left,
  top,
  color,
  main,
  sub,
  sub2,
}: {
  left: number;
  top?: boolean;
  color: string;
  main: string;
  sub: string;
  sub2?: string;
}) {
  return (
    <span
      className={`absolute -translate-x-1/2 whitespace-nowrap text-center text-[10.5px] font-bold leading-tight ${color}`}
      style={{ left: `${Math.max(6, Math.min(94, left))}%`, top: top ? 0 : "auto", bottom: top ? "auto" : 0 }}
    >
      {main}
      <span className="block font-medium text-gray-400">{sub}</span>
      {sub2 && <span className="block font-semibold text-gray-600">{sub2}</span>}
    </span>
  );
}

function FeeInput({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-0.5 tabular-nums ${emphasis ? "text-lg font-bold text-gray-900" : "text-base font-semibold text-gray-800"}`}>
        {value}
      </div>
    </div>
  );
}
