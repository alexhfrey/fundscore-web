---
id: canonical-fee-over-passive-frontend
title: Render ONE canonical fee-over-passive figure across hero, Fee Fairness, and the dollar gap
status: queued
track: frontend
repo: fundscore-web
depends_on: canonical-fee-over-passive-backend
source_proposal: feature-pipeline/proposals/approved/canonical-fee-over-passive-figure.md
created: 2026-06-24
scope: global
---

## Goal
Make the fund profile show exactly ONE "active fee over the closest passive mix" number, sourced from
the new canonical `fair_fee.active_fee_over_passive_bps` field (net ER of the primary class − the
matched passive blend fee), reused verbatim in every place that expresses "what you pay above
passive": the hero Evidence drawer, a renamed Fee Fairness "Fee above passive" stat (see Solution #2
— this is a deliberate SEMANTIC change, not a field swap), and the per-year dollar-gap example. When
the canonical figure is null (the backend could not price the passive blend), suppress the "you pay X
above passive" claim everywhere instead of substituting net ER. Render the now-coherent net / gross /
management-fee triple without ever displaying gross < net.

> BLOCKED BY BACKEND. This spec is not buildable until `canonical-fee-over-passive-backend` is `done`
> and `fund_profile_facts.fees.fair_fee.active_fee_over_passive_bps` (+ `*_missing_reason`) is served.
> The field does NOT exist in the serving layer today — verified: `serving_facts_staging.parquet`
> has no `active_fee_over_passive_bps` value populated (the key reads `None` on every fund checked).
> The two panels disagree TODAY because they read different fields with different definitions: the
> hero reads `valueOfferingReframed.fee.active_fee_bps` (the panel's own net-ER-fallback figure,
> 35.5 bps on FCNTX), while Fee Fairness reads `fees.fair_fee.active_fee_bps` (a MODELED fair active
> fee, 32.29 bps on FCNTX — NOT net-minus-passive; see Context). The exact magnitudes are unstable
> across builds, so this spec anchors its assertions to the relational invariant (all consumers agree
> OR all suppress), not to hardcoded per-fund bps.

## Context (critic evidence — verified against served data + rendered components)
Today the page surfaces THREE different "what you pay above passive" numbers from three sources that
are not the same quantity, plus a gross/net table that is mathematically impossible. Verified on the
current `serving_facts_staging.parquet` row for FCNTX:
- **Hero** (`ValueOfferingHero.tsx:131-136`, Evidence drawer): "Fee: {fmtBps(vr.fee.active_fee_bps)}
  above the closest passive mix (you pay {fmtBps(vr.fee.actual_fee_bps)} total)." Reads
  `valueOfferingReframed.fee.active_fee_bps` → **35.5 bps** on FCNTX. That is just the panel's net ER
  fallback (the panel's `replicable_core_fee_bps` is null in its `.last()` eval row, so it returns the
  full net ER) — it is NOT a true net-minus-passive gap.
- **Fee Fairness "True active fee"** (`FeeFairness.tsx:106-110`): `fmtSignedBps(activeFee)` where
  `activeFee = ff.active_fee_bps` from `fees.fair_fee` → **32.29 bps** on FCNTX. This is the MODELED
  fair active fee (`active_share × (factor_leg + idio_leg)` from the risk decomposition), NOT
  net-minus-passive. Proof it is a model output, not a gap: DODGX `fair_fee.active_fee_bps` = **62.4**
  while its net ER is only 46 and the passive fee is 18 — you cannot "pay 62 over passive" on a 46-bps
  fund; VDIGX = **56.1** with net 22. So the hero (35.5) and Fee Fairness (32.29) disagree on FCNTX,
  and they are measuring two different things under one mislabeled name.
- **Dollar gap** (`FeeFairness.tsx:185-209`, `DollarRow`): computes `gap = fund − passive` from
  `net` (net ER bps) and `passiveBps` — a THIRD implied fee-over-passive number, derived in the
  component rather than read from a canonical field.
- **Expense table** (`FeeFairness.tsx:98-99`): renders `net` and `gross_expense_ratio_bps` straight
  from `fees`; on FCNTX that is net 35.5 / gross 32 → gross < net on screen (FBGRX is worse: net 97 /
  gross 61).
- **The Take** (server-assembled, see Solution #6): TODAY renders the net ER as the "above passive"
  number — FCNTX `assembled_text` says "you pay 36 bps more than the closest passive mix" (net ER
  35.5, not the true gap), DODGX says "46 bps" (net ER 46; the real net-minus-passive gap is 28). It
  cites the bug, not a canonical figure.

These per-fund magnitudes are build-unstable (the backend spec documents the FCNTX figure drifting
32.28 → 35.5 → 32.29 across builds precisely because there is no single owner), so the acceptance
criteria below assert the relational invariant (all consumers agree on the canonical figure, OR all
suppress), never a hardcoded bps.

## Solution
Single source of truth at render time. Backend lands `fees.fair_fee.active_fee_over_passive_bps`
(+ `active_fee_over_passive_missing_reason`) and makes the hero panel's `fee.active_fee_bps` equal to
it. Frontend changes:

1. **Add a tiny serving accessor** so every consumer reads the same field. Extend the `FairFee`
   interface in `src/components/fund/profile/FeeFairness.tsx` with
   `active_fee_over_passive_bps: number | null` and
   `active_fee_over_passive_missing_reason: string | null`. At the same time, reconcile the interface
   with the backend's payload rename: the backend spec renames the served key
   `fair_fee.active_fee_bps` → `fair_fee.fair_fee_active_leg_bps` (the modeled fair-fee leg), so the
   current `active_fee_bps: number | null` field on `FairFee` (line 21) no longer maps to any served
   key and must be either dropped or renamed to `fair_fee_active_leg_bps: number | null`. Since
   Solution #2 repoints the headline stat off the modeled leg and the frontend no longer surfaces it
   as a headline stat, dropping `active_fee_bps` from the interface is the clean choice (pure
   type-hygiene; no behavior change). (No type change is required in `src/lib/serving/profile.ts`,
   where `fees` is already typed `Record<string, unknown> | null`; optionally annotate the
   `ValueOfferingReframed.fee` type comment to note `active_fee_bps` now mirrors the canonical figure.)

2. **Fee Fairness stat — RELABEL, not a field swap** (`FeeFairness.tsx:106-110`). This is a deliberate
   SEMANTIC change: the stat today is labeled "True active fee" and renders `ff.active_fee_bps`, which
   is the MODELED fair active fee (`active_share × (factor_leg + idio_leg)`), a fee-per-active-risk
   estimate that can exceed the fund's own net ER (DODGX 62.4 vs net 46; VDIGX 56.1 vs net 22). The
   canonical `active_fee_over_passive_bps` is a different quantity (net ER − passive blend fee), so
   pointing the stat at it WITHOUT changing the label would put a net-minus-passive number under a
   header that meant "modeled fair value of active management" — the exact incoherence this proposal
   exists to remove.
   - **Relabel the stat to "Fee above passive"** and set
     `const activeFee = ff?.active_fee_over_passive_bps ?? null;` (was `ff?.active_fee_bps`). The new
     label matches the new definition (recomputability: a labeled stat must equal what its label
     claims).
   - **Keep the modeled fair-fee band separate.** The fairness chip (`Strong`/`Mixed`/`Weak`) and the
     "Fair-fee band {fair_fee_bps}" line (`FeeFairness.tsx:74-95`) are driven by `fair_fee_bps` /
     `gap_bps` / `fee_fairness_label`, NOT by `active_fee_bps`, so the band logic is untouched. The
     modeled fair-fee leg is simply no longer surfaced as a headline stat; the backend spec renames it
     (`fair_fee.active_fee_bps` → `fair_fee.fair_fee_active_leg_bps`) so it no longer collides with the
     headline figure, and keeps it in the payload for the Strong/Mixed/Weak chip and `fair_fee_bps`
     build-up. Confirm with the backend (`depends_on`) that dropping the modeled-leg stat from the page
     is intended.
   - When `activeFee == null`, render the existing honest fallback (the component already has the
     `fee_fairness_label == null` Unavailable branch — extend it to the "no passive fee available" case
     with copy like: "We couldn't price this fund's passive mix, so we can't state a fee-above-passive
     number; the net expense ratio above is what the fund charges.").

3. **Hero Evidence drawer** (`ValueOfferingHero.tsx:131-136`): keep reading `vr.fee.active_fee_bps`,
   which the backend now guarantees equals the canonical figure — but when it is null, drop the
   "above the closest passive mix" line and show only the total ("you pay {actual_fee_bps} total"),
   so the hero never invents a passive gap. Add a guard: only render the "above the closest passive
   mix" clause when `vr.fee.active_fee_bps != null`.

4. **Dollar-gap example** (`FeeFairness.tsx` `DollarRow`): the gap dollars must be derived from the
   canonical bps, not recomputed from `net − passiveBps`. Drive `DollarRow` from
   `active_fee_over_passive_bps` directly: show "$X/yr above passive" where `X = feeDollars(
   active_fee_over_passive_bps, notional)`. When the canonical figure is null, show the fund's own
   fee dollars only and suppress the "passive … gap" sub-line. This removes the third (18 bps) number.

   **Rounding contract (required for byte-identical recomputability):** the hero and the Fee-Fairness
   stat display via `fmtBps` / `fmtSignedBps`, which `Math.round` to an integer bps; but `feeDollars`
   multiplies the RAW (unrounded) bps × notional. If the canonical figure is e.g. 17.5 bps, the hero
   shows "18 bps" while the dollar row would compute `17.5/10000 × notional` — the stated bps and the
   implied bps then disagree, breaking recomputability. **Round the canonical bps exactly once** (e.g.
   a `roundBps(active_fee_over_passive_bps)` value computed at the top of `FeeFairness`, mirroring the
   integer the hero shows) and feed THAT single rounded value to all three consumers — the
   Fee-above-passive stat, the dollar-gap math, and the hero (which already rounds via `fmtBps`). The
   displayed bps and the dollar figure must then be exactly recomputable (`roundedBps/10000 ×
   notional`). Do NOT pass raw bps to `feeDollars` for the canonical gap.

5. **Expense table coherence** (`FeeFairness.tsx:97-119`): with the backend fix, gross >= net (or
   gross null). Add a defensive render guard: if `gross_expense_ratio_bps != null &&
   gross_expense_ratio_bps < net` (should never happen post-fix), suppress the gross stat and show
   "—" rather than display an impossible pair. This is belt-and-suspenders; the data layer is the
   real guard.

6. **The Take / Takeaways**: these are assembled server-side in `fund_score` and TODAY render the net
   ER as the above-passive number (the SAME bug — FCNTX `assembled_text` says "you pay 36 bps more",
   DODGX "46 bps", while the true net-minus-passive gaps are ~17.5 and 28). The backend spec makes
   them read the canonical figure. No frontend change is needed beyond the capture test asserting the
   rendered `assembled_text` number equals the hero / Fee-above-passive number post-backend — that
   assertion is the whole point of including The Take in the capture set.

## Files to touch
- `src/components/fund/profile/FeeFairness.tsx` — `FairFee` interface; relabel the stat to "Fee above
  passive"; `activeFee` source; single-round `roundBps` of the canonical figure; `DollarRow` gap
  source; null/suppression states; expense-table coherence guard.
- `src/components/fund/profile/ValueOfferingHero.tsx` — Evidence drawer fee line null-guard.
- `src/lib/serving/profile.ts` — extend the `ValueOfferingReframed.fee` type comment to note
  `active_fee_bps` now mirrors the canonical figure (no structural change needed: `fees` is already
  typed `Record<string, unknown> | null` at `profile.ts:240` and treated opaquely; the `FairFee`
  interface lives only in `FeeFairness.tsx`). No gating change: fee data is already in a public/free
  section and the canonical figure inherits the existing `fees` gate.
- (If a shared formatter helps) `src/lib/serving/format.ts` — reuse `fmtSignedBps` / `feeDollars`; no
  new formatter expected (the single-rounding can be a local `Math.round` in `FeeFairness`).

## Data flow / states
- **Loaded, canonical figure available (the common case):** all three consumers read the single
  rounded `fees.fair_fee.active_fee_over_passive_bps`; identical number everywhere. NOTE: in the
  served data today, the matched passive blend fee is present for every active fund checked
  (`passive_fee_bps = 18.0` on FCNTX/DODGX/VDIGX/FBGRX), so once the backend selects the correct
  non-null as-of row this branch covers the active universe — the null/suppression branch below is a
  defensive guard, not the FCNTX-default path.
- **Loaded, canonical figure null (defensive):** when the backend genuinely cannot price a fund's
  passive blend (`active_fee_over_passive_bps == null` with `*_missing_reason`), suppress the "above
  passive" claim in the hero, the Fee-above-passive stat, and the dollar gap; still show
  net/gross/management and total fee. Whether this branch fires for FCNTX is the BACKEND's decision
  (see `depends_on`): do not hardcode FCNTX as the null case — render whatever the served value
  dictates and assert the relational invariant.
- **Passive fund (VOO):** unchanged — `isPassive` branch already shows cost-comparison instead of an
  active-fee judgment; confirm no "above passive" number leaks.
- **No filed ER:** existing `net_expense_ratio_bps == null` Unavailable branch unchanged.

## Tier gating
No new gating. The `fees` section is already served at its existing tier; the canonical figure rides
the same gate. Confirm `applyGates` still strips the section correctly and that no paid-only field is
introduced (the canonical fee figure is part of the public/free fee comparison, matching today's
`active_fee_bps`/`passive_fee_bps` exposure). No gated data may leak to anon/free.

## Acceptance criteria
- The hero Evidence drawer, the Fee-Fairness "Fee above passive" stat, and the dollar-gap example
  render the IDENTICAL fee-over-passive number on every fund where it is non-null — byte-identical
  because all three derive from a SINGLE rounded value (see Solution #4 rounding contract), and the
  dollar figure recomputes exactly as `roundedBps/10000 × notional`.
- The "True active fee" stat is renamed "Fee above passive" so the label matches the new
  net-minus-passive definition; the modeled fair-fee band (`fair_fee_bps` / `fee_fairness_label` chip)
  is unchanged and the modeled `active_fee_bps` model leg is no longer surfaced as a headline stat.
- When the canonical figure is null for a fund, no "you pay X above passive" number appears in any of
  the three places; the page shows the net/gross/management triple + total fee only, with an honest
  "couldn't price the passive mix" note. (Whether FCNTX hits this branch is backend-governed — assert
  on the served value, not a hardcoded expectation.)
- The expense table never shows gross < net (data-layer guaranteed; component guard as backstop).
- `npm run build` and `npm run lint` pass.
- No gated data leaks to anon/free (verify the `fees` gate in `applyGates`).

## Test plan
Capture the rendered profile for N ≥ 5 tickers and assert the RELATIONAL invariant (the three
consumers agree on the canonical figure, OR all suppress). Pre-fix per-fund magnitudes are
build-unstable, so anchor assertions to the relation, not to a hardcoded pre-fix number. Expected
post-backend magnitudes (canonical = primary-class net ER − passive blend fee 18 bps, served today):
- **FCNTX** — multi-class / corrupted-net case: after the backend's primary-class net-ER fix net ≈ 39
  bps and the expense triple is coherent (gross >= net). The canonical figure is whatever the backend
  serves (a real gap if the passive blend is priced — net 39 − passive 18 ≈ 21 bps — or null with a
  reason if not); assert the three consumers AGREE on it or ALL suppress. Do not assert a specific
  pre-fix value.
- **DODGX** — priced passive: canonical ≈ 28 bps (net 46 − passive 18); dollar gap on $100k ≈ $280/yr.
  Confirm this REPLACES the prior net-ER-based ~46 bps / ~$460 figure — the displayed dollar number is
  EXPECTED to change, that is the fix working, not a regression.
- **VDIGX** — priced passive: canonical ≈ 4 bps (net 22 − passive 18); a near-zero gap is the correct
  result (cheap fund), distinct from today's modeled "True active fee" of 56.1 bps.
- **FBGRX** — priced passive + impossible expense pair today (net 97 / gross 61): canonical ≈ 79 bps
  (net 97 − passive 18); confirm gross >= net post-fix.
- **VOO** — passive fund: cost-comparison branch only, no active-fee-over-passive figure rendered.
Compare hero vs Fee-above-passive stat vs `theTake.assembled_text` numbers in each capture; flag any
mismatch. The Take must now state the canonical gap (DODGX "28 bps", not the pre-fix "46 bps").

## Out of scope
- Changing the Fee Fairness band logic (`fair_fee_bps` / `gap_bps` / `fee_fairness_label` chip) or the
  badge typology — only the headline "active fee" stat is repointed and relabeled.
- Pricing any fund's passive mix (a backend coverage task; here we suppress honestly when the canonical
  figure is served null).
- Defining the canonical figure or fixing the corrupted FCNTX net ER — owned by
  `canonical-fee-over-passive-backend` (`depends_on`). This spec only renders what the backend serves.

## Risks
- If the backend ships the canonical field but does NOT make `vr.fee.active_fee_bps` read-through, the
  hero and Fee-above-passive stat could still diverge — the capture test must compare the two sources
  explicitly.
- **Relabel risk:** the "True active fee" → "Fee above passive" rename changes what the stat MEANS
  (modeled fair active fee → net-minus-passive gap). Confirm with the backend (`depends_on`) that the
  modeled `fair_fee.active_fee_bps` leg is intentionally dropped from the headline; if product wants
  to keep the modeled leg too, surface it under its own distinct label rather than overloading one.
- **Rounding:** the displayed bps and the dollar math must be recomputable. The rounding contract in
  Solution #4 (round the canonical bps once, feed the same rounded value to all three consumers)
  eliminates the half-bps mismatch risk; the capture test must verify `dollarGap == roundedBps/10000 ×
  notional` exactly, not against the raw served bps.
- Switching the dollar gap to the canonical bps changes the displayed dollar figure on funds where the
  old component math (`net − passive`) differed from the canonical definition (e.g. DODGX $460 → $280
  on $100k); this change is EXPECTED and is the fix working — the capture test states the new values
  so a changed number reads as success, not a regression.
