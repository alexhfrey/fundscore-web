// ============================================================================
// crescent-lib test — contract check for src/lib/crescent.ts (Crescent v2 pure
// derivations).
// ----------------------------------------------------------------------------
// Run:  node --experimental-strip-types scripts/test/crescent-lib.ts
//
// Mirrors scripts/test/gating-golden.ts's pattern: a tiny check()/failures
// harness, no test framework dependency, imported with the explicit `.ts`
// extension (Node's type-stripping ESM loader does not add extensions;
// tsconfig sets allowImportingTsExtensions so tsc/eslint accept the same
// specifier). crescent.ts is pure/db-free, so this needs no DATABASE_URL.
//
// Where real numbers are available they are used verbatim from the fund_score
// mockup's embedded FCNTX/DODGX exemplar records (value_score.parquet,
// as-of 2026-07-11 — fund_score/docs/product/strategy/
// mockup_fund_profile_crescent.html), so the expected strings/values below
// are not invented test doubles.
// ============================================================================

import {
  anatomyHatch,
  DETENT,
  fillFromR2,
  fillPctStr,
  FILL_BANDS,
  hurdleScale,
  orientFromTilt,
  receiptModel,
  stripMarkerPos,
  verdictState,
} from "../../src/lib/crescent.ts";

let failures = 0;
function check(label: string, pass: boolean): void {
  if (pass) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

function approx(a: number | null, b: number, eps = 1e-9): boolean {
  return a != null && Math.abs(a - b) < eps;
}

// ============================================================================
// 1. fillFromR2 — 1 − r2, clamped [0,1], null-safe.
// ============================================================================
console.log("fillFromR2:");
check("fillFromR2(0.9479) ≈ 0.0521 (real FCNTX replica_r2)", approx(fillFromR2(0.9479), 0.0521, 1e-6));
check("fillFromR2(0) = 1 (no replication at all)", fillFromR2(0) === 1);
check("fillFromR2(1) = 0 (perfect replication)", fillFromR2(1) === 0);
check("fillFromR2(-0.2) clamps to 1 (out-of-range r2)", fillFromR2(-0.2) === 1);
check("fillFromR2(1.5) clamps to 0 (out-of-range r2)", fillFromR2(1.5) === 0);
check("fillFromR2(null) = null", fillFromR2(null) === null);
check("fillFromR2(undefined) = null", fillFromR2(undefined) === null);
check("fillFromR2(NaN) = null", fillFromR2(NaN) === null);

// ============================================================================
// 2. fillPctStr — mockup's exact rounding (round r2*100 to 1dp, THEN subtract
// from 100), so mark/chip/verdict/strip can never disagree with each other.
// Expected strings are the mockup's own real exemplar values.
// ============================================================================
console.log("fillPctStr:");
check("fillPctStr(0.9479) = '5.2' (FCNTX)", fillPctStr(0.9479) === "5.2");
check("fillPctStr(0.9465) = '5.3' (DODGX)", fillPctStr(0.9465) === "5.3");
check("fillPctStr(0.9233) = '7.7' (VPMCX)", fillPctStr(0.9233) === "7.7");
check("fillPctStr(null) = null", fillPctStr(null) === null);
check("fillPctStr(undefined) = null", fillPctStr(undefined) === null);

// ============================================================================
// 3. orientFromTilt — DETENT by exposure_type, negated on difference < 0,
// fallback 0 for unknown/missing.
// ============================================================================
console.log("orientFromTilt:");
check("DETENT map matches the mockup's published detents", JSON.stringify(DETENT) === JSON.stringify({
  sector: 40,
  theme: 140,
  country_region: -140,
  style: -40,
}));
check(
  "sector overweight -> +40",
  orientFromTilt({ exposure_type: "sector", difference: 5 }) === 40,
);
check(
  "sector underweight -> -40 (negated)",
  orientFromTilt({ exposure_type: "sector", difference: -5 }) === -40,
);
check(
  "theme overweight -> +140",
  orientFromTilt({ exposure_type: "theme", difference: 5 }) === 140,
);
check(
  "theme underweight -> -140 (negated)",
  orientFromTilt({ exposure_type: "theme", difference: -5 }) === -140,
);
check(
  "country_region overweight -> -140 (detent itself is negative)",
  orientFromTilt({ exposure_type: "country_region", difference: 5 }) === -140,
);
check(
  "country_region underweight -> +140 (negating a negative detent)",
  orientFromTilt({ exposure_type: "country_region", difference: -5 }) === 140,
);
check(
  "style overweight -> -40 (detent itself is negative)",
  orientFromTilt({ exposure_type: "style", difference: 5 }) === -40,
);
check(
  "style underweight -> +40 (negating a negative detent)",
  orientFromTilt({ exposure_type: "style", difference: -5 }) === 40,
);
check(
  "unknown exposure_type falls back to 0 regardless of sign",
  orientFromTilt({ exposure_type: "esg", difference: -5 }) === 0,
);
check("null row falls back to 0", orientFromTilt(null) === 0);
check("undefined row falls back to 0", orientFromTilt(undefined) === 0);
check(
  "difference === 0 is NOT negated (strictly < 0 required)",
  orientFromTilt({ exposure_type: "sector", difference: 0 }) === 40,
);
check(
  "difference === null is NOT negated",
  orientFromTilt({ exposure_type: "sector", difference: null }) === 40,
);

// ============================================================================
// 4. stripMarkerPos — cumulative band share + within-band linear interpolation.
// ============================================================================
console.log("stripMarkerPos:");
check("FILL_BANDS.shares sums to 100", FILL_BANDS.shares.reduce((a, b) => a + b, 0) === 100);
check("stripMarkerPos(0) = 0 (scale origin)", stripMarkerPos(0) === 0);
check(
  "stripMarkerPos(0.05) = 17 (band edge — half-open [.05,.10) owns it, not [0,.05))",
  stripMarkerPos(0.05) === 17,
);
check(
  "stripMarkerPos(0.35) = 91 (band edge — cumulative of the first four bands)",
  stripMarkerPos(0.35) === 91,
);
check(
  "stripMarkerPos(0.55) clamps to 100 (top of the published range, exclusive upper bound)",
  stripMarkerPos(0.55) === 100,
);
check(
  "stripMarkerPos(-0.01) clamps to 0 (below every range)",
  stripMarkerPos(-0.01) === 0,
);
const fcntxFill = fillFromR2(0.9479) as number;
check(
  "stripMarkerPos(FCNTX fill ≈ 0.0521) ≈ 18.2 (into the 5–10% band)",
  approx(stripMarkerPos(fcntxFill), 18.218, 1e-2),
);

// ============================================================================
// 5. receiptModel — passive + surcharge vs total, $ per $10k = bps × $1.
// ============================================================================
console.log("receiptModel:");
const happy = receiptModel({
  net_expense_ratio_bps: 74,
  fair_fee: { passive_fee_bps: 18, active_fee_over_passive_bps: 56 },
});
check(
  "happy path: legs sum exactly -> sumOK true",
  happy != null &&
    happy.passiveBps === 18 &&
    happy.surchargeBps === 56 &&
    happy.totalBps === 74 &&
    happy.passiveDollars === 18 &&
    happy.surchargeDollars === 56 &&
    happy.totalDollars === 74 &&
    happy.sumOK === true,
);
check(
  "happy path: multiple = total/passive",
  happy != null && approx(happy.multiple, 74 / 18),
);

// Real FCNTX numbers: active_fee_over_passive_bps (57.7322343094306) does NOT
// sum with passive_fee_bps (18) to net_expense_ratio_bps (74) within 0.1bps —
// a genuine sumOK=false case straight from the served fee pipeline, not a
// contrived one.
const sumMismatch = receiptModel({
  net_expense_ratio_bps: 74,
  fair_fee: { passive_fee_bps: 18, active_fee_over_passive_bps: 57.7322343094306 },
});
check(
  "sumOK=false when legs don't reconcile within 0.1bps (real FCNTX fee-pipeline mismatch)",
  sumMismatch != null && sumMismatch.sumOK === false,
);
check(
  "sumOK=false case still reports the individual legs (not nulled out)",
  sumMismatch != null && sumMismatch.passiveBps === 18 && approx(sumMismatch.surchargeBps, 57.7322343094306),
);

// Null legs: fair_fee itself absent — total still anchors a valid model.
const nullLegs = receiptModel({ net_expense_ratio_bps: 74, fair_fee: null });
check(
  "null fair_fee: passive/surcharge/multiple null, sumOK false, total still present",
  nullLegs != null &&
    nullLegs.passiveBps === null &&
    nullLegs.surchargeBps === null &&
    nullLegs.multiple === null &&
    nullLegs.sumOK === false &&
    nullLegs.totalBps === 74,
);
check("receiptModel(null) = null (no fees object at all)", receiptModel(null) === null);
check(
  "receiptModel with null net_expense_ratio_bps = null (no total to anchor the receipt)",
  receiptModel({ net_expense_ratio_bps: null, fair_fee: { passive_fee_bps: 18, active_fee_over_passive_bps: 56 } }) ===
    null,
);
check(
  "multiple is null-safe when passive_fee_bps is 0",
  receiptModel({ net_expense_ratio_bps: 74, fair_fee: { passive_fee_bps: 0, active_fee_over_passive_bps: 74 } })
    ?.multiple === null,
);

// ============================================================================
// 6. hurdleScale — max(250, ceil(maxAbs/250)*250). Real FCNTX (small, stays at
// the 250 floor) and real DODGX (large, needs a wider scale) hurdle tables.
// ============================================================================
console.log("hurdleScale:");
check(
  "small (real FCNTX hurdle_table, max |diff| ≈ 230 bps/yr) stays at the 250 floor",
  hurdleScale([
    { diff_bps: -72.83725613031145 },
    { diff_bps: 229.82081424284928 },
    { diff_bps: -25.865134881211116 },
    { diff_bps: -110.99103980980685 },
  ]) === 250,
);
check(
  "large (real DODGX hurdle_table, max |diff| ≈ 1176 bps/yr) scales up to 1250",
  hurdleScale([
    { diff_bps: -1176.3161632491092 },
    { diff_bps: -181.14394602536166 },
    { diff_bps: -79.16232288388336 },
    { diff_bps: 54.77209421894447 },
  ]) === 1250,
);
check("empty rows falls back to the 250 floor", hurdleScale([]) === 250);
check(
  "all-null diff_bps falls back to the 250 floor (no fabricated 0)",
  hurdleScale([{ diff_bps: null }, { diff_bps: null }]) === 250,
);

// ============================================================================
// 7. verdictState — scored / unscored / locked_precision.
// ============================================================================
console.log("verdictState:");
check(
  "scored: coverage_state='scored' AND replica_r2 present",
  verdictState({ coverage_state: "scored", replica_r2: 0.9479 }) === "scored",
);
check(
  "locked_precision: coverage_state='scored' but replica_r2 null",
  verdictState({ coverage_state: "scored", replica_r2: null }) === "locked_precision",
);
check(
  "unscored: coverage_state is not 'scored' (e.g. too_new)",
  verdictState({ coverage_state: "too_new", replica_r2: 0.9 }) === "unscored",
);
check("unscored: valueScore is null", verdictState(null) === "unscored");
check("unscored: valueScore is undefined", verdictState(undefined) === "unscored");

// ============================================================================
// 8. anatomyHatch — fill × (1 − idio_risk_share), null-safe, clamped [0, fill].
// ============================================================================
console.log("anatomyHatch:");
check(
  "fill × (1 − idio_risk_share) — factor share of the fill",
  approx(anatomyHatch(0.2, 0.4), 0.12),
);
check("null-safe on fill", anatomyHatch(null, 0.4) === null);
check("null-safe on idioRiskShare", anatomyHatch(0.2, null) === null);
check(
  "clamped to fill even if idio_risk_share is negative (out-of-range input)",
  anatomyHatch(0.2, -1) === 0.2,
);
check(
  "clamped to 0 if idio_risk_share exceeds 1 (out-of-range input)",
  anatomyHatch(0.2, 2) === 0,
);

// ============================================================================
if (failures > 0) {
  console.error(`\ncrescent-lib: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\ncrescent-lib: all assertions passed");
