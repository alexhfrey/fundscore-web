---
description: Lean loop to fix one data issue at the source — root-cause, fix, rebuild, sweep for ALL inconsistencies (/check-data + invariants + sibling/as-of/provenance), review (data-reviewer + codex), commit
---
Fix ONE data issue in the `fund_score` backend. Lean and main-loop-driven (this replaces the heavy
multi-agent assembly line, which dies on session limits): you drive directly and delegate only broad
research and the final adversarial review. Invoked by `/triage` for a `(data)` item, or directly.

**Data integrity is the whole job (CLAUDE.md):** NEVER fabricate, impute, default, interpolate, or otherwise
paper over missing/wrong data. Find why it's wrong and fix the **upstream cause**. Verify every number
against its raw source. Surface gaps honestly; a transparent null beats a fabricated value.

Setup: resolve FUNDSCORE = `product.fund_score_repo` from `feature-pipeline/config/page-types.json`; work
there with `uv run python`. Inspect parquets with `duckdb`.

Steps:
1. **Measure the defect first.** Reproduce it with a concrete query/number (before-state). State the honest
   baseline — don't over- or under-report.
2. **Root-cause to the source.** Trace the bad value back through the provenance chain (served → gold →
   intermediate → raw filing/source). Confirm against the **raw source** (the actual SEC filing / input
   table), not a convenient reconciliation. If breadth is needed (mapping an unfamiliar pipeline, finding all
   producers/consumers), spawn ONE `Explore` agent and wait for its map; otherwise trace inline.
3. **Fix at the source.** Smallest change to the upstream producer that corrects the cause. If a value is
   genuinely unavailable, make it an explicit null + reason — never a synthetic fill. Scope changes to the
   files the fix needs.
4. **Rebuild + verify the numbers.** Rebuild the affected gold (and serving if in scope, but DO NOT push to
   Postgres without explicit sign-off). Re-run the before-state query and show the after. Report honest
   measured before→after counts at each step.
5. **Inconsistency sweep (MANDATORY — fault-first, the task is NOT done without it).** Verifying *your fix
   works* is not enough; you must actively hunt for every inconsistency the change could **introduce or
   expose** across the whole affected surface. The fee work passed `/check-data` and still shipped two
   inconsistencies caught only later — assume yours has some and go find them. At minimum:
   - **`/check-data` on EVERY touched feature** (not just the headline one), entity = series_id. Use its
     baseline/commensurability and label/basis checks. Investigate any FAIL before proceeding; report WARNs.
   - **Re-run every invariant/gate the changed data feeds** (e.g. the fee-coherence gate) over the FULL
     universe and confirm **no NEW violation anywhere** — not just that the target metric improved. Report the
     before→after counts for each invariant, not only the one you targeted.
   - **Sibling/asymmetry check:** for every field paired with or derived from what you changed (the
     net/gross/management triple; anything sourced on a parallel path), confirm it moved **consistently**. A
     field that advanced while its sibling stayed stale/null is a defect (this is exactly the gross-vs-net
     asymmetry that slipped through before).
   - **Commensurability:** every operand of a derived figure shares as-of / grain / units / baseline.
   - **Provenance:** spot-check 3–5 records end-to-end (served == gold == raw source) for the changed values;
     and confirm no schema/coverage regression (e.g. a column added to some partitions but not others).
   List what you checked and the result. Anything you find here, fix at source and re-sweep.
6. **Review gates (adversarial — BOTH must sign off; no task is done without them):**
   - Spawn the **data-reviewer** agent (atomic spot-checks vs raw source, aggregate sanity, statistical/as-of
     coherence, no-synthetic-data scan). A `fail` is blocking.
   - Run `.claude/scripts/codex-review.sh --uncommitted` (codex is repo-aware and strong on data-integrity
     smells). If `CODEX_GATE: blocked`, **fix every P0/P1 finding first**, then **re-run the gate**; repeat
     until `CODEX_GATE: pass`. Cap ~3 rounds, then escalate the residual to the user.
   - Re-run the data-reviewer after fixing if its area was touched. Surface P2/P3 advisories as warnings.
7. **Commit** (only after the data-reviewer passes AND `CODEX_GATE: pass`; and only when asked, or when
   invoked by `/triage`). Branch first if on the default branch; scope to the data-fix files only (don't
   sweep unrelated working-tree changes); `Co-Authored-By` trailer.
   File any residual you couldn't fix at source in `docs/status/data_gap_analysis.md` and as a new backlog item.
8. Report: honest before→after numbers, the root cause, files changed, the **inconsistency-sweep results**
   (`/check-data` per feature + each invariant's before→after + the sibling/asymmetry/provenance checks),
   both review verdicts, the commit SHA, and any filed residual.

Cost discipline: ~1 Explore (only if needed) + data-reviewer + codex. No per-step reviewer fan-out. If the
issue is actually a new capability (not a defect), reclassify it as a `(story)`.
