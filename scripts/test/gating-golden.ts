// ============================================================================
// Gating golden test — deep-walk contract check for applyGates.
// ----------------------------------------------------------------------------
// Proves the server-side tier gate strips every paid scalar before a payload
// could ship to an anon client, and that the retired legacy Value Offering keys
// are gone at the source (a regression tripwire against reintroduction).
//
// Run:  node --experimental-strip-types scripts/test/gating-golden.ts
//
// Imports applyGates from ./gating (db-free) so there is NO live Postgres client
// and NO DATABASE_URL in the import graph — the test needs no DB. `gating.ts` is
// imported with its explicit `.ts` extension because Node's type-stripping ESM
// loader does not add extensions (tsconfig sets allowImportingTsExtensions so
// tsc/eslint accept the same specifier).
//
// The FactRow fixture is derived from the FCNTX served-facts capture
// (feature-pipeline/captures/fund_profile__FCNTX/served_facts.json), mapped to
// the Drizzle camelCase TOP-LEVEL column names with nested JSONB keys left in
// snake_case (exactly how applyGates reads them). The retired legacy keys
// (value_offering_score / value_offering_label / value_offering / fee_gap_bps)
// are intentionally absent — the test proves they are gone, not present.
// ============================================================================

import {
  applyGates,
  effectiveHoldingsTier,
  gateHoldingsFull,
  hasHoldingsFullList,
  holdingsFullEntitled,
  isLocked,
  type FactRow,
} from "../../src/lib/serving/gating.ts";

// --- FCNTX fixture (post-drop payload shape) --------------------------------
// Gates carried VERBATIM from the capture: applyGates defaults a missing gate to
// "public", so an omitted map would make the paid section-lock assertions pass
// for the wrong reason. FCNTX: return_attribution=paid, alternatives=paid,
// value_offering_reframed=public, manager_parent=free, risk_attribution=free.
const FCNTX_ROW = {
  seriesId: "S000006037",
  canonicalTicker: "FCNTX",
  profileBuildVersion: "test-fixture",
  fundName: "Fidelity Contrafund",
  valueOfferingStatus: "available",
  dataCompletenessState: "full",
  gates: {
    fees: "public",
    holdings: "public",
    identity: "public",
    the_take: "public",
    takeaways: "public",
    performance: "public",
    alternatives: "paid",
    exposure_xray: "free",
    risk_behavior: "free",
    manager_parent: "free",
    passive_baseline: "public",
    risk_attribution: "free",
    source_inventory: "public",
    return_attribution: "paid",
    positioning_changes: "free",
    value_offering_reframed: "public",
    nav_series: "public",
    te_decomposition: "paid",
  },
  identity: {
    ticker: "FCNTX",
    fund_name: "Fidelity Contrafund",
    management_style: "active",
  },
  // Reframed BADGE hero: badge/bet_tag are public, value_index (30) is paid.
  valueOfferingReframed: {
    badge: "Selection unproven",
    bet_tag: "underweight technology",
    status: "scored",
    skill_band: "unproven",
    value_index: 30, // PAID scalar — must not survive anon
    method_version: "value_offering_reframed_v0.3",
  },
  // manager_parent gate=free; the manager-moves annualized bps is paid.
  managerParent: {
    skill_evidence: {
      label: "limited",
      p_skill: 0.041779112541398274,
      alpha_ir: -0.12411758042242126,
      t_years: 17.384615384615383,
      manager_moves: {
        label: "Mixed",
        status: "available",
        impact_bps_per_year: 9.395552395486646, // PAID scalar — must not survive anon
        impact_bps_se: 91.1554663430797,
        method_version: "manager_moves_v1",
      },
    },
  },
  // return_attribution gate=paid — whole section must lock for anon.
  returnAttribution: {
    rows: [
      {
        period: "1Y",
        dimension: "stock",
        member_id: "UNH",
        member_label: "UNITEDHEALTH GROUP INC",
        rank_direction: "negative",
        contribution_to_active_return_bps: -123.44825441757371,
        period_start_date: "2024-10-31",
        period_end_date: "2025-10-31",
      },
    ],
    method_version: "return_attr_v0.1",
  },
  // risk_attribution gate=free (section locks for anon); its
  // active_return_attribution sub-panel carries its own paid gate.
  riskAttribution: {
    factor_betas: {
      themes: [
        {
          target_id: "theme::dividend_aristocrats",
          target_kind: "theme",
          beta_active_headline: 0.11645316830678554,
          active_baseline: "l2_blend",
          beta_active_l2: 0.11645316830678554,
          beta_active_mkt: -0.2678388007015299,
          beta_active_tstat: -5.7737002689667865,
          confidence_state: "high",
        },
      ],
      styles: [],
      eval_date: "2025-09-30",
    },
    exposure_divergence: null,
    active_return_attribution: {
      gate: "paid",
      factor_contributions: [
        {
          factor_id: "sector::communication_services",
          factor_type: "sector",
          bias_bps: 363.83972081073847, // PAID attribution number
          timing_bps: 107.80319017354978,
          total_contribution_bps: 471.6429109842882,
          n_quarters: 19,
        },
      ],
      idio: {
        idio_contribution_bps: -298.11487106987335,
        realised_active_bps: 93.39687756909255,
        reconciliation_gap_bps: 165.36270858105516, // PAID attribution number
        n_quarters: 19,
      },
      window_start: "2020-12-31",
      window_end: "2025-09-30",
      method_version: "active_return_attr_v1",
    },
    copy_charter: {},
  },
  // alternatives gate=paid — whole section must lock for anon.
  alternatives: {
    rows: [
      {
        ticker: "FCNKX",
        name: "Class K",
        alternative_type: "cheaper_share_class",
        expense_ratio_bps: 32,
        annual_dollar_savings_10k: 7,
        wrapper_alternative: "mutual_fund",
      },
    ],
    eval_date: "2025-09-30",
    method_version: "alternatives_v1",
  },
  // nav_series gate=public (the fund-only growth chart is free), but the
  // vs-passive legs + full period table are paid: applyGates nulls the passive /
  // beta-adjusted point legs + the β, and collapses the period table to ONE free
  // proof-point row (beta-adjusted diff still nulled). Values here exercise the
  // strip mechanics — this is a gating test, not a served-data check.
  navSeries: {
    passive_label: "IWF",
    series_start: "2008-05",
    as_of: "2026-05",
    beta: 0.90444, // PAID scalar — must not survive anon
    points: [
      { t: "2008-05", fund: 1000.0, passive: 1000.0, beta_adj_passive: 1000.0 },
      { t: "2026-05", fund: 3421.0, passive: 4102.5, beta_adj_passive: 3550.1 },
    ],
    period_table: [
      { period: "1Y", fund_ann_pct: 10.2, passive_ann_pct: 12.5, diff_bps: -230, beta_adj_diff_bps: -180 },
      { period: "3Y", fund_ann_pct: 8.1, passive_ann_pct: 9.5, diff_bps: -140, beta_adj_diff_bps: -90 },
      { period: "SI", fund_ann_pct: 7.0, passive_ann_pct: 8.1, diff_bps: -111, beta_adj_diff_bps: 14 },
    ],
    method_version: "profile_nav_series_v1",
  },
  // risk_behavior gate=free — the 3Y risk-detail expander's payload. Whole
  // section must lock for anon and open for free (no field-level strip).
  riskBehavior: {
    std_dev_3y: 0.1455,
    sharpe_3y: 1.4419,
    sortino_3y: 1.8636,
    alpha_3y: null,
    beta_3y: null,
    r_squared_3y: null,
    tracking_error: null,
    information_ratio: null,
    upside_capture: null,
    downside_capture: null,
    max_drawdown: -0.4921,
    max_drawdown_date: "2009-03-09",
    benchmark_relative_to: "S&P 500",
  },
  // te_decomposition gate=paid — the full per-bet table is paid; the free proof
  // point is the grouped sleeve rollup + the single TOP bet. Below the gate the
  // 11 other bets (here: "Technology", "Consumer Cyclical") must be stripped, and
  // the negative diversifying te_alloc must never be clamped (positive control on
  // the paid side). Populated fixture so the new assertions hit real values.
  teDecomposition: {
    as_of: "2026-05-09",
    n_obs: 155,
    n_bets: 3,
    bets: [
      {
        label: "Financial Services",
        bet_type: "sector",
        factor_id: "sector::financial_services",
        beta: 0.1626,
        beta_tstat: 2.7884,
        var_share: 0.2637,
        te_alloc_bps: 91.96, // TOP bet — surfaces in the free proof point
        diversifying: false,
        confidence_state: "high",
      },
      {
        label: "Technology",
        bet_type: "sector",
        factor_id: "sector::technology",
        beta: -0.233,
        beta_tstat: -4.799,
        var_share: 0.0091,
        te_alloc_bps: 3.16, // must NOT ship below the paid gate
        diversifying: false,
        confidence_state: "high",
      },
      {
        label: "Consumer Cyclical",
        bet_type: "sector",
        factor_id: "sector::consumer_cyclical",
        beta: -0.0646,
        beta_tstat: -1.6869,
        var_share: -0.0723,
        te_alloc_bps: -25.2, // diversifying: negative, NEVER clamped
        diversifying: true,
        confidence_state: "medium",
      },
    ],
    rollup: [
      {
        n_bets: 3,
        bet_type: "sector",
        var_share: 0.9863,
        te_alloc_bps: 343.98,
        share_of_te_var: 0.5194,
        confidence_state: null,
      },
      {
        n_bets: null,
        bet_type: "selection",
        var_share: null,
        te_alloc_bps: 330.67,
        share_of_te_var: 0.4734,
        confidence_state: "high",
      },
    ],
    basis_note:
      "bets measured on the beta-adjusted weekly active return vs the L2 passive blend",
    basis_source: "standardized_risk_model_factor_exposure",
    te_total_bps: 480.58,
    factor_sleeve_te_bps: 348.74,
    selection_te_bps: 330.67,
    idio_risk_share: 0.4734,
    passive_alt_label: "IWF",
    window_start: "2023-05-12",
    window_end: "2026-04-24",
    no_named_bets: false,
    method_version: "te_decomp_v0.1",
  },
  sourceInventory: { source_stamps: [] },
} as unknown as FactRow;

// --- deep-walk helpers ------------------------------------------------------
function walk(node: unknown, visit: (key: string, value: unknown) => void): void {
  if (Array.isArray(node)) {
    for (const el of node) walk(el, visit);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      visit(k, v);
      walk(v, visit);
    }
  }
}

/** All values found under `key` at any depth. */
function collectKey(node: unknown, key: string): unknown[] {
  const found: unknown[] = [];
  walk(node, (k, v) => {
    if (k === key) found.push(v);
  });
  return found;
}

/** Does any value under `key` at any depth hold a finite number? */
function hasLiveNumber(node: unknown, key: string): boolean {
  return collectKey(node, key).some((v) => typeof v === "number" && isFinite(v));
}

/** Does `key` appear at any depth at all? */
function hasKey(node: unknown, key: string): boolean {
  return collectKey(node, key).length > 0;
}

// --- assertion harness ------------------------------------------------------
let failures = 0;
function check(label: string, pass: boolean): void {
  if (pass) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

const LEGACY_KEYS = [
  "value_offering_score",
  "value_offering_label",
  "value_offering",
  "fee_gap_bps",
];

// ============================================================================
// 1. Anonymous payload — nothing paid survives, nothing legacy exists.
// ============================================================================
const anon = applyGates(FCNTX_ROW, "anonymous");
console.log("anonymous payload:");

// Retired legacy keys must be gone at every depth (regression tripwire).
for (const k of LEGACY_KEYS) {
  check(`no legacy key "${k}" anywhere in anon payload`, !hasKey(anon, k));
}

// Paid reframed value_index must be nulled in-place (its section is public).
check(
  "value_index is null everywhere in anon payload",
  !hasLiveNumber(anon, "value_index"),
);

// Manager-moves annualized bps must not survive.
check(
  "impact_bps_per_year does not survive in anon payload",
  !hasLiveNumber(anon, "impact_bps_per_year"),
);

// Paid attribution numbers (inside the paid active_return_attribution sub-panel,
// itself inside the free-gated risk_attribution) must not survive.
check("bias_bps does not survive in anon payload", !hasLiveNumber(anon, "bias_bps"));
check(
  "reconciliation_gap_bps does not survive in anon payload",
  !hasLiveNumber(anon, "reconciliation_gap_bps"),
);

// Every section gated paid/free above the anon tier is a {locked} marker.
check("return_attribution (paid) is {locked} for anon", isLocked(anon.returnAttribution));
check("alternatives (paid) is {locked} for anon", isLocked(anon.alternatives));
check("risk_attribution (free) is {locked} for anon", isLocked(anon.riskAttribution));
check("manager_parent (free) is {locked} for anon", isLocked(anon.managerParent));
// risk_behavior (free): the 3Y risk detail must lock for anon — its Sharpe /
// volatility numbers never ship below the free gate.
check("risk_behavior (free) is {locked} for anon", isLocked(anon.riskBehavior));
check(
  "risk_behavior sharpe_3y does not survive in anon payload",
  !hasLiveNumber(anon.riskBehavior, "sharpe_3y"),
);

// te_decomposition (paid): the full per-bet table is stripped to a {locked}
// marker carrying ONLY the free proof point (grouped sleeve rollup + the single
// top bet). The 11 other bets never ship below the gate.
check("te_decomposition (paid) is {locked} for anon", isLocked(anon.teDecomposition));
const anonTe = anon.teDecomposition as {
  preview?: { rollup?: unknown[]; top_bet?: { label?: string } | null } | null;
} | null;
check(
  "te proof point exposes the grouped sleeve rollup for anon",
  Array.isArray(anonTe?.preview?.rollup) && (anonTe!.preview!.rollup!.length ?? 0) === 2,
);
check(
  "te proof point exposes the single top bet (Financial Services) for anon",
  anonTe?.preview?.top_bet?.label === "Financial Services",
);
check(
  "te full per-bet array does NOT ship below the gate for anon",
  !hasKey(anon.teDecomposition, "bets"),
);
check(
  "non-top te bet 'Technology' stripped for anon",
  !JSON.stringify(anon.teDecomposition).includes("Technology"),
);
check(
  "diversifying te bet 'Consumer Cyclical' stripped for anon",
  !JSON.stringify(anon.teDecomposition).includes("Consumer Cyclical"),
);

// te_decomposition FAIL-CLOSED default: a row whose gates JSONB is MISSING the
// te_decomposition key (load drift) must still gate the populated section as
// paid — data never outruns its gate. Positive control: the same missing-key
// row still unlocks for paid.
{
  const gatesSansTe = { ...(FCNTX_ROW.gates as Record<string, unknown>) };
  delete gatesSansTe.te_decomposition;
  const rowSansTeGate = { ...FCNTX_ROW, gates: gatesSansTe } as typeof FCNTX_ROW;
  const anonNoGate = applyGates(rowSansTeGate, "anonymous");
  check(
    "te_decomposition with MISSING gate key fails CLOSED for anon (default paid)",
    isLocked(anonNoGate.teDecomposition) && !hasKey(anonNoGate.teDecomposition, "bets"),
  );
  const paidNoGate = applyGates(rowSansTeGate, "paid");
  check(
    "te_decomposition with MISSING gate key still unlocks for paid",
    !isLocked(paidNoGate.teDecomposition) && hasKey(paidNoGate.teDecomposition, "bets"),
  );
}

// The public reframed badge itself still ships (badge/bet_tag are public).
const anonVr = anon.valueOfferingReframed as { badge?: string } | null;
check("public reframed badge still present for anon", anonVr?.badge === "Selection unproven");

// nav_series: the fund-only growth chart is public (section NOT locked, fund line
// survives), but the vs-passive comparison is paid — passive/beta-adjusted point
// legs + β must be nulled, and the period table collapsed to ONE free proof-point
// row (its beta-adjusted diff also nulled). passive_label stays to name the proof.
const anonNav = anon.navSeries as {
  passive_label?: string;
  beta?: number | null;
  period_table?: { period: string; diff_bps: number | null; beta_adj_diff_bps: number | null }[];
} | null;
check("nav_series (public) NOT locked for anon", !isLocked(anon.navSeries));
check("nav_series fund line survives for anon", hasLiveNumber(anon.navSeries, "fund"));
check("nav_series passive leg nulled for anon", !hasLiveNumber(anon.navSeries, "passive"));
check(
  "nav_series beta_adj_passive leg nulled for anon",
  !hasLiveNumber(anon.navSeries, "beta_adj_passive"),
);
check("nav_series β nulled for anon", !hasLiveNumber(anon.navSeries, "beta"));
check("nav_series passive_label kept for anon", anonNav?.passive_label === "IWF");
check(
  "nav_series period table collapsed to one proof-point row for anon",
  (anonNav?.period_table?.length ?? 0) === 1,
);
check(
  "nav_series proof-point keeps diff_bps for anon",
  hasLiveNumber(anon.navSeries, "diff_bps"),
);
check(
  "nav_series beta_adj_diff_bps nulled even on proof-point for anon",
  !hasLiveNumber(anon.navSeries, "beta_adj_diff_bps"),
);

// ============================================================================
// 2. Paid payload — positive control: gating opens at the right tier.
// ============================================================================
const paid = applyGates(FCNTX_ROW, "paid");
console.log("paid payload:");

const paidVr = paid.valueOfferingReframed as { value_index?: number | null } | null;
check("value_index present (30) for paid", paidVr?.value_index === 30);

check(
  "impact_bps_per_year present for paid",
  hasLiveNumber(paid.managerParent, "impact_bps_per_year"),
);

check("return_attribution unlocked for paid", !isLocked(paid.returnAttribution));
check("alternatives unlocked for paid", !isLocked(paid.alternatives));

// risk_behavior (free): opens at the free tier — positive control for the 3Y
// risk-detail expander (and null relative fields stay null, never defaulted).
const freeRow = applyGates(FCNTX_ROW, "free");
check("risk_behavior unlocked for free", !isLocked(freeRow.riskBehavior));
check(
  "risk_behavior sharpe_3y present for free (positive control)",
  hasLiveNumber(freeRow.riskBehavior, "sharpe_3y"),
);
check(
  "risk_behavior null relative fields stay null for free (never defaulted)",
  (freeRow.riskBehavior as { beta_3y?: number | null })?.beta_3y === null,
);

// te_decomposition: the paid tier holds the full per-bet table, and the negative
// diversifying te_alloc survives UNCLAMPED (data-integrity: never floor to zero).
check("te_decomposition unlocked for paid", !isLocked(paid.teDecomposition));
const paidTe = paid.teDecomposition as { bets?: unknown[] } | null;
check("te full per-bet table present for paid (positive control)", (paidTe?.bets?.length ?? 0) === 3);
check(
  "te diversifying negative te_alloc survives unclamped for paid",
  JSON.stringify(paid.teDecomposition).includes("-25.2"),
);

const paidRa = paid.riskAttribution;
check(
  "active_return_attribution unlocked for paid",
  paidRa != null &&
    !isLocked(paidRa) &&
    !isLocked((paidRa as { active_return_attribution?: unknown }).active_return_attribution),
);
check("bias_bps present for paid (positive control)", hasLiveNumber(paid, "bias_bps"));

// nav_series: the paid tier sees the full vs-passive comparison.
const paidNav = paid.navSeries as { period_table?: unknown[] } | null;
check("nav_series passive leg present for paid", hasLiveNumber(paid.navSeries, "passive"));
check("nav_series β present for paid", hasLiveNumber(paid.navSeries, "beta"));
check("nav_series full period table present for paid", (paidNav?.period_table?.length ?? 0) === 3);
check(
  "nav_series beta_adj_diff_bps present for paid (positive control)",
  hasLiveNumber(paid.navSeries, "beta_adj_diff_bps"),
);

// Even the full paid payload carries no retired legacy key (schema is clean).
for (const k of LEGACY_KEYS) {
  check(`no legacy key "${k}" anywhere in paid payload`, !hasKey(paid, k));
}

// ============================================================================
// 2b. Malformed section gate FAILS CLOSED — an unknown/typo'd gates.<section>
// value must strip the section for EVERY tier (never rank as public). Live
// gates carry only public/free/paid (verified 2026-07-10); this is the
// applyGates sibling of the holdings_full fail-closed rule.
// ============================================================================
const MALFORMED_ROW = {
  ...FCNTX_ROW,
  gates: { ...FCNTX_ROW.gates, alternatives: "platinum-typo" },
};
const malformedAnon = applyGates(MALFORMED_ROW, "anonymous");
check(
  "malformed section gate: alternatives locked for anonymous",
  isLocked(malformedAnon.alternatives),
);
const malformedPro = applyGates(MALFORMED_ROW, "pro");
check(
  "malformed section gate: alternatives locked even for pro (fail closed, not fail public)",
  isLocked(malformedPro.alternatives),
);
const malformedPaid = applyGates(MALFORMED_ROW, "paid");
check(
  "malformed gate does not disturb sibling sections (paid still opens return_attribution)",
  malformedPaid.returnAttribution != null && !isLocked(malformedPaid.returnAttribution),
);
// HARD lock: a malformed gate must not even emit the preview proof point —
// there is no valid tier policy to preview against (codex P2 on this diff).
check(
  "malformed gate is a hard lock: no preview emitted (anonymous)",
  isLocked(malformedAnon.alternatives) &&
    !("preview" in (malformedAnon.alternatives as Record<string, unknown>)),
);
// Prototype-key gate values must NOT resolve via inherited Object properties
// ("toString" would rank as a function → NaN comparison → fail OPEN). Codex P2.
const PROTO_ROW = {
  ...FCNTX_ROW,
  gates: { ...FCNTX_ROW.gates, alternatives: "toString" },
};
check(
  "prototype-key gate value ('toString') fails closed even for pro",
  isLocked(applyGates(PROTO_ROW, "pro").alternatives),
);
check(
  "prototype-key holdings_full gate: no served list, zero rows for pro",
  !hasHoldingsFullList({ holdings_full: "toString" }) &&
    gateHoldingsFull({ holdings_full: "toString" }, "pro", [{ name: "X" }]).length === 0,
);
check(
  "prototype-key preview override ('constructor') is ignored outside production",
  effectiveHoldingsTier("anonymous", "constructor") === "anonymous",
);

// ============================================================================
// 3. Full-holdings gate (serve-full-holdings) — pure, generic, db-free.
// ----------------------------------------------------------------------------
// The filed rows load lazily on the drawer's fetch path; gateHoldingsFull is the
// single server-side gate there. paid/pro get the rows; anon/free get ZERO; a
// fund with no served list (gate key absent) gets ZERO for everyone AND is not
// entitled (so no teaser is shown — never tease rows that don't exist).
// ============================================================================
console.log("holdings_full gate:");

const SAMPLE_HOLDINGS = [
  { position_id: 1, name: "META PLATFORMS INC", ticker: "META", weight_pct: 10.2875 },
  { position_id: 2, name: "SPACE EXPLORATION TECHNOLOGIES CORP", ticker: null, weight_pct: 1.8628 },
];
const PAID_LIST_GATES = { holdings_full: "paid" };
const NO_LIST_GATES: Record<string, string> = {}; // fund without a served list

check(
  "paid sees the full list (holdings_full=paid)",
  gateHoldingsFull(PAID_LIST_GATES, "paid", SAMPLE_HOLDINGS).length === SAMPLE_HOLDINGS.length,
);
check(
  "pro sees the full list (holdings_full=paid)",
  gateHoldingsFull(PAID_LIST_GATES, "pro", SAMPLE_HOLDINGS).length === SAMPLE_HOLDINGS.length,
);
check(
  "free sees ZERO holdings rows (below paid)",
  gateHoldingsFull(PAID_LIST_GATES, "free", SAMPLE_HOLDINGS).length === 0,
);
check(
  "anonymous sees ZERO holdings rows (below paid)",
  gateHoldingsFull(PAID_LIST_GATES, "anonymous", SAMPLE_HOLDINGS).length === 0,
);
check(
  "fund without a served list yields ZERO rows even for pro",
  gateHoldingsFull(NO_LIST_GATES, "pro", SAMPLE_HOLDINGS).length === 0,
);
check(
  "fund without a served list is not entitled — no teaser (paid)",
  !holdingsFullEntitled(NO_LIST_GATES, "paid"),
);
check(
  "entitled true for paid on a served list",
  holdingsFullEntitled(PAID_LIST_GATES, "paid"),
);
check(
  "entitled false for free on a served list",
  !holdingsFullEntitled(PAID_LIST_GATES, "free"),
);

// hasHoldingsFullList — the ONE source of truth for "this fund has a served
// list" (the teaser + the row gate both key off it, never off holdings JSON).
check("hasHoldingsFullList true when gate present", hasHoldingsFullList(PAID_LIST_GATES));
check("hasHoldingsFullList false when gate absent", !hasHoldingsFullList(NO_LIST_GATES));

// Malformed gate values FAIL CLOSED everywhere: this is the only gate on a
// public server-action path, so a loader typo / future tier must never widen
// access — and must not tease a list nobody can fetch (coherence under bad data).
const MALFORMED_GATES = { holdings_full: "platinum-typo" };
check("malformed gate: no served list", !hasHoldingsFullList(MALFORMED_GATES));
check(
  "malformed gate: anonymous gets zero rows",
  gateHoldingsFull(MALFORMED_GATES, "anonymous", SAMPLE_HOLDINGS).length === 0,
);
check(
  "malformed gate: even pro gets zero rows (fail closed, not fail public)",
  gateHoldingsFull(MALFORMED_GATES, "pro", SAMPLE_HOLDINGS).length === 0,
);

// effectiveHoldingsTier — a forged / replayed server-action POST cannot elevate
// the tier: in PRODUCTION the reviewer override is IGNORED (the real session tier
// wins), so a below-paid session that supplies "paid" stays below paid and gets
// ZERO rows downstream. The reviewer override is honored only outside production.
console.log("holdings_full action tier resolution:");
// NODE_ENV is typed read-only under Next's env augmentation; mutate via a plain
// string-map view so we can exercise both the production and non-production paths.
const envView = process.env as Record<string, string | undefined>;
const savedNodeEnv = envView.NODE_ENV;
try {
  envView.NODE_ENV = "production";
  check(
    "production IGNORES a forged 'paid' override (anon stays anon)",
    effectiveHoldingsTier("anonymous", "paid") === "anonymous",
  );
  check(
    "production: forged 'paid' override yields ZERO rows downstream",
    gateHoldingsFull(
      PAID_LIST_GATES,
      effectiveHoldingsTier("anonymous", "paid"),
      SAMPLE_HOLDINGS,
    ).length === 0,
  );
  check(
    "production: a real paid session still gets rows",
    gateHoldingsFull(
      PAID_LIST_GATES,
      effectiveHoldingsTier("paid", undefined),
      SAMPLE_HOLDINGS,
    ).length === SAMPLE_HOLDINGS.length,
  );
  envView.NODE_ENV = "development";
  check(
    "outside production: reviewer override IS honored (anon → paid)",
    effectiveHoldingsTier("anonymous", "paid") === "paid",
  );
  check(
    "outside production: a bogus override value is ignored",
    effectiveHoldingsTier("free", "superadmin") === "free",
  );
} finally {
  envView.NODE_ENV = savedNodeEnv;
}

// ============================================================================
if (failures > 0) {
  console.error(`\ngating-golden: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\ngating-golden: all assertions passed");
