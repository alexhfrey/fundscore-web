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
4. **Write the checkpoint BEFORE dispatching**: `feature-pipeline/.loop-state.json` =
   `{ slug, track, specPath, started: <ISO>, runId?: <Workflow runId once known>, agentId?:
   <Agent id once known>, args?: <the backend workflow args> }`. Update it with the
   runId/agentId as soon as the dispatch returns. DELETE it in step 6 when the spec moves to
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
5. **Codex sign-off gate (MANDATORY).** After the implementer's own gates pass, run
   `.claude/scripts/codex-review.sh --uncommitted` (from the repo the change landed in — WEBROOT for
   frontend, FUNDSCORE for backend). If `CODEX_GATE: blocked`, fix every P0/P1 finding (or hand it back to
   the implementer), then re-run the gate; repeat until `CODEX_GATE: pass`. The spec may NOT move to `done/`
   until codex passes. Cap ~3 rounds, then escalate. Surface P2/P3 advisories as warnings.
6. Report the outcome: what was implemented, the build/lint results (frontend) or checkpoint verdicts
   (backend), the codex verdict, the branch name, the data-scientist HTML report paths (backend), and whether
   the spec moved to `done/` (success) or stayed in `queue/` (blocked/failed — with the reason and the failing
   gate). Never report success unless the gates actually passed.
