# PRD: Monitoring & Alerts — "know when the investment changes"

- **Slug:** monitoring-and-alerts
- **Source:** home-page value prop (`fund_score/docs/product/page_specs/home.md` § 6). Filed
  2026-07-17 from the home-page gap pass; the copy commits us to this experience and nothing
  covering it exists.
- **Date:** 2026-07-17
- **Status:** DRAFT — needs owner answers on the Open questions before a spec is written. This PRD
  deliberately does NOT design the pipeline or serving layer (owner: "don't build the comprehensive
  plans yet").
- **Track (proposed):** full-stack (fundscore-web new surface + fund_score drift signal), likely
  phased. Reuses shipped change-detection panels; the new work is the watch list, the drift
  threshold logic, and a delivery channel.

## Problem

The home page (§ 6, "Know when the investment changes") promises:

> A fund can keep the same name while quietly becoming a very different investment. FundScore tracks
> changes in a fund's positioning and tells you when it drifts from the role you hired it to play.

Today there is **no such experience** — no route, no spec, no backlog item. The nearest shipped
things are different concepts:

- **Lens change-tracking notifications** (`SaveLensStrip.tsx`) — deltas on a *saved screen's result
  set*, not a fund's own drift.
- **Fund-page "recent positioning changes"** (`recent-changes-te-ranked`, `positioning_changes`
  panel) — a *descriptive, on-page, single-fund* section. No watch, no user's expectation, no
  notification.

So the promise is a clean gap. This is the one net-new *surface* the home-page copy commits us to
(everything else is an extension of the X-Ray, screener, or fund profile).

## Who & why

- **Retail holder** who bought a fund for a reason ("my international diversifier", "my low-vol
  sleeve") and wants to be told — without re-checking — when it stops playing that role: a new
  sector bet, a drifting factor tilt, a manager change, a fee hike, a big turnover spike.
- **RIA / advisor (second audience)** monitoring a book of funds across clients; the value is
  catching drift from an intended mandate before a client does.

Why us: we already compute the drift signal (quarter-over-quarter positioning / exposure / factor /
manager change) per fund from SEC filings. The differentiator is that the alert is grounded in
*what changed underneath*, not price movement.

## What it does (behavior)

At the behavior level (not the how):

- A user **follows** funds (a watch list) — likely seeded from funds they've viewed, X-ray'd, or
  hold in a saved portfolio.
- FundScore **watches each followed fund for drift** from a baseline the user can understand: its
  own recent history and/or the role the user attached to it.
- When a fund **crosses a materiality threshold** on a monitored dimension (positioning / sector /
  theme / factor tilt / concentration / manager / fee / turnover), the user is **notified** with a
  plain-English, evidence-linked readout: what changed, by how much, as of which filing, and a link
  to the fund's positioning-changes section.
- Alerts are **descriptive, never advice** — "this fund's technology exposure rose 14pp since Q2 and
  a new manager took over in March," never "consider selling." Same copy charter as the fund page.
- Honest-missing throughout: no alert fabricated from stale or low-coverage data; a fund we can't
  currently read cleanly says so rather than going silent-as-if-unchanged.

## In scope (candidate — pending Open questions)

- A followed-funds / watch-list concept and its storage (hot path, row-keyed — like Lenses).
- Drift detection on the already-computed change signals (positioning, exposure, factor, manager,
  fee, turnover) with per-dimension materiality thresholds.
- A notification surface: at minimum an in-app "what changed in your funds" feed; email is an Open
  question.
- Non-advice, evidence-linked alert copy tied to the fund's existing positioning-changes section.

## Out of scope (for v1 unless an Open question flips it)

- Portfolio-level drift (alerting on a whole X-ray'd book's aggregate exposure moving) — a natural
  follow-on once single-fund alerts land; not v1.
- Price / performance / drawdown alerts — this feature is about *what the fund holds and who runs
  it* changing, not market moves. Keep it differentiated from every broker's price alert.
- Predictive alerts ("this fund is likely to underperform") — banned by the copy charter.
- Real-time / intraday — the signal is filing-cadence (quarterly N-PORT, event-driven manager/fee
  changes); alert latency is bounded by filing lag, and the copy must be honest about that.
- New drift *math* beyond what the change panels already produce, until v1 proves the surface.

## Acceptance (testable)

Deferred to the spec once the Open questions are answered. Acceptance numbers live in the spec, not
here (per `prds/README.md`). At minimum the spec must pin: which dimensions trigger, the materiality
threshold per dimension, the false-positive rate on a labeled sample, the non-advice copy gate, and
the honest-missing behavior when a followed fund's data is stale/low-coverage.

## Open questions (owner) — must answer before speccing

1. **What defines "the role you hired it to play"?** Three options, increasingly ambitious:
   (a) drift vs the fund's **own recent history** (purely factual, no user input; easiest, ships on
   the existing change panels); (b) drift vs a **role the user tags** at follow-time (e.g. "I hold
   this as my EM sleeve"); (c) drift vs the fund's **stated mandate / passive alternative**. Which
   baseline is v1? *(Recommendation: (a) for v1 — it's the honest, zero-personalization version and
   sits directly on shipped data; layer (b)/(c) later.)*
2. **Which dimensions alert in v1?** Positioning/sector/theme and manager change are the strongest
   ("same name, different investment"). Include factor-tilt drift, concentration, fee hikes,
   turnover spikes? More dimensions = more noise. *(Recommendation: start with sector/theme
   positioning drift + manager change + fee hike — the three a retail holder would call "a different
   fund" — and add factor/concentration once thresholds are calibrated.)*
3. **Delivery channel for v1.** In-app feed only, or in-app + email? Email adds consent, deliver/
   unsubscribe, and cadence (immediate vs digest) scope. *(Recommendation: in-app feed first, email
   digest fast-follow.)*
4. **How does a user start following?** Explicit "Follow this fund" button, auto-follow funds in a
   saved portfolio / recently viewed, or both? Ties into whether this is portfolio-driven or
   fund-driven.
5. **Tier gating.** Free (limited follows) vs paid (unlimited + email)? Where does the anonymous/
   free/paid/pro line fall, consistent with Lenses and the X-Ray?
6. **Materiality / noise tolerance.** How aggressive should thresholds be — one clear alert a
   quarter per fund, or every material change? This is the make-or-break UX call; too noisy and it's
   uninstalled, too quiet and it misses the drift.
7. **Portfolio-level v1 or not?** Is the first version fund-by-fund (follow individual funds), or
   does it alert on the aggregate exposure of a saved X-ray'd portfolio? (Out-of-scope above assumes
   fund-by-fund first — confirm.)

## Evidence (grounding, 2026-07-17)

- No monitoring/alerts route, spec, backlog item, or proposal exists (exhaustive grep across
  `feature-pipeline/` and `fundscore-web/src/`). App routes: screener, search, lens, q, xray, funds,
  methodology, admin, signin, preview.
- The drift signal already ships per fund: `positioning_changes` panel (sector/theme/top-10/
  single-name entered-exited-increased-decreased, `change_z`, persistence), manager/people gold,
  fee/turnover panels. `recent-changes-te-ranked` (queued) ranks positioning changes by
  tracking-error impact — a natural input to alert materiality.
- Lenses already model a row-keyed hot-path "saved object + change-tracking" pattern
  (`lens_snapshots`, `SaveLensStrip`) that a follow-list can mirror.

## History

- Rev 1 (2026-07-17): filed from the home-page value-prop gap pass. Behavior + open product
  questions only; no pipeline/serving design (owner deferral). Backlog: the `(story)` line in
  `backlog.md` § Open, "Value-prop delivery group."
