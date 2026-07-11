---
id: ai-summary-generation
title: Generate the per-fund AI summary from served facts only, behind an in-code fact-grounding gate
status: queued
track: backend
repo: fund_score
depends_on: fund-named-manager-source, profile-nav-series, attribution-factor-path-serving, fund-family-panel
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-01
scope: global
model: fable
---

## Goal
Serve the profile's AI Summary section: 2–4 paragraphs of plain-English narrative per fund — what
it is, the value read vs its named passive alternative, the defining bets and what they've
contributed, fees in context, risk profile, recent manager activity, manager tenure, and honest
risks to the read. Sample target copy (hand-written, fact-grounded) lives in
`fundscore-web/feature-pipeline/captures/fund_profile__FCNTX/_mock_data_v5.json → ai_summary`.
**This is the riskiest spec in the redesign set and is deliberately sequenced last**, behind the
data products whose numbers the narrative cites.

**Owner decision 2026-07-11: de-scoped from the V1 production cutover to a post-launch
fast-follow.** `profile-v2-production-cutover` no longer depends on this spec; V1 ships with
seven sections and the AI Summary section stays absent in production until this ships and flips
under the per-section protocol.

## Context
- No LLM infra exists in fund_score today. Precedent for the client: the manager spec's validated
  addendum (qwen3-8b via OpenRouter, `temperature=0`, `trend-swing/llm_features/providers.py
  call_llm()` — vendor a minimal OpenAI-compatible client into fund_score so the build owns its
  dependency; keys via env, never committed).
- Model-honesty precedent from the manager head-to-head: **qwen3-8b returned honest-empty where
  qwen3-32b fabricated 6 committee members.** Model choice is a data-integrity decision; start with
  qwen3-8b and re-validate on any model change.
- Long-run operational memory: run long LLM batch builds directly (background bash, isolated output
  paths), never via a subagent that orphans them.

## Computation
1. **Input = the fund's assembled fact row ONLY** — the same JSON `fact_assembler.py` serves
   (identity, value_score, fees, exposure_xray named bets, return_attribution, positioning_changes,
   positioning_context, te_decomposition, fund_family, manager_parent, nav_series period table).
   Never raw filings, never external knowledge. The prompt embeds a whitelisted, unit-labeled fact
   table extracted from the row.
2. **Prompt contract**: cover (a) what the fund is + the value read vs the NAMED passive alternative
   with its fee; (b) the defining bets with their attribution; (c) fees in fair-fee context;
   (d) risk profile with percentile context; (e) recent changes; (f) manager tenure/transition
   (from `manager_parent.managers[]`); (g) risks to the read. Style: refined honesty — number not
   adjective, P(skill) as historical evidence, breakeven framed as breakeven, no advice/prediction.
3. **Fact-grounding gate — in code, never trusted to the model**:
   - **Numeric grounding**: every number token in the output (unit-aware: bps, %, pp, $B, years,
     dates, percentiles, ranks) must exactly match a value in the whitelisted fact table. Any
     unmatched number ⇒ reject the whole summary.
   - **Visibility grounding** (added 2026-07-01 after the codex adversarial review of the design
     mock caught exactly this failure): the whitelisted fact table is restricted to facts the
     PAGE RENDERS — a summary must never cite a number the reader cannot find in the visible
     evidence sections below it (the mock cited Brinson sector figures from a basis the page did
     not display). Build the whitelist from the section payloads the profile actually serves and
     shows, not from the full gold layer.
   - **No placeholder leakage**: generated copy must contain no bracketed editorial placeholders
     or TODO-style text; data gaps are expressed as plain-English absence ("Manager names and
     tenure are not yet part of our sourced data") — a gate reject pattern, not a style hope.
   - **Claim rules**: reject on advice/prediction verbs ("will", "should", "buy"), superlative
     overclaims, forecast-framing of P(skill), or an unnamed baseline next to a value/fee claim
     (lexical + pattern checks; enumerate the rule list in the implementation).
   - **Entity grounding**: tickers, ETF names, factor/sector/theme names, and manager names must
     appear in the fact table (no invented entities).
   - **Fail ⇒ serve null** (honest absence via the existing `Unavailable` pattern). Never serve a
     degraded/truncated summary. Retry budget (e.g. 2 regenerations) then give up per fund.
4. **Incremental regeneration**: store `facts_hash` (stable hash of the whitelisted fact table);
   rebuilds regenerate only funds whose hash changed. Batch cost estimated in EDA (qwen3-8b
   precedent: dollars for a long-tail batch; full 2–8K-fund universe expected O($10s), verify).

## Output
- `data/gold/ai_summaries.parquet`: `series_id, paragraphs[], model, generated_at, facts_hash,
  gate_report (pass/fail + reject reasons), method_version`.
- Serving: new `ai_summary` JSONB section (`{paragraphs, generated_at, model, facts_hash}`) in
  `fact_assembler.py`; `aiSummary` column in `fundscore-web/src/lib/db/schema/serving.ts`.
  Proposed gate: free, with the first sentence public as the preview proof point.
- UI disclosure (frontend spec): "AI-generated from FundScore's served data" label — the section
  never renders unlabeled.

## Data-integrity guardrails
- Facts-only input; in-code gate; null-on-fail — the three load-bearing walls. No exceptions for
  "obviously fine" copy.
- The gate is a build artifact: `gate_report` persists per fund so failures are auditable, and the
  validation report states pass-rate + top reject reasons (coverage is a headline metric here too:
  % of scored funds with a served summary, honest-missing vs gate-rejected).
- Determinism: `temperature=0`; regenerations only on fact-hash change or gate failure.
- Tier-gating coherence: the summary must not leak paid-only precision to free users — EITHER
  generate from the free-tier projection of the fact row, or gate the full summary paid with a
  free first sentence generated from free facts. Decide in EDA; the gate must enforce whichever
  contract is chosen (no paid number may appear in the free-visible sentence).

## EDA questions
1. Prompt/gate dry-run on 20 diverse funds (large active, passive index, negative-value, thin-data,
   suppressed-attribution): gate pass rate, failure taxonomy, cost per fund, latency.
2. The tier-leakage design decision above.
3. Readability check vs the hand-written FCNTX sample: does generated copy match its quality bar?
   (Owner reviews 5 samples before batch.)

## Acceptance criteria (relational)
- 100% of SERVED summaries pass the numeric/entity/claim gate by construction (the gate runs at
  build; serving reads only gate-passed rows).
- For 5 spot-check funds: every number in the served summary is traceable to the fund's fact row
  (manual audit); FCNTX's summary names IWF + its fee next to the value claim.
- Funds failing the gate serve `ai_summary: null` and appear in the gate report with reasons.
- Rebuild with unchanged facts regenerates nothing (facts_hash stability); `/check-data` passes on
  the parquet.

## Out of scope
- Chat/Q&A; per-section AI text; model fine-tuning; multi-language.

## Risks
- **Hallucination** — mitigated by the three walls; the gate catches what the model invents.
- Stiff, gate-shaped prose (the gate rejects paraphrased numbers, so the model may over-quote) —
  acceptable v1 trade; iterate on prompt, never on gate laxity.
- Cost/latency drift on universe growth — facts_hash makes rebuilds incremental.
