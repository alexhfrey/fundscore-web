---
name: fundscore-implement-spec
description: Implement exactly one FundScore feature-pipeline spec from `feature-pipeline/specs/queue` or an explicit spec path, then update that spec's status after verification. Use when the user asks Codex to implement a single FundScore spec, a queued spec slug, a backend/frontend feature-pipeline spec, or to port the Claude `/implement-next` workflow without queue looping. Routes by `lane: lean|standard|reviewed`, with data-integrity checks, build/test verification, and an appropriately sized Codex review gate before marking the spec done.
---

# FundScore Implement Spec

## Overview

Implement one FundScore spec end to end without draining the queue. Preserve the Claude workflow's quality gates,
but run it as a Codex-native procedure: inspect the spec, classify the lane, implement the smallest correct
change, verify behavior, run data checks when data is touched, run the lane-sized review gate, and update only
that spec's status.

Lane model:

- `lean`: tiny localized non-data work. Implement directly in the main Codex session; no subagents/workflows.
- `standard`: normal frontend/product work over existing contracts. Implement directly unless the user asked for
  delegation; verify with lint/build/tests.
- `reviewed`: backend data, serving semantics, financial calculations, schema/data migrations, cross-repo
  contracts, or anything where a wrong value would mislead a fund profile. Use the full backend/data discipline.

If `lane` is absent, infer conservatively: frontend specs default to `standard`; backend, full-stack,
`fund_score`, data/serving, financial, schema, and cross-repo specs default to `reviewed`. If a spec says
`lane: lean` but touches reviewed-lane territory, stop and update/report the spec as misclassified; do not use
lean to bypass data gates.

## Inputs

Accept one of:

- A spec slug, resolved as `feature-pipeline/specs/queue/<slug>.md`.
- A spec path.
- A clear "next ready spec" request. Pick exactly one ready queued spec, then stop after that spec.

If no spec is identifiable, ask for the slug or path. Do not silently drain the queue.

Resolve:

- `WEBROOT` as the current `fundscore-web` repo root.
- `FUNDSCORE` from `feature-pipeline/config/page-types.json` at `product.fund_score_repo`.

## Preflight

1. Read the selected spec completely, including frontmatter. Determine `lane`, either from frontmatter or by
   conservative inference.
2. Read the relevant existing Claude instructions only as reference material:
   - `feature-pipeline/README.md`
   - `.claude/commands/implement-next.md`
   - `.claude/workflows/implement-backend-spec.js` for backend-track data specs
   - `.claude/agents/feature-implementer.md`, `.claude/agents/backend-implementer.md`, `.claude/agents/data-reviewer.md`, or `.claude/agents/data-scientist.md` only when that role is relevant
3. Check readiness:
   - If the spec has `depends_on`, verify each dependency slug exists in `feature-pipeline/specs/done/`.
   - If dependencies are missing, stop and report the blocker. Do not bypass dependencies.
4. Inspect `git status --short` in `WEBROOT` and, for backend specs, in `FUNDSCORE`.
   - Do not overwrite unrelated user changes.
   - If unrelated dirty files exist, work around them and report them.
5. If `feature-pipeline/.loop-state.json` exists, read it and mention it if it references the selected spec. Do not resume a Claude Workflow from Codex.

## Implementation

Keep the change scoped to the spec. Do not add synthetic data, inferred values, fabricated fixtures, broad rewrites, or unrelated cleanups.

For lean specs:

1. Confirm the spec still satisfies the lean rules after reading the current code.
2. Implement the smallest local change directly.
3. Run the exact acceptance check and nearest targeted test/lint/build. For frontend UI code, run `npm run lint`
   and `npm run build` unless the change is docs/prompt-only.
4. Do not run data rebuilds or touch generated feature outputs. If that becomes necessary, reclassify to
   reviewed.

For standard frontend specs:

1. Implement in `WEBROOT`.
2. Follow existing Next.js, React, serving, and design patterns.
3. Run `npm run lint` and `npm run build` unless the change is documentation-only or the user explicitly narrows verification.
4. If UI behavior changes, start or reuse the dev server and inspect the affected route in the browser when feasible.

For backend/data specs:

1. Implement in `FUNDSCORE` using that repo's conventions and `uv run` commands.
2. Do a small-scope/sample verification before full rebuilds when the spec changes data production.
3. Rebuild only the affected outputs first, then any serving artifacts required by the spec.
4. Run targeted tests for changed modules.
5. Spot-check served/gold/raw provenance for representative records when data values are produced or transformed.
6. Run the `$check-data` skill after computing or rebuilding any stock/security/fund-level feature data. Provide:
   - feature name
   - data path or glob
   - file format
   - entity column
   - date column
   - universe type
   - report output path
7. Investigate every `FAIL` before proceeding. Report `WARN` items.

For full-stack specs, execute both relevant paths and verify that serving payloads match frontend expectations.

## Review Gate

Before updating the spec to done, run an independent code-review gate on every repo where code implementation landed:

```bash
.claude/scripts/codex-review.sh --uncommitted
```

Run it from `WEBROOT` for frontend/web changes. For backend `FUNDSCORE` changes, use the same script by absolute path from the backend repo:

```bash
CODEX_REVIEW_DIR=/Users/alexfrey/Projects/fundscore-web/feature-pipeline/reviews /Users/alexfrey/Projects/fundscore-web/.claude/scripts/codex-review.sh --uncommitted
```

For `lean` code changes, one default-tier `CODEX_GATE: pass` is enough when the diff remains localized,
non-data, and strongly verified. Escalate to `--high` if the diff grows, touches public financial semantics,
schema/auth/cross-repo contracts, or has weak test coverage. Docs/prompt-only changes may skip codex when
`git diff --check` and the nearest render/lint validation pass; state the skip explicitly.

For `standard` and `reviewed` specs, pick the tier by expected iteration: run `--high` for a likely one-shot, or
iterate at the default medium tier if you expect several rounds and finish at `--high`. If the gate reports
`CODEX_GATE: blocked`, fix every P0/P1 finding and rerun (same tier). Repeat until `CODEX_GATE: pass` or stop
after about three rounds with the remaining blocker clearly reported. A clean `--high` pass
(`codex-review.sh --high --uncommitted`) is MANDATORY before updating the spec to done for standard/reviewed
lanes. Surface P2/P3 findings as advisories.

## Updating The Spec

Only update the selected spec. Do not modify unrelated queued specs.

On success:

1. Add or update an `## Implementation Result` section at the bottom of the spec with:
   - date
   - repos/files changed
   - tests/builds/checks run
   - data-check report path, if any
   - code-review verdict
   - residual warnings or follow-ups
2. Move the spec from `feature-pipeline/specs/queue/` to `feature-pipeline/specs/done/` with `git mv` when it came from the queue.

On blocked or failed verification:

1. Leave the spec in `queue/`.
2. Add or update an `## Implementation Status` section with the blocker, failed command/check, and the next concrete action.
3. Do not claim the spec is complete.

Do not commit unless the user explicitly asks for a commit.

## Final Response

Report:

- spec slug/path and track
- lane used, inferred or explicit
- implementation summary
- files changed, grouped by repo
- verification commands and results
- `$check-data` report and status when applicable
- code-review gate verdict
- whether the spec moved to `done/` or remains in `queue/`
- residual warnings or blockers
