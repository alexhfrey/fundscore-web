// ============================================================================
// Value Score hero (CURRENT value verdict, 2026-06-29).
// ----------------------------------------------------------------------------
// "What are you actually getting for your fees vs the fund's best passive
// alternative?" — net active value over the passive alternative, beta-adjusted.
// Replaces old FundScore AND the value_offering_reframed badge. The bet/exposure
// X-Ray stays as the complementary "what is this fund" surface.
//
// FRAMING GUARDRAIL (non-negotiable — gates this UI): RELATIVE / DIAGNOSTIC,
// never "beats passive". v30 showed even the top-scoring funds historically lost
// to passive net of fees; only ~1 in 5 clear breakeven. So: lead with the
// breakeven SIGN, surface the passive alternative ALWAYS, keep copy backward-
// looking ("added/trailed", never "adds genuine value"), no precision theater
// (the figure is coarsened + mostly noise), and handle non-scored states with
// the honest reason — never a fabricated number.
//
// Tiering: the VERDICT (above/≈/below breakeven + passive alt + confidence +
// base rate) is free; the PRECISE figures + the fee-vs-excess receipt are paid
// (verdict free, precision paid). applyGates nulls the paid fields below 'paid'.
// ============================================================================
import Link from "next/link";
import {
  breakevenStateChip,
  breakevenStateChipLabel,
  coverageStateLabel,
  coverageStateReason,
  pctFromBps,
  confidenceLabel,
  type BreakevenState,
} from "@/lib/serving/format";
import { AsOf, Unavailable, UnlockLine } from "./primitives";
import type { ValueScore } from "@/lib/serving/profile";

const METHODOLOGY_ANCHOR = "value-score";

export function ValueScoreHero({ vs }: { vs: ValueScore | null }) {
  if (!vs) return null;

  const scored = vs.coverage_state === "scored";
  const state = (vs.breakeven_state ?? null) as BreakevenState | null;
  // Precise figures are paid; applyGates nulls them below the paid tier. Their
  // presence is how the hero knows whether to show the precise read or the
  // free verdict + unlock affordance.
  const hasPrecise = vs.value_bps != null || vs.score100 != null;
  const confChip = confidenceLabel(vs.confidence, hasPrecise ? vs.replica_r2 : null);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header band — matches the profile hero aesthetic. */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-[#13483a] to-[#1f6b54] px-6 py-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-50">
            Value Score
          </div>
          <div className="truncate text-[11px] text-emerald-100/80">
            net value vs the passive alternative
          </div>
        </div>
        <Link
          href={`/methodology#${METHODOLOGY_ANCHOR}`}
          className="shrink-0 text-xs text-emerald-100/90 hover:text-white hover:underline"
        >
          How we calculate this →
        </Link>
      </div>

      <div className="px-6 py-6">
        {scored ? (
          <ScoredBody vs={vs} state={state} hasPrecise={hasPrecise} confChip={confChip} />
        ) : (
          <NonScoredBody vs={vs} />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Scored: verdict line → breakeven gauge → base rate → passive-fee row →
// (paid) fee-vs-excess receipt → (free) unlock.
// ----------------------------------------------------------------------------
function ScoredBody({
  vs,
  state,
  hasPrecise,
  confChip,
}: {
  vs: ValueScore;
  state: BreakevenState | null;
  hasPrecise: boolean;
  confChip: string;
}) {
  const passive = vs.passive_alt_label;
  const verdict = verdictSentence(state, passive);
  const netStr =
    hasPrecise && vs.value_bps != null
      ? pctFromBps(vs.value_bps, { signed: true })
      : null;

  return (
    <div>
      {/* Hero takeaway — the NET figure leads (paid), or the breakeven verdict
          badge leads (free). The 0-100 is deliberately NOT the headline: both VOC
          personas warned a prominent grade rebuilds the star-rating "high = buy"
          reflex. The honest, thesis-aligned number is net value vs the passive
          alternative — so that is what the hero shows big. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold ${breakevenStateChip(state)}`}
        >
          {breakevenStateChipLabel(state)}
        </span>
        {passive && <span className="text-sm text-gray-500">vs {passive}</span>}
      </div>
      {netStr ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-4xl font-extrabold tabular-nums ${heroTone(state)}`}>
            {netStr}
          </span>
          <span className="text-base font-medium text-gray-400">/yr, net of fees</span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          The exact net figure is a paid detail — the free read is which side of
          breakeven the fund lands on.
        </p>
      )}
      <p className="mt-2 text-[15px] font-medium leading-relaxed text-gray-900">
        {verdict}
      </p>

      {/* Supporting gauge — where it sits vs breakeven (demoted below the takeaway). */}
      <div className="mt-5">
        <BreakevenGauge state={state} score100={hasPrecise ? vs.score100 : null} />
      </div>

      {/* Base rate — the honesty anchor (both VOC personas: the strongest trust line). */}
      <p className="mt-5 text-sm leading-relaxed text-gray-600">
        {state === "above"
          ? "Uncommon — only about 1 in 5 active funds clears breakeven (the typical fund lands below it)."
          : "Most active funds land here — only about 1 in 5 clear breakeven, net of fees."}{" "}
        <span className="text-gray-500">A backward-looking read, not a forecast.</span>
      </p>

      {/* Confidence flag — carries replica R² for the paid (pro) read. */}
      <p className="mt-2 text-xs text-gray-400">{confChip}</p>

      {/* Passive alternative — ALWAYS shown beside the verdict. Symmetric fee
          comparison (paid) uses the index's OWN real fee. */}
      <PassiveAltRow vs={vs} hasPrecise={hasPrecise} />

      {/* The fee-vs-excess receipt (paid) — auditable, on demand. */}
      {hasPrecise ? (
        <Ledger vs={vs} />
      ) : (
        <UnlockLine tier="paid">
          See the exact figure, the fee-vs-excess math, and the replica quality.
        </UnlockLine>
      )}

      <AsOf>
        Value Score {vs.method_version ?? ""} · backward-looking, relative to the
        passive alternative{vs.as_of_date ? ` · through ${fmtMonthYear(vs.as_of_date)}` : ""}.
      </AsOf>
    </div>
  );
}

// Restrained tone for the big net figure — a calm emerald for above-breakeven
// (NOT a triumphant green), neutral slate for ≈breakeven, muted amber for below.
// No state is colored to read as a "buy" / "sell" signal.
function heroTone(state: BreakevenState | null): string {
  if (state === "above") return "text-emerald-700";
  if (state === "below") return "text-amber-700";
  return "text-slate-700";
}

// A plain-English, past-tense verdict. No "genuine value", no "VERDICT", no
// present tense (VOC: those read as a buy signal / performance projection).
function verdictSentence(state: BreakevenState | null, passive: string | null): string {
  const alt = passive ? `its passive alternative (${passive})` : "its passive alternative";
  if (state === "above") return `This fund added value over ${alt}, net of fees.`;
  if (state === "below") return `This fund trailed ${alt}, net of fees.`;
  if (state === "near")
    return `This fund came out about even with ${alt}, net of fees — essentially the index.`;
  return `Measured against ${alt}, net of fees.`;
}

// ----------------------------------------------------------------------------
// Breakeven gauge — a 0-100 track with the breakeven line hard-marked at 50.
// Paid: the exact marker at score100. Free: the active zone highlighted (no
// fabricated precise position). The right pole is deliberately NOT "best value"
// (VOC: that rebuilds "higher = better fund"); calm marker, never a "go" arrow.
// ----------------------------------------------------------------------------
function BreakevenGauge({
  state,
  score100,
}: {
  state: BreakevenState | null;
  score100: number | null;
}) {
  const markerColor =
    state === "above" ? "bg-emerald-500" : state === "below" ? "bg-amber-500" : "bg-slate-400";
  const pos = score100 != null ? Math.max(0, Math.min(100, score100)) : null;

  // Free-tier zone band (qualitative; no exact position): below = 0-50,
  // above = 50-100, near = a band straddling breakeven.
  const zone =
    state === "below"
      ? { left: "0%", width: "50%" }
      : state === "above"
        ? { left: "50%", width: "50%" }
        : { left: "40%", width: "20%" };
  const zoneColor =
    state === "above" ? "bg-emerald-200/60" : state === "below" ? "bg-amber-200/60" : "bg-slate-300/50";

  return (
    <div>
      <div className="relative h-2 rounded-full bg-gray-200">
        {/* Free zone highlight (only when the exact marker is withheld). */}
        {pos == null && (
          <div
            className={`absolute top-0 h-2 rounded-full ${zoneColor}`}
            style={{ left: zone.left, width: zone.width }}
          />
        )}
        {/* Breakeven tick at 50. */}
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-gray-400"
          style={{ left: "50%" }}
        />
        {/* Exact marker (paid). */}
        {pos != null && (
          <div
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${pos}%` }}
          >
            <div className={`h-3.5 w-3.5 rounded-full border-2 border-white shadow ${markerColor}`} />
          </div>
        )}
      </div>
      {/* Pole + anchor labels. */}
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-gray-400">
        <span>the index wins</span>
        <span className="text-gray-500">breakeven</span>
        <span>added net value</span>
      </div>
      {pos != null && (
        <p className="mt-1 text-[11px] text-gray-400">
          Score <span className="font-semibold tabular-nums text-gray-600">{Math.round(pos)}</span>
          /100 · anchored so 50 = earns its fee (not a percentile).
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Passive alternative + symmetric fee comparison. The index's OWN fee is real
// (joined from expense history); when absent (e.g. SPY) we say "a low-cost index
// ETF" with no number — never fabricated.
// ----------------------------------------------------------------------------
function PassiveAltRow({ vs, hasPrecise }: { vs: ValueScore; hasPrecise: boolean }) {
  const passive = vs.passive_alt_label;
  if (!passive) return null;

  if (!hasPrecise) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        Passive alternative: <span className="font-semibold text-gray-900">{passive}</span>{" "}
        <span className="text-gray-400">· a low-cost index ETF</span>
      </p>
    );
  }

  const fundFee = vs.fee_bps;
  const idxFee = vs.passive_alt_fee_bps;
  return (
    <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Passive alternative
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium text-gray-900">
          {passive} <span className="font-normal text-gray-500">· index ETF</span>
        </span>
        <span className="text-sm tabular-nums text-gray-700">
          This fund <span className="font-semibold">{pctFromBps(fundFee)}</span>
          <span className="mx-2 text-gray-300">vs</span>
          index{" "}
          <span className="font-semibold">
            {idxFee != null ? pctFromBps(idxFee) : "low-cost"}
          </span>
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Fee-vs-excess receipt (paid). The verdict falls out of visible math:
// gross excess − fee = net. The gross leg is rendered as a NOISY (striped) bar,
// not a confident solid one (VOC: it's the ~98%-noise input); the fee leg — the
// one reliable number — is solid.
// ----------------------------------------------------------------------------
function Ledger({ vs }: { vs: ValueScore }) {
  const gross = vs.gross_alpha_bps;
  const fee = vs.fee_bps;
  const net = vs.value_bps;
  const years = vs.n_weeks != null ? Math.round(vs.n_weeks / 52) : null;
  const maxBps = Math.max(Math.abs(gross ?? 0), Math.abs(fee ?? 0), 1);
  const w = (bps: number | null) =>
    bps == null ? "0%" : `${Math.min(100, (Math.abs(bps) / maxBps) * 100)}%`;

  return (
    <details className="group mt-4">
      <summary className="cursor-pointer list-none text-sm font-medium text-[#1466b8]">
        <span className="group-open:hidden">▸ Show the math</span>
        <span className="hidden group-open:inline">▾ Hide the math</span>
      </summary>
      <div className="mt-3 space-y-2.5 rounded-lg border border-gray-100 bg-gray-50/70 px-4 py-3">
        <LedgerRow
          label="Estimated edge over its index, before fees (noise-shrunk)"
          value={pctFromBps(gross, { signed: true })}
          width={w(gross)}
          noisy
        />
        <LedgerRow label="The fund's fee" value={pctFromBps(fee == null ? null : -fee)} width={w(fee)} />
        <div className="border-t border-gray-200 pt-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-gray-900">
              = Net value over the index
            </span>
            <span className="text-sm font-bold tabular-nums text-gray-900">
              {pctFromBps(net, { signed: true })}/yr
            </span>
          </div>
        </div>
        <p className="pt-1 text-[11px] leading-relaxed text-gray-500">
          The edge is deliberately halved and risk-adjusted (half the information ratio ×
          recent tracking error); the fund&apos;s raw historical excess is roughly double it.
          Broad market &amp; style removed (single-β vs {vs.passive_alt_label ?? "the index"});
          concentrated theme bets are not — a growth fund&apos;s AI tilt can still show here.
          {years != null ? ` Based on ~${years} yrs of weekly returns` : " Based on the fund's return history"}
          {vs.as_of_date ? ` through ${fmtMonthYear(vs.as_of_date)}.` : "."}{" "}
          It&apos;s noisy; lean on the breakeven sign, not the exact magnitude.
        </p>
      </div>
    </details>
  );
}

function LedgerRow({
  label,
  value,
  width,
  noisy = false,
}: {
  label: string;
  value: string;
  width: string;
  noisy?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1/2 shrink-0 text-sm text-gray-700">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-gray-200">
        {/* The gross-excess leg is the ~98%-noise input, so it is rendered as a
            lighter, softer bar than the fee (the one reliable number) — never a
            confident solid block. Sign is carried by the value text, not color. */}
        <div
          className={`absolute left-0 top-0 h-2 rounded-full ${
            noisy ? "bg-slate-300" : "bg-slate-500"
          }`}
          style={{ width }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-gray-900">{value}</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Non-scored: the honest "we can't score this one, here's why" state. Both VOC
// personas: this INCREASES trust. Never a fabricated number; the passive
// alternative is still named where known.
// ----------------------------------------------------------------------------
function NonScoredBody({ vs }: { vs: ValueScore }) {
  return (
    <div>
      <p className="text-[15px] font-medium text-gray-900">
        {coverageStateLabel(vs.coverage_state)}
      </p>
      <div className="mt-3">
        <Unavailable>
          {coverageStateReason(vs.coverage_state, vs.passive_alt_label)}
          {vs.passive_alt_label && vs.coverage_state !== "not_comparable" && (
            <>
              {" "}
              Its passive alternative would be{" "}
              <span className="font-semibold text-gray-700">{vs.passive_alt_label}</span>.
            </>
          )}
        </Unavailable>
      </div>
      <AsOf>
        Value Score {vs.method_version ?? ""} · a fund is only scored when a low-cost
        passive alternative can fairly stand in for it.
      </AsOf>
    </div>
  );
}

// "2026-04-25" → "Apr 2026". Defensive against unexpected shapes.
function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
