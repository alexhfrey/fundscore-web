# Triage Backlog

One list of everything to do. `/triage` drains it: picks the top **Open** item, routes by
`(type)` to the matching loop, and on success checks it off and moves it to **Done**.

**Format:** `- [ ] (type) Title — one-line context [area]`
**Types & routing:**
- `(bug)` → `/fix-bug` — lean loop: reproduce → fix → verify → review (Claude + codex) → commit.
- `(data)` → `/fix-data` — lean loop: root-cause at source → fix → rebuild → /check-data + data-reviewer → review (Claude + codex) → commit. (No synthetic data; fix upstream.)
- `(story)` → existing feature pipeline: `/critique-funds` → review-proposals → `/spec-approved` → `/implement-next`.

Keep items small and single-purpose. Put the type first so the dispatcher can route without reading the whole line.

---

## Open

- [ ] (data) Gross-expense class-recovery asymmetry [codex P2] — `build_gold_metadata.py::load_expenses` sources `gross_expense_ratio` on a path that filters `class.is_not_null()` WITHOUT `backfill_class_from_document`, while net advances via the backfilled series-history path. For funds whose latest filing is rr/2023 single-class (the ~330 document-recovered rows), net can jump fresh while gross stays stale/null → reintroduces incoherent triples. Fix: apply the backfill in the gross path too. (One-liner; verify with a rebuild.) [fund_score]
- [ ] (bug) MFRR mixed-schema fragility [codex P1] — readers (`pl.read_parquet(files)`, `_read_parquets` vertical_relaxed) require all parquets to share the `document` column; a future PARTIAL MFRR re-extract (or a pre-`document` restore) would throw before class recovery runs. Not breaking now (all 62 quarters re-extracted) but latent. Fix: tolerate a missing `document` column on read. [fund_score: mfrr]
- [ ] (data) FCNTX-class class recovery — ~85% of class-null fee rows still unrecovered (funds with no class-bearing `(series,document)` precedent in the SEC bulk dataset stay null). Explore per-filing R-file parsing or a ticker-based map. [fund_score: alpha/expense.py]
- [ ] (data) 6 incoherent expense triples — bad FILED total/net ER at SEC source for single-class ETFs (e.g. First Trust Natural Gas ETF total ER 0.0% vs 40bps mgmt; MILITIA L/S 10.9bps vs 130bps). Per-filing parser fix to drive the coherence-gate baseline toward 0. [fund_score: mfrr]
- [ ] (bug) VOO-class passive funds serve a null canonical with no explicit `missing_reason` — should label "passive fund, no active-fee-over-passive" instead of an empty `fair_fee`. Frontend-adjacent; coordinate the served shape. [fund_score serving + web]
- [ ] (story) Fee-fairness peer band on the profile page — show where a fund's fee-over-passive sits vs its category peers (percentile), not just the raw bps. [web profile]

## Done

- [x] (data) Canonical fee-over-passive + coherent net/gross/management triple + build-failing gate; root-caused FCNTX staleness → real 0.74%. (fund_score cc180d4, spec → done)
