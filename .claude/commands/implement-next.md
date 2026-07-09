---
description: Implement the next ready spec from the queue, routing by lean/standard/reviewed lane
---
Implement ONE ready spec from `feature-pipeline/specs/queue/`. Designed to be looped:
`/loop /implement-next` drains the queue one spec at a time.

Lane model:
- `lane: lean` — main session implements directly. Use for tiny, localized non-data work with concrete
  acceptance checks. No implementer agent and no backend workflow.
- `lane: standard` — one frontend/product implementer agent plus build/lint/tests and codex review.
- `lane: reviewed` — backend/data/high-risk assembly line with EDA, data-reviewer checkpoints, `/check-data`,
  and final review.

If a spec has no `lane` frontmatter, infer conservatively: `track: frontend` → `standard`; `track: backend`,
`track: full-stack`, `repo: fund_score`, data/serving-fact semantics, financial calculations, schema/data
migrations, or cross-repo contracts → `reviewed`. If a spec says `lane: lean` but the contents touch any
reviewed-lane area, override to `reviewed` or STOP and fix the spec; never use lean to bypass data gates.

Steps:
0. **Resume check (limit/crash resilience).** If `feature-pipeline/.loop-state.json` exists, a prior
   iteration was interrupted (token limit, crash) — resume IT before picking anything new:
   - `lane: reviewed` (or legacy `track: backend`) → relaunch Workflow with the SAME `scriptPath`/`args` plus
     `resumeFromRunId: <runId from the state file>`. Completed segments replay from the journal
     cache (no re-spend); only the interrupted segment re-runs.
   - `lane: standard` (or legacy `track: frontend`) → SendMessage to the recorded `agentId`
     ("resume where you left off") —
     never relaunch fresh (that re-pays the agent's whole read phase).
   - `lane: lean` should not normally create `.loop-state.json`; if such a state exists, read it, report the
     inconsistency, delete it only if the spec is already done, otherwise continue the lean work in this main
     session.
   - If the recorded work actually finished (spec already in `done/`), just delete the state file
     and continue to step 1.
1. Resolve WEBROOT (fundscore-web absolute path) and FUNDSCORE (`product.fund_score_repo` from
   `feature-pipeline/config/page-types.json`).
2. Pick the next **ready** spec: the oldest `*.md` in `feature-pipeline/specs/queue/` whose
   `depends_on` is empty OR whose dependency slug already has a spec in
   `feature-pipeline/specs/done/`. **If an argument names a spec slug** (`/implement-next <slug>`),
   pick that spec instead — but only if it is ready; if its dependencies aren't done, say which and
   STOP (never bypass depends_on). If nothing is ready (queue empty, or all remaining specs are
   blocked by unfinished backend dependencies), say so clearly and STOP — that is the honest
   "nothing to do" signal that ends a `/loop`.
3. Read the spec's frontmatter: `track`, `repo`, optional **`lane`** (`lean | standard | reviewed`), and the
   optional **`model`** (`fable | opus | sonnet`) and **`effort`** (`low | medium | high | xhigh`) routing hints.
   These pin which model implements the spec — set at spec-writing/triage time so nobody has to remember
   per-spec model choices. Absent model/effort fields = session default. Absent lane = infer by the rules above
   and state the inference in the report.
4. **Re-ground the spec against the CURRENT code/data (staleness gate — do this BEFORE dispatching).**
   A queued spec was grounded when it was written; the code and data may have moved since, and an
   implementer will confidently build against references that no longer exist. Confirm every concrete
   claim the spec makes still resolves in the current tree:
   - Enumerate the spec's checkable references: named columns / serving-facts fields, gold/product
     panels and parquet paths, table & schema names, `file:line` anchors, and the functions/modules it
     says to modify.
   - Verify each still exists NOW. **Lean specs** → do this inline and keep it tight: check only the named
     files/functions/fields the spec will touch, plus the acceptance target. If that sweep expands beyond a
     few references, reclassify to `standard` or `reviewed`. **Frontend specs** → Grep the Drizzle serving schema
     (`WEBROOT/src/lib/db/schema/`), the data layer, and the component/route paths. **Backend/reviewed specs** →
     Grep the builders/serving modules in FUNDSCORE and confirm each named column actually exists in the
     real gold/product parquet (a quick `duckdb`/`uv run python` read of the panel schema) — not merely
     that the field name appears in the spec's prose. Delegate a broad sweep to one `Explore` agent if
     the spec references many things.
   - **All references resolve →** continue to step 5.
   - **Any reference is missing / moved / renamed →** do NOT build against a stale spec. Bounce it: hand
     the spec to the revise flow (`/review-specs`, which runs `revise-specs` — the spec-writer re-grounds
     it against current code), then re-run this gate. If it can't be cleanly re-grounded because the data
     it needs genuinely no longer exists (a real scope change, not a rename), STOP and surface it to the
     owner: leave the spec in `queue/` with a ` — STALE: <what moved>` note. Never implement a spec whose
     references don't resolve.
5. **Route by lane.**
   - **`lane: lean`** → implement directly in the main session:
     1. State why the lean lane is still safe after re-grounding.
     2. Inspect `git status --short` in the affected repo(s) and avoid unrelated dirty files.
     3. Make the smallest root-cause edit; do not spawn an implementer agent.
     4. Run the concrete acceptance check and the nearest targeted test/lint/build. For frontend UI changes,
        run `npm run lint` and `npm run build` unless the change is clearly docs/prompt-only.
     5. Apply the lane-specific codex gate in step 6.
     6. On success, add/update an `## Implementation Result` section, `git mv` the spec to `specs/done/`,
        reconcile the backlog, and commit when this command is being used as the triage/implementation loop.
   - **`lane: standard` or `lane: reviewed`** → write the checkpoint BEFORE dispatching:
     `feature-pipeline/.loop-state.json` =
     `{ slug, track, lane, specPath, started: <ISO>, runId?: <Workflow runId once known>, agentId?:
     <Agent id once known>, args?: <the backend workflow args> }`. Update it with the
     runId/agentId as soon as the dispatch returns. DELETE it in step 7 when the spec moves to
     `done/` (or on a clean blocked/failed stop — the file means "interrupted", not "failed").
     The file is gitignored state, not history.
   Then dispatch:
   - **`lane: standard`** → spawn the **feature-implementer** agent (Agent tool, `subagent_type:
     "feature-implementer"`; if it doesn't resolve in this session, use a general-purpose agent told
     to read `WEBROOT/.claude/agents/feature-implementer.md` first). Give it the spec's absolute path.
     Working dir = WEBROOT. Pass the spec's `model` as the Agent tool's `model` param when present.
     (`effort` is not settable on the Agent tool — for frontend specs it is advisory only.)
   - **`lane: reviewed`** → run Workflow with `scriptPath` =
     `WEBROOT/.claude/workflows/implement-backend-spec.js` and `args` =
     `{ webRoot: WEBROOT, fundScoreRoot: FUNDSCORE, specPath: <abs spec path>, slug: <slug>,
     model: <frontmatter model or omit>, effort: <frontmatter effort or omit> }`.
     This is the reviewed assembly line (EDA → implement → data-reviewer checkpoint after each step
     → one combined final data gate [served==gold + /check-data] → codex-gated commit), which halts
     on any FAIL and fails closed (a non-pass codex gate or a killed finalize returns `stopped`,
     never `done`). The model/effort override applies to implementer segments only; reviewer/EDA
     gate agents stay on the session default.
6. **Codex sign-off gate (MANDATORY for code changes, lane-sized).** After the implementation's own gates
   pass, run the gate from the repo the change landed in (WEBROOT for frontend, FUNDSCORE for backend) —
   `~/Projects/fundscore-harness/plugins/fundscore-data/scripts/codex-review.sh --uncommitted` (the plugin
   is the single source of truth; the WEBROOT `.claude/scripts/codex-review.sh` wrapper also works for
   frontend, but the harness path works from either repo).
   The script runs **deep reasoning by default — one clean pass IS the gate**; there is no medium→high
   ladder to climb (`--medium` exists only for cheap intermediate rounds when you genuinely expect several;
   a medium pass never gates anything). Docs/prompt-only changes may skip codex if `git diff --check` and
   the nearest render/lint validation pass; state the skip explicitly.
   If `CODEX_GATE: blocked`, fix every P0/P1 finding (or hand it back to the implementer), then re-run;
   repeat until `CODEX_GATE: pass`. Cap ~3 rounds, then escalate. **The spec may NOT move to `done/` until
   the default (high-tier) `codex-review.sh --uncommitted` reports `CODEX_GATE: pass`** — and an unrunnable
   gate (network/CLI error) is blocked, never a pass. For the reviewed lane the workflow already enforces
   this inside its finalize stage; verify its returned `codex.gate == pass` + `commit_sha` instead of
   re-running the gate on an unchanged branch. Surface P2/P3 advisories as warnings.
7. **Reconcile the backlog, then report.** If the spec moved to `done/` AND a line in `backlog.md`'s
   `## Specced (in queue)` section references this slug (`→ specs/queue/<slug>.md`), change its `- [~]` → `- [x]`
   and move it to the top of `## Done`, then trim `## Done` to its 3 newest entries — overflow moves to the
   TOP of `feature-pipeline/backlog-archive.md` (specs that came from the critique→proposal pipeline have no
   backlog line — skip silently). Then report the outcome: what was implemented, the build/lint results (frontend) or
   checkpoint verdicts (backend), the codex verdict/tier, the branch name, the data-scientist HTML report paths
   (backend), and whether the spec moved to `done/` (success) or stayed in `queue/` (blocked/failed — with the
   reason and the failing gate). Include the lane used and why it was safe. Never report success unless the
   gates for that lane actually passed.
