---
id: fund-inception-relabel-inline-freshness
title: Relabel series inception as share-class inception + move freshness stamps inline
status: queued
track: frontend
repo: fundscore-web
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/fund-identity-manager-freshness.md
created: 2026-06-24
scope: global
---

## Goal
Stop the page from implying a fund's whole life began at its earliest *share-class*
inception, and stop using stale fee/holdings figures silently. Two changes, both buildable
TODAY from fields already served (no backend dependency):

1. **Relabel the Inception stat** — `identity.inception_date` is the earliest *share-class /
   series* inception filed in MFRR, not the strategy's true launch (FCNTX shows 2008-05-09
   though Contrafund launched 1967). Relabel the stat "Share-class inception" and caption the
   returns-based skill window (`skill_evidence.t_years`) as a *data-availability window*, not the
   fund's age.
2. **Move freshness stamps inline** — the per-domain as-of dates and `stale` flags already live
   in the served, public `source_inventory.source_stamps` (expense as-of 2024-03-31 `stale`,
   holdings 2025-09-30 `stale`). Today they sit only in the footer. Surface the relevant stamp
   inline on the readout that depends on it (expense as-of on Fee Fairness; holdings as-of/stale
   on holdings-dependent sections), so a stale figure is never read as current.

## Context (critic evidence)
- Data-quality + narrative converged (proposal `source_critiques: [data-quality, narrative]`).
- Served `identity.inception_date` = `2008-05-09`; `skill_evidence.t_years` ≈ 17.4 — both real,
  both correct *as share-class facts*, but the page frames them as the fund's life.
- Root cause confirmed in `fund_score/scripts/pipeline/build_gold_metadata.py::load_inception_dates`:
  it takes the **earliest `inception_date` field across the series' share classes** from MFRR. MFRR
  carries only share-class inception, so the true 1967 strategy inception is **not in the data** —
  resolving it is a separate backend prerequisite (see `fund-true-strategy-inception` if/when
  filed). This spec does the relabel + framing only; it does NOT invent a 1967 date.
- `source_inventory` section gate is `public` (verified in `serving_facts_staging.parquet` for
  FCNTX). Each stamp carries `source_domain`, `as_of_date`, `status` ∈ {available, stale, missing}
  (verified counts across the 8,656 served funds: expense = {available 5,624, stale 2,967, missing
  65}; holdings = {stale 6,776, missing 1,880} — holdings is **never** `available`, and a `missing`
  stamp always has a null `as_of_date`). The
  footer (`SourceFooter.tsx`) already lists them; the warnings panel already emits
  `holdings_stale_180d` and `pricing_stale` for FCNTX. We are re-surfacing existing facts inline,
  not adding data.

## Solution
**A. Inline-freshness helper (`src/lib/serving/profile.ts`)**
Add a small typed reader over the already-served source stamps:
```ts
// status ∈ {"available", "stale", "missing"}. A "missing" stamp always carries a
// null as_of_date, so consumers must treat "missing" exactly like an absent stamp
// (suppress the as-of affordance, fall back to base copy). Only "stale" prints a
// carried/older-than affordance.
export type StampStatus = "available" | "stale" | "missing";
export interface SourceStamp { source_domain: string; as_of_date: string | null; status: StampStatus | null }
export function stampByDomain(src: { source_stamps?: SourceStamp[] } | null, domain: string): SourceStamp | null
```
It reads `row.sourceInventory.source_stamps` (camelCase column → snake_case keys) and returns the
stamp for a domain or null. No DB change; `source_inventory` is already public, so no gating concern.

**B. IdentityStrip relabel (`src/components/fund/profile/IdentityStrip.tsx`)**
- Change the fourth `<Stat>` label from `"Inception"` → `"Share-class inception"` (keep
  `fmtDate(identity.inception_date)`; em-dash when null).
- Add a one-line `sub` caption on that Stat: "earliest share class" (mirrors the existing `sub`
  pattern already used on the Holdings stat). Do NOT assert a strategy inception we don't have.

**C. Frame the skill window as data-availability (`src/components/fund/profile/SelectionEvidence.tsx`)**
- In the "Returns-based skill evidence" card, the copy already reads "from the fund's own track
  record (`{t_years}` years)". Reword to make clear this is the **measurable** window, not the
  fund's age — e.g. "over the `{t_years}` years of return history we can measure" — so a reader
  doesn't equate 17 years of data with a 17-year-old fund. Copy-only; no data change.

**D. Inline expense as-of on Fee Fairness (`src/components/fund/profile/FeeFairness.tsx`)**
- The component already renders an `<AsOf>` line ("Expense data: SEC MFRR / prospectus filings.").
  When `expenseStamp?.as_of_date != null`, append the real expense stamp:
  `as of {fmtDate(expenseStamp.as_of_date)}` and, when `expenseStamp.status === "stale"`, a muted
  "(carried — awaiting newer filing)" note.
- **Guard on the as-of date, not on stamp presence.** Every served fund carries an expense stamp
  (0 of 8,656 are absent), so the real degraded path is a stamp with `status === "missing"` and a
  null `as_of_date` (65 funds, e.g. `CHNTX`). Branching on `as_of_date != null` is required —
  `fmtDate(null)` returns `EM_DASH`, so the naive `as of {fmtDate(...)}` would render the literal
  "as of —" for those funds.
- Pass an optional `expenseStamp` prop from `page.tsx` via `stampByDomain(row.sourceInventory, "expense")`.
  Component stays pure; falls back to today's copy when the stamp is absent **or its `as_of_date` is
  null** (i.e. `status === "missing"` is treated exactly like an absent stamp — no as-of line).

**E. Inline holdings as-of where holdings drive the readout (`page.tsx` + section components)**
- IdentityStrip already shows holdings `as of {holdingsAsOf}`. Add a small stale affordance
  (`stampByDomain(... ,"holdings")` → when `status === "stale"`, render a muted "· stale" / older-
  than-180-days note next to the existing as-of). Reuse the existing `AsOf` lines in
  ExposureXray / SelectionEvidence rather than introducing a new banner — these sections already
  print holdings as-of; ensure the stale flag rides alongside the date.
- Holdings stamps are **never** `available` in the served data (6,776 `stale` + 1,880 `missing` of
  8,656). Keying the affordance on `status === "stale"` is therefore correct: a `missing` stamp
  (null `as_of_date`) is treated exactly like an absent one — no "· stale" note, fall back to the
  existing `holdingsAsOf`/em-dash copy.

Loading/empty/locked states: every addition degrades to existing copy or em-dash when the stamp is
missing or the section is `{locked}`. Tier gating: unchanged — `source_inventory`, `identity`,
`fees` are all `public`; no gated field is newly exposed.

## Files to touch
- `src/lib/serving/profile.ts` — add `SourceStamp` type + `stampByDomain()` reader.
- `src/components/fund/profile/IdentityStrip.tsx` — relabel + sub-caption the inception Stat;
  thread holdings stale flag into the existing `as of` sub.
- `src/components/fund/profile/FeeFairness.tsx` — accept `expenseStamp` prop; append inline as-of +
  stale note to the `<AsOf>` line.
- `src/components/fund/profile/SelectionEvidence.tsx` — reword the skill-window copy as a measurable
  data window.
- `src/app/funds/[ticker]/page.tsx` — compute `stampByDomain(...)` for `expense`/`holdings`, pass
  down as props.

## Data dependencies (exact `fund_profile_facts` fields)
- `identity.inception_date` (string|null) — **present**, public.
- `manager_parent.skill_evidence.t_years` (number|null) — **present**, gate `free`. (Copy reword
  lives inside the already-rendered card; no new field.)
- `source_inventory.source_stamps[]` with `{source_domain, as_of_date, status}` — **present**,
  public. Domains used: `expense`, `holdings`.
- No missing field. No backend blocker for THIS spec. (The true strategy-inception date and the
  named PM are tracked separately and are NOT required here.)

## Acceptance criteria
- `npm run build` and `npm run lint` pass.
- FCNTX: Inception stat reads "Share-class inception 2008-05-09 · earliest share class"; Fee
  Fairness `<AsOf>` shows "as of 2024-03-31 (carried — awaiting newer filing)"; holdings as-of
  shows the stale affordance.
- A passive fund (VOO) and a fund without a stale expense stamp render cleanly (no "(carried…)"
  note, no broken em-dash).
- No gated data leaks: anon/free payload is unchanged for `source_inventory`/`identity`/`fees`
  (all already public); diff the anon vs paid payload to confirm no new field crosses a gate.
- No invented dates anywhere — strategy inception is NOT shown; only the served share-class date.

## Test plan
Render 5 tickers and capture the inception stat + the inline as-of lines: `FCNTX` (stale expense +
stale holdings, share-class < strategy), `VOO` (passive, fresh-ish), `DODGX` (old active fund),
`FBGRX` (theme-heavy active), and `CHNTX` — a real served fund whose `expense` stamp has
`status === "missing"` and a null `as_of_date` (no served fund actually *lacks* an expense stamp;
all 8,656 carry one). This is the genuine degraded path: verify the Fee Fairness `<AsOf>` line
falls back to the base copy with **no** "as of —" literal and no "(carried…)" note. Confirm anon,
free, and paid renders are identical for these public sections.

## Out of scope
- Named portfolio manager, tenure, manager-change/retirement flag (separate backend + frontend
  specs — `fund-named-manager-source` / `fund-named-manager-ui`).
- Resolving the true 1967 strategy inception date (needs a new external source; backend
  prerequisite, not filed here).
- Any new DB column or `fact_assembler` change.

## Risks
- Over-claiming: do NOT imply we know the strategy inception. "Share-class inception" + "earliest
  share class" is the honest, defensible framing from the data we have.
- Copy drift: keep the Confident-Consumer tone (plain, calm, no fear-selling). The stale note is
  informational, not alarmist.
