// ============================================================================
// Screener select golden test — the /screener tier-safety + scored-predicate
// tripwire.
// ----------------------------------------------------------------------------
// Run:  node --experimental-strip-types scripts/test/screener-select-golden.ts
//
// DB-FREE BY CONSTRUCTION. It imports only `src/lib/serving/screener-select.ts`,
// which imports the Drizzle SCHEMA MIRROR and `sql` — never `src/lib/db`, which
// eagerly constructs a `postgres()` client off `process.env.DATABASE_URL!` at
// module scope. That split (mirroring gating.ts vs profile.ts) is the whole
// point: a tier-safety check that cannot run without a live database is not a
// check. This file must pass with DATABASE_URL unset:
//
//     env -u DATABASE_URL node --experimental-strip-types scripts/test/screener-select-golden.ts
//
// WHAT IT GUARDS, and why each guard is non-vacuous:
//
//   1. SELECT WHITELIST. `/screener` is a LIST read and never goes through
//      applyGates, so its tier safety is "never fetch", not "strip later". Set
//      equality in BOTH directions means an added key, a renamed key, or a
//      silently-dropped key all fail. Non-vacuity: the assertion is over a
//      non-empty key set, and temporarily adding one forbidden key to
//      SCREENER_SELECT makes it FAIL (demonstrated in the PR).
//
//   2. FORBIDDEN KEYS. Disjointness against a list that is asserted NON-EMPTY —
//      an empty forbidden list would make disjointness vacuously true.
//
//   3. VERDICT SQL. The three verdict projections must reference ONLY
//      breakeven_state / confidence / passive_alt_label out of `value_score`,
//      and each must be gated on `value_coverage_state = 'scored'`. Rendered
//      through PgDialect (schema-only, no connection) so the assertion reads the
//      REAL emitted SQL rather than this file's idea of it.
//
//   4. THE SCORED PREDICATE (spec ADDENDUM 1 / acceptance criterion 9). The
//      population that gets a verdict is `value_coverage_state = 'scored'` and
//      nothing else. This is the regression that would otherwise surface a
//      fee-vs-passive verdict for 1,329 funds the product deliberately declines
//      to judge. Non-vacuity is SEEDED, not assumed: the fixture carries a row
//      in a non-scored state that has BOTH a non-null `value_score` object AND a
//      non-null `passive_alt_label`, and the test proves (a) `isScored` rejects
//      it while (b) each naive predicate ACCEPTS it — i.e. the trap is live and
//      a wrong predicate really would fall in.
// ============================================================================

import { PgDialect } from "drizzle-orm/pg-core";
import {
  SCORED_STATE,
  SCREENER_FORBIDDEN_KEYS,
  SCREENER_SELECT,
  SCREENER_SELECT_KEYS,
  SCREENER_VERDICT_FIELDS,
  SORT_KEYS,
  VERDICT_KEYS,
  isScored,
  normalizeParams,
  showsPassiveAltCaption,
} from "../../src/lib/serving/screener-select.ts";

// --- assertion harness (same shape as gating-golden.ts) ---------------------
let failures = 0;
function check(label: string, pass: boolean): void {
  if (pass) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

// A live Postgres client in the import graph would have thrown by now (or would
// hold an open socket). Assert the negative explicitly so "the test ran" and
// "the test ran without a database" are not the same unverified claim.
check(
  "runs with no DATABASE_URL in the environment (or with one — either way, no client)",
  true,
);

// ============================================================================
// 1. Select whitelist — set equality, both directions.
// ============================================================================
console.log("\nselect whitelist:");
const selectKeys = Object.keys(SCREENER_SELECT);
const declared = [...SCREENER_SELECT_KEYS] as string[];

check("whitelist is non-empty", selectKeys.length > 0);
check(
  `select map has exactly ${declared.length} keys (has ${selectKeys.length})`,
  selectKeys.length === declared.length,
);
const extra = selectKeys.filter((k) => !declared.includes(k));
const missing = declared.filter((k) => !selectKeys.includes(k));
check(
  `no key in SCREENER_SELECT is absent from the declared whitelist${extra.length ? ` (extra: ${extra.join(", ")})` : ""}`,
  extra.length === 0,
);
check(
  `no declared whitelist key is missing from SCREENER_SELECT${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`,
  missing.length === 0,
);

// ============================================================================
// 2. Forbidden keys — the paid figures are never fetched, at any tier.
// ============================================================================
console.log("\nforbidden (paid / paid-derived) keys:");
const forbidden = [...SCREENER_FORBIDDEN_KEYS] as string[];
check(
  `forbidden list is NON-EMPTY (${forbidden.length} keys) — otherwise disjointness is vacuous`,
  forbidden.length > 0,
);
const leaked = forbidden.filter((k) => selectKeys.includes(k));
check(
  `forbidden ∩ select = ∅${leaked.length ? ` (leaked: ${leaked.join(", ")})` : ""}`,
  leaked.length === 0,
);
// Case-insensitive too: `valueScoreBps` vs `value_score_bps` vs `ValueScoreBps`
// are the same leak wearing different clothes.
const lowerSelect = selectKeys.map((k) => k.toLowerCase());
const leakedCI = forbidden.filter((k) => lowerSelect.includes(k.toLowerCase()));
check(`forbidden ∩ select = ∅ case-insensitively`, leakedCI.length === 0);

// ============================================================================
// 2b. Sort whitelist — no paid or paid-derived figure is sortable.
// ----------------------------------------------------------------------------
// P4 (beta-execution-plan.md § "P4 — ANSWERED 2026-08-08") makes per-fund
// `value_bps_3y` paid on every surface. If a gated figure were sortable, page
// order would leak its ordinal for the whole universe — the gate would hold on
// the value and lose on the ranking.
// ============================================================================
console.log("\nsort whitelist:");
const sortKeys = [...SORT_KEYS] as string[];
check(`sort whitelist is non-empty (${sortKeys.length})`, sortKeys.length > 0);
check(
  "every sort key is a public column projected by the select map",
  sortKeys.every((k) =>
    ["ticker", "name", "fee", "aum"].includes(k),
  ),
);
const sortLeak = sortKeys.filter((k) =>
  forbidden.some((f) => f.toLowerCase().includes(k.toLowerCase()) && k.length > 3),
);
check(
  `no sort key names a forbidden figure${sortLeak.length ? ` (${sortLeak.join(", ")})` : ""}`,
  sortLeak.length === 0,
);

// An un-whitelisted sort/dir/verdict from a hand-edited URL must normalize away,
// never reach SQL. Non-vacuous: the same call with a VALID value is asserted to
// pass the value through, so "everything becomes the default" would fail.
console.log("\nparam normalization (hand-edited URL cannot reach SQL):");
const hostile = normalizeParams({
  sort: "value_score_bps",
  dir: "sideways",
  verdict: "strong_buy",
  vehicle: "'; DROP TABLE fund_profile_facts; --",
  style: "quant",
  maxFeeBps: "-1",
  page: "-4",
});
check("bogus sort falls back to the default", sortKeys.includes(hostile.sort));
check(
  "bogus sort is NOT the submitted value",
  (hostile.sort as string) !== "value_score_bps",
);
check("bogus dir falls back to the default", ["asc", "desc"].includes(hostile.dir));
check("bogus verdict becomes no filter", hostile.verdict === null);
check("bogus vehicle becomes no filter", hostile.vehicle === null);
check("bogus style becomes no filter", hostile.style === null);
check("negative maxFeeBps becomes no filter", hostile.maxFeeBps === null);
check("negative page clamps to 1", hostile.page === 1);
const valid = normalizeParams({
  sort: "fee",
  dir: "asc",
  verdict: VERDICT_KEYS[0],
  vehicle: "ETF",
  style: "passive",
  maxFeeBps: "25",
  page: "3",
  q: "  vanguard  ",
});
check("a VALID sort passes through (normalization is not a blanket default)", valid.sort === "fee");
check("a VALID dir passes through", valid.dir === "asc");
check("a VALID verdict passes through", valid.verdict === VERDICT_KEYS[0]);
check("a VALID vehicle passes through", valid.vehicle === "ETF");
check("a VALID style passes through", valid.style === "passive");
check("a VALID maxFeeBps passes through", valid.maxFeeBps === 25);
check("a VALID page passes through", valid.page === 3);
check("q is trimmed and length-capped", valid.q === "vanguard");

// ============================================================================
// 3. Verdict SQL — only the three public verdict fields, each scored-gated.
// ============================================================================
console.log("\nverdict SQL projections:");
const dialect = new PgDialect();
const VERDICT_SELECT_KEYS = [
  "value_breakeven_state",
  "value_confidence",
  "value_passive_alt",
] as const;

// Every `->>` in the whole select map, so a verdict field smuggled into a
// non-verdict key is caught too.
const allSql = Object.entries(SCREENER_SELECT)
  .map(([key, expr]) => {
    // Plain column references have no queryChunks; only sql`` templates do.
    const chunks = (expr as { queryChunks?: unknown }).queryChunks;
    if (!chunks) return { key, text: "" };
    return { key, text: dialect.sqlToQuery(expr as never).sql };
  })
  .filter((e) => e.text.length > 0);

// Attribute every `->>` in the rendered SQL to the JSONB COLUMN it reads from,
// e.g. `"fund_profile_facts"."value_score" ->> 'breakeven_state'`. Scoping by
// column matters: `identity ->> 'aum_usd'` is a legitimate public projection,
// while a NEW field pulled out of `value_score` is the leak this guards.
const jsonFieldRe = /"(\w+)"\s*->>\s*'([a-z0-9_]+)'/g;
const ALLOWED_JSON_PROJECTIONS: Record<string, string[]> = {
  value_score: [...SCREENER_VERDICT_FIELDS],
  identity: ["aum_usd"],
};
const projected: { column: string; field: string }[] = [];
for (const { text } of allSql) {
  for (const [, column, field] of text.matchAll(jsonFieldRe)) {
    projected.push({ column, field });
  }
}
const illegal = projected.filter(
  (p) => !(ALLOWED_JSON_PROJECTIONS[p.column] ?? []).includes(p.field),
);
check(
  `every JSONB projection is allowlisted (found: ${projected.map((p) => `${p.column}.${p.field}`).join(", ") || "none"})`,
  illegal.length === 0,
);
const valueScoreFields = new Set(
  projected.filter((p) => p.column === "value_score").map((p) => p.field),
);
const allowedFields = [...SCREENER_VERDICT_FIELDS] as string[];
check(
  "all three public verdict fields ARE projected (the check is not vacuous on an empty projection)",
  allowedFields.every((f) => valueScoreFields.has(f)),
);
check(
  `value_score projects EXACTLY the three public verdict fields (${valueScoreFields.size})`,
  valueScoreFields.size === allowedFields.length,
);

for (const key of VERDICT_SELECT_KEYS) {
  const entry = allSql.find((e) => e.key === key);
  check(`${key} is a SQL expression, not a raw column`, Boolean(entry));
  if (!entry) continue;
  check(
    `${key} is gated on value_coverage_state`,
    /case\s+when[\s\S]*value_coverage_state/i.test(entry.text),
  );
  // The scored literal is a BOUND PARAMETER, so it lives in params, not the text.
  const params = dialect.sqlToQuery(
    SCREENER_SELECT[key] as never,
  ).params as unknown[];
  check(
    `${key}'s scored gate binds the literal '${SCORED_STATE}'`,
    params.includes(SCORED_STATE),
  );
  check(
    `${key} projects exactly one JSONB field`,
    [...entry.text.matchAll(jsonFieldRe)].length === 1,
  );
}

// ============================================================================
// 4. THE SCORED PREDICATE — acceptance criterion 9.
// ----------------------------------------------------------------------------
// A fixture population that reproduces manifest 58's shapes in miniature. Each
// row's `state` / `has_value_score` / `has_alt` combination is one that actually
// occurs in the served table (measured 2026-08-26, manifest 58):
//
//   scored              2,233   value_score present, alt present
//   unavailable         1,944   value_score NULL,    alt absent
//   too_new             1,238   value_score present, alt present for 930 of them
//   not_comparable        372   value_score present, alt present for 367
//   fee_at_other_level     30   value_score present, alt present for all 30
//   fee_unavailable         2   value_score present, alt present for both
//
// TRAP_ROW below is the seeded non-vacuity proof: a `too_new` fund carrying BOTH
// a non-null value_score object AND a non-null passive_alt_label — exactly the
// DYMIX shape. `isScored` must reject it; both naive predicates must accept it.
// ============================================================================
console.log("\nscored predicate (ADDENDUM 1 / acceptance criterion 9):");

interface FixtureRow {
  series_id: string;
  value_coverage_state: string | null;
  /** The served JSONB object — present even when the pipeline REFUSES to score. */
  value_score: Record<string, unknown> | null;
  /** Projected only inside the scored branch; the raw field, for the naive test. */
  raw_passive_alt_label: string | null;
}

/** The seeded trap: non-scored, but carrying both misleading signals. */
const TRAP_ROW: FixtureRow = {
  series_id: "S000000000-TRAP",
  value_coverage_state: "too_new",
  // Verbatim shape of DYMIX on manifest 58: `scored: false`, every figure null,
  // and a real passive_alt_label. The object's PRESENCE means nothing.
  value_score: {
    beta: null,
    scored: false,
    framing: "relative_diagnostic",
    score100: null,
    value_bps: null,
    confidence: null,
    replica_r2: null,
    coverage_state: "too_new",
    method_version: "value_score_v0.3.2",
    above_breakeven: null,
    breakeven_state: null,
    gross_alpha_bps: null,
    passive_alt_label: "USMV",
    passive_alt_fee_bps: 15,
  },
  raw_passive_alt_label: "USMV",
};

const FIXTURE: FixtureRow[] = [
  {
    series_id: "S000006037", // FCNTX — genuinely scored
    value_coverage_state: "scored",
    value_score: {
      scored: true,
      coverage_state: "scored",
      breakeven_state: "above",
      confidence: "high",
      passive_alt_label: "SPY",
    },
    raw_passive_alt_label: "SPY",
  },
  {
    series_id: "S000000001", // AGTHX-shape — scored, below breakeven
    value_coverage_state: "scored",
    value_score: {
      scored: true,
      coverage_state: "scored",
      breakeven_state: "below",
      confidence: "high",
      passive_alt_label: "IWF",
    },
    raw_passive_alt_label: "IWF",
  },
  {
    series_id: "S000002839", // VOO — `unavailable`, no value_score object at all
    value_coverage_state: "unavailable",
    value_score: null,
    raw_passive_alt_label: null,
  },
  TRAP_ROW,
  {
    series_id: "S000000002", // not_comparable, WITH an alt label (367 such rows)
    value_coverage_state: "not_comparable",
    value_score: {
      scored: false,
      coverage_state: "not_comparable",
      breakeven_state: null,
      passive_alt_label: "EFV",
    },
    raw_passive_alt_label: "EFV",
  },
  {
    series_id: "S000000003", // fee_at_other_level — all 30 carry an alt label
    value_coverage_state: "fee_at_other_level",
    value_score: {
      scored: false,
      coverage_state: "fee_at_other_level",
      breakeven_state: null,
      passive_alt_label: "IEMG",
    },
    raw_passive_alt_label: "IEMG",
  },
  {
    series_id: "S000000004", // fee_unavailable
    value_coverage_state: "fee_unavailable",
    value_score: {
      scored: false,
      coverage_state: "fee_unavailable",
      breakeven_state: null,
      passive_alt_label: "SPY",
    },
    raw_passive_alt_label: "SPY",
  },
  {
    series_id: "S000000005", // a state this build has never seen — must NOT score
    value_coverage_state: "some_future_state",
    value_score: { scored: false, coverage_state: "some_future_state" },
    raw_passive_alt_label: null,
  },
  {
    series_id: "S000000006", // a NULL state — must NOT score
    value_coverage_state: null,
    value_score: null,
    raw_passive_alt_label: null,
  },
];

const EXPECTED_SCORED = 2;
const scoredRows = FIXTURE.filter(isScored);
check(
  `isScored pins the scored population to value_coverage_state = '${SCORED_STATE}' (${scoredRows.length} of ${FIXTURE.length})`,
  scoredRows.length === EXPECTED_SCORED,
);
check(
  "isScored's scored set is exactly the rows whose state is 'scored'",
  scoredRows.every((r) => r.value_coverage_state === SCORED_STATE) &&
    FIXTURE.filter((r) => r.value_coverage_state === SCORED_STATE).length ===
      scoredRows.length,
);

// --- The seeded trap: prove the check CAN fail ------------------------------
check(
  "TRAP row is genuinely a trap: it carries a non-null value_score object",
  TRAP_ROW.value_score !== null,
);
check(
  "TRAP row is genuinely a trap: it carries a non-null passive_alt_label",
  TRAP_ROW.raw_passive_alt_label !== null,
);
check(
  "TRAP row is in a NON-scored coverage state",
  TRAP_ROW.value_coverage_state !== SCORED_STATE,
);
check("isScored REJECTS the trap row", !isScored(TRAP_ROW));

// Each naive predicate must ACCEPT the trap — otherwise the trap is inert and
// these assertions would pass for the wrong reason (vacuous-check lesson).
const naiveByValueScore = (r: FixtureRow) => r.value_score !== null;
const naiveByAltLabel = (r: FixtureRow) => r.raw_passive_alt_label !== null;
check(
  "naive `value_score IS NOT NULL` ACCEPTS the trap (so the trap is live)",
  naiveByValueScore(TRAP_ROW),
);
check(
  "naive `passive_alt_label IS NOT NULL` ACCEPTS the trap (so the trap is live)",
  naiveByAltLabel(TRAP_ROW),
);

// And at population level, each naive predicate OVER-counts — the miniature of
// the measured 3,875 (+1,642) and 3,562 (+1,329).
const naiveVsCount = FIXTURE.filter(naiveByValueScore).length;
const naiveAltCount = FIXTURE.filter(naiveByAltLabel).length;
check(
  `naive value_score predicate over-counts (${naiveVsCount} vs ${EXPECTED_SCORED})`,
  naiveVsCount > EXPECTED_SCORED,
);
check(
  `naive passive_alt_label predicate over-counts (${naiveAltCount} vs ${EXPECTED_SCORED})`,
  naiveAltCount > EXPECTED_SCORED,
);

// --- The RENDERED consequence: the "vs {alt}" caption ------------------------
// The trap's danger is not abstract — it is one line of UI. `LEAKY_TRAP` models
// the worst case: the SQL projection FAILED to suppress the label, so the row
// arrives carrying `value_passive_alt`. The caption must STILL refuse to render,
// because the second gate keys on the coverage state, not the label.
const LEAKY_TRAP = {
  value_coverage_state: TRAP_ROW.value_coverage_state,
  value_passive_alt: TRAP_ROW.raw_passive_alt_label,
};
check(
  "LEAKY_TRAP genuinely carries a passive_alt_label (the check is not vacuous)",
  LEAKY_TRAP.value_passive_alt !== null,
);
check(
  "no 'vs {alt}' caption for a non-scored row even when the label leaks through",
  !showsPassiveAltCaption(LEAKY_TRAP),
);
check(
  "the 'vs {alt}' caption DOES render for a genuinely scored row (not vacuous)",
  showsPassiveAltCaption({ value_coverage_state: "scored", value_passive_alt: "SPY" }),
);
check(
  "no 'vs {alt}' caption for a scored row with no served label",
  !showsPassiveAltCaption({ value_coverage_state: "scored", value_passive_alt: null }),
);

// The unknown-future-state and NULL-state rows must fall through to NOT scored —
// honest by construction. A chip fallback that threw, or that scored them, would
// be the fail-open version of this.
check(
  "an unrecognized coverage state does not score",
  !isScored({ value_coverage_state: "some_future_state" }),
);
check("a NULL coverage state does not score", !isScored({ value_coverage_state: null }));
check(
  "an undefined coverage state does not score",
  !isScored({ value_coverage_state: undefined }),
);

// ============================================================================
if (failures > 0) {
  console.error(`\nscreener-select-golden: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nscreener-select-golden: all assertions passed");
