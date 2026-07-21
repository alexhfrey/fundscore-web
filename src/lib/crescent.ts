// ============================================================================
// Crescent v2 — pure derivations. NO "use client", NO serving-layer imports.
// ----------------------------------------------------------------------------
// Every function here is a straight port of the semantics prototyped in the
// design source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
// (DETENT ~L518, drawMoon/drawMoonAnatomy ~L625-683, renderStrip/renderReceipt/
// renderHurdle ~L782-869, composeVerdict/orientOf ~L503-523). Input types are
// defined narrowly and locally — this module never imports `./serving/gating`
// or any DB-adjacent type, so it can be unit-tested (scripts/test/
// crescent-lib.ts) without a live Postgres client, mirroring the gating
// golden-test's db-free design.
//
// Where the mockup's illustrative dataset used a field name that differs from
// the REAL served shape (e.g. its standalone `direction`/`value_score_net_
// fee_bps` fields), this module uses the real serving field names instead
// (`difference`, `active_fee_over_passive_bps` — see FeeFairnessV2.tsx /
// ExposurePreview in gating.ts) while preserving the mockup's math exactly.
// Each such case is called out inline below.
// ============================================================================

// --- fill mark ---------------------------------------------------------------

/**
 * The Crescent's gold-fill fraction: 1 − replica R², clamped to [0,1].
 * Mirrors drawMoon's own `f=Math.max(0,Math.min(1,f))` clamp (mockup L642).
 * Null-safe: a missing/non-finite R² (unscored, or precision locked below the
 * paid tier) yields a missing fill, never a fabricated 0.
 */
export function fillFromR2(replicaR2: number | null | undefined): number | null {
  if (replicaR2 == null || !Number.isFinite(replicaR2)) return null;
  return Math.max(0, Math.min(1, 1 - replicaR2));
}

/**
 * The fill percentage as the mockup's own display string, e.g. "5.2".
 * Rounding order matters and is ported EXACTLY from fillPctStr (mockup L475):
 * round r2*100 to 1 decimal FIRST, then subtract from 100 and format — not the
 * naive `((1-r2)*100).toFixed(1)`, so this can never print a different digit
 * than the mockup's own r2-based chip/verdict copy for the same underlying
 * value. Every caller (mark aria-label, chip, verdict sentence, strip marker)
 * must go through this one function so they can never disagree with each
 * other. Clamped/null-guarded beyond the mockup (whose exemplar dataset is
 * always clean 0-1) because live replica_r2 can be null (locked/unscored).
 */
export function fillPctStr(replicaR2: number | null | undefined): string | null {
  if (replicaR2 == null || !Number.isFinite(replicaR2)) return null;
  const clamped = Math.max(0, Math.min(1, replicaR2));
  const r2Pct = Number((clamped * 100).toFixed(1));
  return (100 - r2Pct).toFixed(1);
}

// --- orientation (mockup L518-523) -------------------------------------------

/** Rotation detent (degrees) per dominant-tilt exposure_type — mockup L518. */
export const DETENT: Record<string, number> = {
  sector: 40,
  theme: 140,
  country_region: -140,
  style: -40,
};

/**
 * Crescent rotation for the dominant tilt row. The mockup keys its negation
 * off a `direction: "underweight" | "overweight"` string (orientOf, L519-523);
 * the real served dominant-tilt shape (ExposurePreview in gating.ts) carries a
 * signed `difference` instead, with underweight <=> difference < 0 — the same
 * fund's own tilt rows confirm this (e.g. a technology underweight serves
 * difference_pp < 0). So this negates on `difference < 0`, which is the
 * semantic equivalent for the real payload, not a behavior change.
 */
export function orientFromTilt(
  row: { exposure_type: string; difference: number | null } | null | undefined,
): number {
  if (!row) return 0;
  const base = DETENT[row.exposure_type] ?? 0;
  return row.difference != null && row.difference < 0 ? -base : base;
}

// --- anatomy hatch (mockup L918-920) -----------------------------------------

/**
 * The hatched (factor) share of the gold fill: fill × factor_share, where
 * factor_share = 1 − idio_risk_share (te_factor² + te_idio² = te² — the two
 * variance shares are complementary, mockup L929/L935-936: "combine in
 * quadrature and sum to 100% of active risk"). Ported from the mockup's
 * `fh = fill * fs` (L920) using the idio share the real risk-attribution
 * payload actually serves. Null-safe; clamped to [0, fill] since the hatch
 * can never exceed the gold area it sits inside (mockup only clamps to [0,1]
 * inside drawMoonAnatomy, L663 — this is a tighter, equivalent-in-practice
 * bound for a defined fill).
 */
export function anatomyHatch(fill: number | null, idioRiskShare: number | null): number | null {
  if (fill == null || !Number.isFinite(fill) || idioRiskShare == null || !Number.isFinite(idioRiskShare)) {
    return null;
  }
  const factorShare = 1 - idioRiskShare;
  const hatch = fill * factorShare;
  return Math.max(0, Math.min(fill, hatch));
}

// --- fill distribution strip (mockup bandData L524-533, renderStrip L782-817) -

/**
 * Published fill-band distribution — counts/shares computed once from the
 * spine's fill_band_crosstab (fund_score mockup L525-532, N=2708 EQ active
 * series with a returns-basis fill) and locked here as the served constant:
 * shares round to [17, 29, 29, 16, 9] (sums to 100). Ranges are half-open
 * [lo, hi) exactly as bandData's own `ranges` (L532), so a fill of exactly
 * 0.05 falls into the "5–10%" band, not "0–5%".
 */
export const FILL_BANDS: {
  names: string[];
  shares: number[];
  ranges: [number, number][];
} = {
  names: ["0–5%", "5–10%", "10–20%", "20–35%", "35%+"],
  shares: [17, 29, 29, 16, 9],
  ranges: [
    [0, 0.05],
    [0.05, 0.1],
    [0.1, 0.2],
    [0.2, 0.35],
    [0.35, 0.55],
  ],
};

/**
 * The marker's horizontal position (0-100%) along the fill strip: cumulative
 * share of every band before the fill's own band, plus a linear interpolation
 * of the within-band position — ported verbatim from renderStrip's marker
 * loop (mockup L803-808). A fill outside every published range (below 0, or
 * ≥ 0.55 — no fund in the published spine reaches that far, mockup L812-816
 * notes the observed max is ~24.9%) is a case the mockup's own loop leaves at
 * its unset initial 0 (`pos` never gets assigned — a latent gap in the
 * prototype, not a deliberate "put it at the origin" choice). Rendering an
 * extreme-fill fund at the far left would misrepresent it, so this clamps to
 * the nearer scale end (0 or 100) instead of silently reproducing that gap.
 */
export function stripMarkerPos(fill: number): number {
  let cumulative = 0;
  for (const [i, [lo, hi]] of FILL_BANDS.ranges.entries()) {
    if (fill >= lo && fill < hi) {
      return cumulative + ((fill - lo) / (hi - lo)) * FILL_BANDS.shares[i];
    }
    cumulative += FILL_BANDS.shares[i];
  }
  const lastHi = FILL_BANDS.ranges[FILL_BANDS.ranges.length - 1][1];
  return fill >= lastHi ? 100 : 0;
}

// --- fee receipt (mockup receiptModel L534-538, renderReceipt L818-840) ------

export interface ReceiptModel {
  passiveBps: number | null;
  surchargeBps: number | null;
  totalBps: number | null;
  passiveDollars: number | null;
  surchargeDollars: number | null;
  totalDollars: number | null;
  multiple: number | null;
  sumOK: boolean;
}

/**
 * The "twin's fee + active surcharge = your fee" receipt. Field names match
 * the REAL served fair-fee shape (fees.fair_fee.{passive_fee_bps,
 * active_fee_over_passive_bps}, fees.net_expense_ratio_bps — see
 * FeeFairnessV2.tsx), not the mockup's own standalone illustrative dataset
 * (which used `value_score_net_fee_bps`, a distinct quantity from
 * active_fee_over_passive_bps for at least one exemplar fund) — same
 * receipt math (mockup L534-538), real inputs.
 * $ per $10k = bps × $1 (an expense ratio of N bps costs $N per $10,000).
 * multiple = total/passive (null-safe when passive is null or zero).
 * sumOK = |passive + surcharge − total| ≤ 0.1 (both legs must be present).
 * Returns null only when there is no total to anchor the receipt at all;
 * a missing passive or surcharge leg still yields a valid model with that
 * leg's bps/dollar fields null and sumOK false (can't verify an incomplete sum).
 */
export function receiptModel(
  fees:
    | {
        net_expense_ratio_bps: number | null;
        fair_fee: { passive_fee_bps: number | null; active_fee_over_passive_bps: number | null } | null;
      }
    | null
    | undefined,
): ReceiptModel | null {
  if (fees == null || fees.net_expense_ratio_bps == null || !Number.isFinite(fees.net_expense_ratio_bps)) {
    return null;
  }
  const totalBps = fees.net_expense_ratio_bps;
  const passiveBps = fees.fair_fee?.passive_fee_bps ?? null;
  const surchargeBps = fees.fair_fee?.active_fee_over_passive_bps ?? null;
  const multiple = passiveBps != null && passiveBps !== 0 ? totalBps / passiveBps : null;
  const sumOK =
    passiveBps != null && surchargeBps != null && Math.abs(passiveBps + surchargeBps - totalBps) <= 0.1;
  return {
    passiveBps,
    surchargeBps,
    totalBps,
    passiveDollars: passiveBps,
    surchargeDollars: surchargeBps,
    totalDollars: totalBps,
    multiple,
    sumOK,
  };
}

// --- hurdle scale (mockup renderHurdle L844-845) -----------------------------

/**
 * The symmetric ±bps/yr axis scale for the hurdle chart: the smallest
 * multiple of 250 that covers the largest |diff_bps| across the rows, floored
 * at 250 — ported verbatim from renderHurdle (mockup L844-845). Rows with a
 * null diff_bps are skipped (no fabricated 0); an all-null/empty table falls
 * back to the 250 floor.
 */
export function hurdleScale(rows: { diff_bps: number | null }[]): number {
  const abs = rows
    .map((r) => r.diff_bps)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .map(Math.abs);
  const maxAbs = abs.length > 0 ? Math.max(...abs) : 0;
  return Math.max(250, Math.ceil(maxAbs / 250) * 250);
}

// --- verdict state -------------------------------------------------------

/**
 * Which Crescent verdict state to render. Not present in the standalone
 * mockup (its exemplar dataset has no tier-gating concept) — this is the
 * Crescent v2 gating-aware state machine, built directly on top of the
 * sub-task A contract: replica_r2 is public/free once coverage_state is
 * "scored", but can still be legitimately null (e.g. a load gap) — that state
 * gets its own label ("locked_precision") instead of silently collapsing into
 * "unscored", which would misrepresent a scored fund as not-yet-evaluated.
 */
export function verdictState(
  valueScore: { coverage_state?: string | null; replica_r2?: number | null } | null | undefined,
): "scored" | "unscored" | "locked_precision" {
  if (valueScore == null || valueScore.coverage_state !== "scored") return "unscored";
  return valueScore.replica_r2 != null ? "scored" : "locked_precision";
}
