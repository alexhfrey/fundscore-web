---
id: positioning-isin-rekey
title: Re-key the positioning year-over-year comparison on ISIN — "what else moves" measurement first, build gated on the owner's go
status: queued
track: backend
repo: fund_score
lane: reviewed
depends_on: ""
source_proposal: owner ruling 2026-08-26 (decision B — beta-execution-plan.md § Decision register, "827 false 'exited' rows")
created: 2026-08-26
scope: global
model: opus
effort: high
---

## Owner summary
On roughly 250 funds we currently tell the reader the manager sold a position they still own,
because the matching that compares this year's portfolio to last year's loses track of a security
when a filing stops printing one of its ID codes. This spec first measures exactly what changes
across all ~3,600 funds if we switch to the ID code that survives (ISIN), brings you that
measurement for a go/no-go, and only then rebuilds the comparison — the 827 visible false rows are
the tip, and the register requires the full picture before anyone builds.

## Authority and sequencing (read first)

- **Owner ruling — Decision B, 2026-08-26** (`feature-pipeline/beta-execution-plan.md`, Decision
  register): *"The proper fix is to key the year-over-year comparison on ISIN … But that is a change
  to the MATCHING KEY of the whole comparison, touching ~1M rows, not a patch to 827 …
  **it needs the 'what else moves' measurement FIRST.**"* Segment 0 of this spec IS that
  measurement; **Segments 1+ are conditional on the owner's go after reviewing it.** Do not begin
  Segment 1 without that ruling recorded as an `## ADDENDUM` below.
- **Interim state:** the 827 false rows are LIVE in the served free-tier `positioning_changes`
  section until this lands. Decision B separately argues for a **stopgap suppression of the 827
  now** ("not a days-shaped job, which is the argument for suppressing the 827 now rather than
  waiting for it"). That stopgap is a SEPARATE decision/loop — **reference it, never fold it into
  this spec.** Consequence for Segment 0: if the stopgap lands first, the live surfaced set and the
  pinned ratchet baseline will differ from the 2026-08-26 figures quoted here; measure against the
  live state and diff against the pins, never assume the era-stamped numbers.
- **Backlog origin:** `feature-pipeline/backlog.md` item "827 SURFACED false 'entered'/'exited'
  rows across ~250 funds" (SPECCED 2026-08-26 → this spec). Its `⚠ READ BEFORE YOU FIX THIS`
  trap warning is folded into Segment 1 below — it is load-bearing, not advisory.
- **Redesign-collision check (2026-08-26):** no queued spec retires or replaces the positioning
  panel. Adjacent, coordinate-don't-collide: `specs/queue/look-through-coverage-honesty.md` touches
  `lookthrough_window.py:315` (wrapper flag) and `fact_assembler._positioning_changes_by_series`
  (coverage metadata emission) — different lines, different defects; if both are in flight
  simultaneously, rebase rather than duplicate. `profile-v2-production-cutover` consumes
  `positioning_context` (a different panel). No `at_risk` marker needed.
- **Repo rules (fund_score `AGENTS.md` via `CLAUDE.md`):** branch-guard blocks main — work on a
  per-run worktree branch; a worktree isolates CODE not DATA (`data/` is the shared lakehouse —
  Segment 0 writes ONLY under `data/_tmp/positioning-isin-rekey/`); commit scoped files, never
  `git add -A`.

## Goal
Make the position-family year-over-year comparison key on an identifier that survives a filer's
CUSIP/ticker dropout, so a security held at both endpoints can never be classified `entered` or
`exited`. Rows the fix re-derives become `increased`/`decreased`/below-floor-none with real values
at both endpoints. Rows with no usable identity are **honestly excluded and counted** — no
synthetic keys, no imputation, ever.

## Context — the mechanism, in the real code

The panel is built by `scripts/pipeline/build_positioning_changes_panel.py` from
`data/gold/holdings_lookthrough_window_no_expansion.parquet` (the served basis, owner decision
2026-08-24; `LOOKTHROUGH_FRAME`, builder line 69). The frame carries per
`(series_id, quarter_end, security_id)`: `security_ticker`, `isin`, `cusip`, `pct_nav`, …
(schema: `src/fundscore/product/lookthrough_window.py:56`).

1. **Ticker resolution is CUSIP-only.** The frame's `security_ticker` comes exclusively from a
   `cusip_ref` join on the filed CUSIP (`lookthrough_window.py:130-139`, `WINDOW SQL` `keyed`
   block). Sentinel identifiers (`'N/A'`, `'NA'`, `''`, all-0s/9s) are barred from the join, so a
   filer that stops printing CUSIP yields `security_ticker = NULL` — the ISIN is never consulted
   for ticker resolution anywhere in the chain.
2. **The position family keys on that ticker and drops nulls.** `build_positions`
   (`build_positioning_changes_panel.py:528-609`) filters
   `th.filter(pl.col("stock_ticker").is_not_null())` (line 540 — `stock_ticker` is the frame's
   `security_ticker`, renamed at line 836) and pivots per `(series_id, stock_ticker)` across the
   prior/mid/current endpoints (line 543). A security with a ticker at the prior endpoint and
   NULL ticker at the current endpoint appears only on the prior side → `prior ≥ 1%, current = 0`
   → classified **`exited`** (direction expr, lines 551-556). Mirror image → false `entered`.
3. **The existing guards cannot see it.** Guard 4 (identifier-change false pair, lines 568-585)
   needs an entered AND an exited name sharing a `cusip6` — here nothing enters. Guard 2 only
   requires the surviving ticker to resolve.
4. **Worked examples (era-stamped 2026-08-26, dispatcher-verified, non-binding diff refs):**
   DAACX (`S000073478`) served "exited AAPL −4.89pp": at 2025-01-31 `ticker=AAPL,
   cusip=037833100, isin=US0378331005, pct_nav=4.888%`; at 2026-01-31 the SAME
   `isin=US0378331005` is present at `pct_nav=4.689%` with `ticker=None, cusip=None`. The fund
   never sold a share. Second: `S000048264` "exited AAPL −9.71pp" while holding Apple at 9.62%.
5. **Bounded by Check 10** (`scripts/reports/check_positioning_changes_panel.py:1857-1990`,
   added 2026-08-26): full-join of the two endpoints ON ISIN found **827 surfaced false rows /
   244 series** (plus an unsurfaced tail to 907 total), against a control leg of **24,381 true
   exits** (~3.3% of exit claims false). Pinned as a per-series ratchet in
   `reports/product/positioning_changes_defect_baseline.json`
   (`check_10_position_entry_exit_isin`: `surfaced_rows` 827, `funds` 244,
   `surfaced_position_rows` floor 49,205, `control_true_exits` floor 24,381, `total_rows`
   ceiling 907; `panel_method_version` `positioning_changes_v0.3_no_expansion`,
   `panel_rows` 139,260).
6. **Viability, reproduced on the live frame 2026-08-26 by this spec's author** (frame
   `holdings_lookthrough_window_no_expansion.parquet`, 2,602,666 rows): **1,012,231 rows (38.9%)
   carry NO `security_ticker`; 1,002,884 of those (99.1%) DO carry an ISIN; only 8,877 have
   neither ISIN nor CUSIP.** All three register numbers reproduce exactly. ISIN can carry the
   join. (These are diff references — Segment 0 recomputes them.)
7. **ISIN fan-out is real but small (measured 2026-08-26, non-binding):** 428 of 2,576,338
   `(series_id, quarter_end, isin)` groups carry >1 row (857 rows); **387** of them mix a
   ticker-keyed row with a ticker-less row for the SAME ISIN in ONE filing (the within-quarter
   split-identity the re-key would merge); **42** bind one ISIN to >1 distinct ticker in one
   fund-quarter (contested identity → honest exclusion, never an arbitrary winner).

### Which families are exposed (grounded, per-family)
- **position** — ticker-keyed pivot (line 540/543). **The defect.**
- **theme** — `build_theme` joins `theme_members` on `stock_ticker`
  (`build_positioning_changes_panel.py:285-294`), so a ticker dropout also deflates theme weights
  at one endpoint → potential false theme decreases/increases. NOT measured by Check 10;
  Segment 0 must measure it.
- **sector / top-10 (concentration)** — NOT ticker-keyed: sector comes from the shared
  domicile-aware `attach_sector` (ISIN/CUSIP-keyed, builder line 852) and top-10 counts
  ticker-less rows (comment at builder lines 791-798). Expected unmoved by a comparison-layer fix;
  Segment 0 confirms rather than assumes.
- **cash / style / active-share / effective-positions** — different sources
  (`asset_allocation_history`, returns, `diversification_panel`); out of the blast radius.
- **identity_assessment** (rulings H-1/K-1, builder line 473) and the **TE-impact enrichment**
  (position σ_stock lookups keyed by ticker, builder lines 720-733) both key on ticker — they
  follow whatever key design is adjudicated; Segment 0 measures their movement.

## Data source
- `data/gold/holdings_lookthrough_window_no_expansion.parquet` — the served no-expansion frame
  (input; produced by `build_holdings_lookthrough_window.py --full --no-expansion --out <path>`;
  the canonical-path guard at `build_holdings_lookthrough_window.py:135-143` fail-closes writes to
  the expanded frame's path).
- `data/gold/isin_reference.parquet` — `(isin, ticker, name, sector, industry)`; 95,447 rows on
  2026-08-26. The candidate ISIN→ticker recovery surface.
- `data/gold/cusip_reference.parquet` — the existing CUSIP→ticker surface (guard 2's `cusip6`).
- `data/gold/positioning_changes_panel.parquet` — the live panel to diff against
  (`positioning_changes_v0.3_no_expansion`, 139,260 rows on 2026-08-26).
- `data/nport/snapshot/**` — RAW filed holdings, for atomic spot-checks independent of every
  derived frame.
- As-of: `eval_date` = holdings frontier, derived in-run (`pcp.detect_holdings_frontier()`), never
  hardcoded ([[build-clock-recorded-not-frozen]]).

## Design — invariants, not an implementation pin

The registered remedy has two mechanically distinct realizations; the adjudication between them is
Segment 0's product, made at the checkpoint with the measurement in hand (this judgment is why the
implementer is opus):

- **(B) ISIN-primary comparison key** in `build_positions`: match endpoint rows on ISIN where both
  endpoints carry one; residual unmatched rows fall back to ticker match; display ticker resolves
  from whichever endpoint has one. Fixes ALL isin-at-both cases (the 99.1%) independent of any
  reference table's coverage. Does NOT touch the theme family.
- **(C) Load-time ISIN→ticker recovery** in the panel builder (fill NULL `stock_ticker` via
  `isin_reference` after the line-836 rename): fixes position AND theme in one move, but only
  where the ISIN resolves in `isin_reference` (coverage over the affected rows = measurement M2),
  and admits NEW rows into the position/theme families for securities that were ticker-less at
  BOTH endpoints (the surfaced set shifts — measured, then adjudicated).
- B+C combined is a legitimate outcome. A frame-layer fix (changing `WINDOW SQL` /
  `security_id` keying) is NOT the default: it moves the frame's grain and requires a consumer
  audit first ([[consumer-audit-not-literal-grep]] — grep `load_*`/dir-join sites, not the literal
  path). If Segment 0's consumer audit shows the no-expansion frame has consumers beyond the
  positioning panel + its check, a frame-layer fix is a scope change: STOP and re-brief.

Whatever design is adjudicated must satisfy these **invariants**:
1. **No false transition:** a security held at both endpoints under the same ISIN produces ONE
   comparison row — never an entered + exited pair, never a lone exited/entered.
2. **No fan-out / no double-count:** each frame row contributes to at most one comparison
   identity; total position-family pct_nav mass per (series, endpoint) is conserved through the
   re-key ([[verify-the-join-key-before-diffing]] — audit key multiplicity BEFORE any diff).
3. **Contested identity → honest exclusion:** one ISIN claiming >1 distinct ticker within a
   fund-quarter (42 groups today) is excluded and counted, never resolved by an arbitrary winner
   ([[deterministic-wrong-worse-than-nondeterministic]]).
4. **Honest-missing stays missing:** the 8,877 neither-ISIN-nor-CUSIP rows (and any row with no
   usable identity) are excluded and COUNTED — no synthetic key, no name-based fabrication beyond
   what the frame's existing `security_id` doctrine already provides.
5. **Sentinel hygiene:** every new identifier operand re-applies the sentinel bar
   (`'N/A'/'NA'/''`, all-0s/9s) — this defect IS the [[negation-filters-absorb-new-row-types]]
   shape; do not recreate it one layer up.
6. **Determinism:** rebuild twice, sort, diff — byte-stable ([[rebuild-twice-proves-determinism]]).

---

## Segment 0 — MEASUREMENT ONLY (zero canonical writes)

**Outputs:** everything under `data/_tmp/positioning-isin-rekey/` (parquets + a measurement report
`measurement.md` in the same directory as the reviewer's evidence pack — the report is input to
the data-reviewer gate and the owner brief, not a repo report file). **No write touches
`data/gold/`, `data/product/`, serving, or any pinned baseline.** Use the existing machinery
(`build_positions` & co. imported, or a `--out`-redirected panel build) rather than re-implementing
the classification — a re-implementation would measure the re-implementation.

Measurements (each lands in the report with the number, the method, and the artifact path):

- **M1 — Reproduce the register's viability numbers on the live frame.** Frame rows / no-ticker /
  no-ticker-with-ISIN / neither-ISIN-nor-CUSIP (2026-08-26 refs: 2,602,666 / 1,012,231 /
  1,002,884 / 8,877). Any discrepancy is REPORTED against the register, never silently adjusted.
- **M2 — Identifier availability at the endpoints that matter.** Restricted to served endpoint
  pairs (each fund's `q_prior`/`q_cur`): cross-tab of ticker/ISIN presence patterns —
  ticker@both · ISIN@both-ticker@one (the defect class) · ISIN@one (the mirror class a pure-ISIN
  key would newly break) · neither. Plus: of the defect class, what fraction's ISIN resolves in
  `isin_reference` (design C's ceiling) — split resolves / honest-miss by spot-checking ≥10
  unresolved ISINs against the raw source before calling them honest.
- **M3 — Full re-derivation diff (the register's core ask).** Re-derive the position family under
  the candidate key (B; and C if cheap to run both) on the full frame, then diff against the live
  panel per `(series_id, change_id)`: the class-transition matrix
  (entered/exited/increased/decreased/none → same five), magnitude-delta distribution
  (p50/p90/max pp, worst 20 rows named), rows that MERGE (currently-separate → one; the 387
  mixed groups are the prior), rows that appear, rows that vanish.
- **M4 — The 827 pinned rows specifically.** Join the pinned per-series map
  (`positioning_changes_defect_baseline.json` → `check_10_position_entry_exit_isin`) to the
  re-derivation: each pinned surfaced false row's NEW classification, with the DAACX/AAPL and
  S000048264/AAPL worked examples shown end-to-end (expected: exited → decreased at the filed
  weights; any other outcome explained from the filings).
- **M5 — The no-identity remainder.** Where the 8,877 neither-ISIN-nor-CUSIP rows land: excluded
  count, per-fund pct_nav mass involved, how many sat in the position family before (ticker
  present?) vs never did.
- **M6 — Fan-out audit BEFORE the diff.** Per-(series, endpoint, key) multiplicity under the
  candidate key; conservation check per invariant 2 (Σ pct_nav before vs after re-key, per fund
  endpoint). The 428/387/42 figures are the era-stamped prior.
- **M7 — Blast radius + surfaced-set churn.** Funds with ≥1 class change; `is_surfaced` flips;
  top-8 (=`TOP_POSITIONING`, `fact_assembler.py:141`) served-set churn per fund; TE-impact deltas
  on re-derived rows (an exited→decreased row gains a real `current_value` and a different
  `te_impact_bps`). Lead the report with the headline: N of ~3,578 served funds change what a
  reader sees.
- **M8 — Sibling-family sensitivity.** Theme family: pct_nav mass on defect-class rows that are
  theme members → bound on false theme deltas; confirm sector and top-10 families are unmoved by
  the comparison-layer designs (recompute, don't assert). Check 6's compared population must not
  silently move.
- **M9 — Guard interplay.** How many guard-4 flagged pairs and guard-2 failures dissolve or
  appear under the re-key; identity_assessment coverage delta.
- **M10 — Coverage, up front.** Position-family coverage before/after (funds with ≥1 position
  row; per-fund excluded-mass), split honest-missing vs recoverable-missing per house doctrine.
- **M11 — Consumer audit of the no-expansion frame** (for the frame-layer no-go/go call):
  helper-built paths included, not literal grep.

**Segment 0 gates (in order):**
1. `fundscore-data:data-reviewer` checkpoint (session model — never tiered down) on the
   measurement pack: atomic re-derivations vs RAW N-PORT snapshots on ≥15 sampled rows (10 from
   the transition classes, 5 unchanged controls), aggregate sanity, non-degeneracy of every
   zero-returning measurement (a check returning 0 must be shown able to return non-zero —
   [[vacuous-check-and-boundary-axis]]).
2. **Owner review — hard stop.** `/owner-brief`-shaped: what we measured, the transition matrix,
   the blast radius, the design recommendation (B vs C vs B+C) with trade-offs, the ask
   (go/no-go + design). The build below is CONDITIONAL on this ruling; record it as an
   `## ADDENDUM` here, between rounds, never mid-round ([[rulings-land-between-rounds]]).

---

## Segment 1 — the build (GATED on the owner's Segment-0 go)

Implement the adjudicated design:
- **Comparison / recovery logic** in `scripts/pipeline/build_positioning_changes_panel.py`
  (`build_positions`, and the load block at lines 833-860 if design C is in). Shared logic that
  the check must also compute lives in `src/fundscore/product/positioning_changes.py`, not
  duplicated in the check ([[te-decomposition-one-coherent-basis]] pattern: one basis module).
- **Method-version bump** — the basis of `is_surfaced`/`surfaced_rank` changes, so the label must
  move with it: add `positioning_changes_v0.4_*` following the closed-enum pattern at
  `src/fundscore/product/positioning_changes.py:72-87` (`METHOD_VERSIONS` tuple; `assign_*`
  refuse unrecognized labels). Audit every `method_version` consumer and every
  `!= sentinel`-style filter the bump touches ([[negation-filters-absorb-new-row-types]]).
- **Check updates** in `scripts/reports/check_positioning_changes_panel.py`: Check 10 stays as the
  regression guard, but note it becomes near-tautological once the panel itself keys on ISIN —
  add/keep an independent leg: atomic verification against RAW N-PORT filings for a sample of
  re-derived rows (the check may sample; the reviewer gate below does it adversarially).
- **The prover trap — fix it in this change (backlog ⚠, codex P2 2026-08-26):** after the root
  cause is fixed and `--pin-baseline` re-pins, the pinned per-series maps become EMPTY, and
  `prove_ratchet` (`check_positioning_changes_panel.py:259`) runs probes that assume a non-empty
  baseline, marking the prover broken and flipping a CLEAN zero-defect artifact to FAIL. Handle
  the zero-defect baseline in the probes: with an empty pinned map the gate must PASS on a clean
  artifact and still FAIL on a seeded false row (prove both directions).
- **Re-pin, loudly:** run `--pin-baseline`; the re-pinned
  `positioning_changes_defect_baseline.json` diff (flattened, per key — the ratchet-round-3
  convention) goes in the PR body verbatim. Expected: Check 10 `surfaced_rows` → 0 with
  denominary floors updated to the new measured values; Check 6 legs unchanged unless M8 said
  otherwise (any Check 6 movement must be explained, not absorbed). Update the baseline's
  `backlog_item` pointer (currently `positioning-position-ticker-isin-resolution`) to this spec's
  id. **Never a silent re-pin: the baselines get re-pinned as part of this change and the diff is
  owner-visible.**
- **Determinism:** build twice, sorted byte-diff.
- **Gates:** `make check FEATURE=positioning_changes` exit 0 · `/check-data` on the rebuilt panel
  (FAIL blocks, WARNs to owner) · adversarial `fundscore-data:data-reviewer` pass (session model)
  with per-fund diff vs the pre-change panel ([[aggregate-gate-masks-per-series-regression]] — a
  count ratchet is not the reviewer) · codex gate per house workflow.

## Segment 2 — serving surface (after Segment 1 is green)

- `positioning_changes` is a free-tier section of `fund_profile_facts`, assembled by
  `src/fundscore/serving/fact_assembler.py:1114` (`_positioning_changes_by_series`; top
  `TOP_POSITIONING = 8` surfaced rows by `surfaced_rank`; fail-closed guards for missing TE
  columns and out-of-enum classifications already exist — do not weaken them). **No schema
  change, no web change**: the JSONB row values change within the existing section shape, so
  `src/lib/db/schema/serving.ts` in fundscore-web is untouched and no frontend spec is needed.
- Rebuild serving facts (staging parquet), diff served rows vs the current serving backup
  **per-series** (never aggregate-only), prove served == gold on ≥10 spot funds including at
  least one from the 244 affected series and one unaffected control.
- **The serving reload is an owner hard stop** (standing campaign rule). Local serving DB only;
  production is untouched by this spec (prod carries only waitlist/early-access tables — see
  `prod-serving-data-load-beta-runbook` for the eventual prod path).
- Do not load serving from a branch missing another feature's emitters
  ([[serving-db-ahead-of-branches]]) — assemble from a branch that includes everything currently
  serving.

## Output

- `data/gold/positioning_changes_panel.parquet` rebuilt — same schema
  (`pc.CANDIDATE_COLS`/serving columns unchanged), new `method_version =
  positioning_changes_v0.4_*`, row VALUES change per the measurement. If the adjudicated design
  adds columns (e.g., a `match_key_kind ∈ {isin, ticker}` provenance stamp — recommended so a
  served row's key basis is auditable), they are additive and documented in the module header.
- Re-pinned `reports/product/positioning_changes_defect_baseline.json`.
- If design C is adjudicated: no new parquet — the recovery happens at panel-load; the frame on
  disk is unchanged. (A frame rebuild is out of scope unless the owner's Segment-0 ruling says
  otherwise.)

## EDA questions (Segment 0 answers these before anything is built)
1. Of the ISIN@both-ticker@one defect class, what does the class-transition matrix actually look
   like — and does ANY pinned false-exit row re-derive to something other than
   increased/decreased/none? (If yes, why — that's a second mechanism, not noise.)
2. How large is the mirror class (ISIN@one, ticker@both), i.e., the defect a naive pure-ISIN key
   would CREATE? The chosen key must leave it at zero.
3. Does the theme family carry material false deltas from the same dropout, and does fixing it
   require design C (ticker recovery) or a theme-side key change?
4. What NEW securities enter the position family under design C (previously ticker-less at both
   endpoints), and is admitting them a product improvement or scope creep? (Owner call at the
   checkpoint if material.)

## Verification plan (for the reviewed-lane gates)
- **Sample:** ≥20 atomic items for the Segment-1 reviewer: 10 re-derived rows (incl. DAACX and
  S000048264), 5 merges, 5 unchanged controls — each verified against the RAW N-PORT snapshot
  filings at both endpoints, not against any derived frame ([[green-gate-not-sufficient]]).
- **Baseline/prior:** the live v0.3 panel + the 2026-08-26 pinned defect baseline; every quoted
  number here is an era-stamped diff reference, recomputed live.
- **Aggregate checks:** class-transition matrix conservation (row accounting: every live position
  row lands in exactly one cell); pct_nav mass conservation per invariant 2; per-series diff vs
  backup; Check 10 recomputed → 0 surfaced false rows, with every residual (if any) individually
  adjudicated honest; control leg (true exits) still non-degenerate — its count will move because
  the old 24,381 was measured under the old key; the movement is explained, not ratcheted away.
- **Statistical coherence / no-leakage:** none of the re-keying may consult post-endpoint data;
  the recovery map (`isin_reference`) is a static reference, not a point-in-time leak surface —
  but confirm it doesn't resolve tickers that did not exist at the endpoint date for any sampled
  row (name it in the reviewer notes if found; it's a label, not a return, so it gates on
  honesty, not lookahead).
- **Non-degeneracy:** every gate that reads 0 (false rows, fan-out, mirror class) is shown able
  to fire via a seeded probe.

## Acceptance criteria
- **Segment 0:** measurement pack complete under `data/_tmp/positioning-isin-rekey/` with M1-M11;
  register numbers reproduced or the discrepancy reported verbatim; data-reviewer PASS; owner
  ruling recorded as an ADDENDUM. **Zero canonical writes** (prove: `git status` clean outside
  the worktree branch's code; no mtime change on `data/gold/**`, the pinned baseline, or serving).
- **Segment 1:** the two worked examples no longer classify as exited — recomputed from live
  sources, *or the deviation is explained by a documented basis/universe change* (e.g., a newer
  filing moved the endpoints). Check 10 recomputed on the new panel reports 0 surfaced false
  rows (residuals individually adjudicated). No fan-out; mass conserved; mirror class at zero.
  `make check FEATURE=positioning_changes` exits 0 against the RE-PINNED baseline; the prover
  passes its zero-defect-baseline probes in both directions. `/check-data` passes. Determinism
  proven (build-twice diff). Method version bumped and enforced by the closed enum.
- **Segment 2:** served `positioning_changes` == gold on the spot set; per-series serving diff
  reviewed; reload executed only on the owner's go. No gated-data change (section is and stays
  free-tier).
- Every capability claim in the implementation PR is a checkable reference (file:line / column /
  baseline key), never prose.

## Out of scope
- The **stopgap suppression of the 827** (separate decision/loop per Decision B — reference only).
- **Check 6** (X-Ray no-expansion coherence WARN, 53/3,578 — own backlog item
  `positioning-xray-same-page-contradiction`); this spec only proves it didn't move, or explains
  the movement.
- Rebuilding either **lookthrough frame** or changing `WINDOW SQL` / `security_id` keying (frame
  grain) — unless the owner's Segment-0 ruling explicitly widens scope.
- The expanded frame's other consumers (Exposure X-Ray, sector_attach, L14).
- Upstream N-PORT ingest, `EVAL_DATE`/frozen-clock items (decisions A/C), and the
  `coverage_state` constant item.
- Any web/UI change.

## Risks
- **Mirror-image defect:** keying purely on ISIN breaks the ISIN-dropped-CUSIP-kept case; the
  invariants + M2's mirror-class measurement guard it.
- **Fan-out inventing churn:** a non-unique join key fabricates entered/exited pairs — the exact
  failure [[verify-the-join-key-before-diffing]] recorded; M6 runs before any diff is trusted.
- **Ratchet re-pin absorbing a regression:** the re-pin diff is printed and owner-reviewed;
  floors/ceilings recomputed, never carried stale.
- **Interim-state drift:** the stopgap suppression (or any panel rebuild) landing mid-flight
  moves the surfaced set; Segment 0 measures the live state and stamps what it measured against
  (frame mtime + panel method_version in the report).
- **Surfaced-set churn as user-visible flapping:** exited→decreased flips change fund pages for
  up to ~250 funds at reload; that is the point, but the owner sees the blast radius (M7) before
  it ships.
- **Check-10 tautology post-fix:** the guard that found the defect keys the same way the fix
  does; the raw-filing atomic leg in Segment 1 keeps verification independent
  ([[verification-metric-must-be-non-degenerate]]).

---

## ADDENDUM log
Rulings land HERE, between rounds — in the spec, never in the workflow/gate/check/agent
machinery. Before acting on an addendum, check its commit time against the current round's last
write ([[rulings-land-between-rounds]]). Expected entries: (1) the owner's Segment-0 go/no-go +
design adjudication; (2) any mid-flight interaction with the stopgap-suppression loop.
