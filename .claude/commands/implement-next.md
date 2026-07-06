---
description: Implement the next ready spec from the queue, routing frontend vs backend tracks
---
Implement ONE ready spec from `feature-pipeline/specs/queue/`. Designed to be looped:
`/loop /implement-next` drains the queue one spec at a time.

Steps:
0. **Resume check (limit/crash resilience).** If `feature-pipeline/.loop-state.json` exists, a prior
   iteration was interrupted (token limit, crash) — resume IT before picking anything new:
   - `track: backend` → relaunch Workflow with the SAME `scriptPath`/`args` plus
     `resumeFromRunId: <runId from the state file>`. Completed segments replay from the journal
     cache (no re-spend); only the interrupted segment re-runs.
   - `track: frontend` → SendMessage to the recorded `agentId` ("resume where you left off") —
     never relaunch fresh (that re-pays the agent's whole read phase).
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
3. Read the spec's frontmatter: `track`, and the optional **`model`** (`fable | opus | sonnet`) and
   **`effort`** (`low | medium | high | xhigh`) routing hints. These pin which model implements the
   spec — set at spec-writing/triage time so nobody has to remember per-spec model choices. Absent
   fields = session default.
4. **Re-ground the spec against the CURRENT code/data (staleness gate — do this BEFORE dispatching).**
   A queued spec was grounded when it was written; the code and data may have moved since, and an
   implementer will confidently build against references that no longer exist. Confirm every concrete
   claim the spec makes still resolves in the current tree:
   - Enumerate the spec's checkable references: named columns / serving-facts fields, gold/product
     panels and parquet paths, table & schema names, `file:line` anchors, and the functions/modules it
     says to modify.
   - Verify each still exists NOW. **Frontend specs** → Grep the Drizzle serving schema
     (`WEBROOT/src/lib/db/schema/`), the data layer, and the component/route paths. **Backend specs** →
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
5. **Write the checkpoint BEFORE dispatching**: `feature-pipeline/.loop-state.json` =
   `{ slug, track, specPath, started: <ISO>, runId?: <Workflow runId once known>, agentId?:
   <Agent id once known>, args?: <the backend workflow args> }`. Update it with the
   runId/agentId as soon as the dispatch returns. DELETE it in step 7 when the spec moves to
   `done/` (or on a clean blocked/failed stop — the file means "interrupted", not "failed").
   The file is gitignored state, not history.
   Route:
   - **`track: frontend`** → spawn the **feature-implementer** agent (Agent tool, `subagent_type:
     "feature-implementer"`; if it doesn't resolve in this session, use a general-purpose agent told
     to read `WEBROOT/.claude/agents/feature-implementer.md` first). Give it the spec's absolute path.
     Working dir = WEBROOT. Pass the spec's `model` as the Agent tool's `model` param when present.
     (`effort` is not settable on the Agent tool — for frontend specs it is advisory only.)
   - **`track: backend`** → run Workflow with `scriptPath` =
     `WEBROOT/.claude/workflows/implement-backend-spec.js` and `args` =
     `{ webRoot: WEBROOT, fundScoreRoot: FUNDSCORE, specPath: <abs spec path>, slug: <slug>,
     model: <frontmatter model or omit>, effort: <frontmatter effort or omit> }`.
     This is the reviewed assembly line (EDA → implement → data-reviewer checkpoint after each step
     → commit), which halts on any FAIL. The model/effort override applies to implementer segments
     only; reviewer/EDA gate agents stay on the session default.
6. **Codex sign-off gate (MANDATORY).** After the implementer's own gates pass, run the gate from the repo
   the change landed in (WEBROOT for frontend, FUNDSCORE for backend) —
   `~/Projects/fundscore-harness/plugins/fundscore-data/scripts/codex-review.sh --uncommitted` (the plugin
   is the single source of truth; the WEBROOT `.claude/scripts/codex-review.sh` wrapper also works for
   frontend, but the harness path works from either repo). **Pick the tier by expected iteration:**
   start at `--high` for a likely one-shot, or iterate at the default medium tier if you expect several rounds,
   then finish at `--high`. If `CODEX_GATE: blocked`, fix every P0/P1 finding (or hand it back to the
   implementer), then re-run (same tier); repeat until `CODEX_GATE: pass`. Cap ~3 rounds, then escalate. **A
   clean `--high` pass is MANDATORY before move-to-done** — the spec may NOT move to `done/` until
   `codex-review.sh --high --uncommitted` reports `CODEX_GATE: pass` (fix any P0/P1 it surfaces and re-run
   `--high` until it does); the gate rides on THIS deep-reasoning pass, never on a medium round. Surface P2/P3
   advisories as warnings.
7. **Reconcile the backlog, then report.** If the spec moved to `done/` AND a line in `backlog.md`'s
   `## Specced (in queue)` section references this slug (`→ specs/queue/<slug>.md`), change its `- [~]` → `- [x]`
   and move it to the top of `## Done` (specs that came from the critique→proposal pipeline have no backlog
   line — skip silently). Then report the outcome: what was implemented, the build/lint results (frontend) or
   checkpoint verdicts (backend), the codex verdict, the branch name, the data-scientist HTML report paths
   (backend), and whether the spec moved to `done/` (success) or stayed in `queue/` (blocked/failed — with the
   reason and the failing gate). Never report success unless the gates actually passed.
