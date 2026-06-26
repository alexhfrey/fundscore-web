---
description: Implement the next ready spec from the queue, routing frontend vs backend tracks
---
Implement ONE ready spec from `feature-pipeline/specs/queue/`. Designed to be looped:
`/loop /implement-next` drains the queue one spec at a time.

Steps:
1. Resolve WEBROOT (fundscore-web absolute path) and FUNDSCORE (`product.fund_score_repo` from
   `feature-pipeline/config/page-types.json`).
2. Pick the next **ready** spec: the oldest `*.md` in `feature-pipeline/specs/queue/` whose
   `depends_on` is empty OR whose dependency slug already has a spec in
   `feature-pipeline/specs/done/`. If nothing is ready (queue empty, or all remaining specs are
   blocked by unfinished backend dependencies), say so clearly and STOP — that is the honest
   "nothing to do" signal that ends a `/loop`.
3. Read the spec's frontmatter `track`.
4. Route:
   - **`track: frontend`** → spawn the **feature-implementer** agent (Agent tool, `subagent_type:
     "feature-implementer"`; if it doesn't resolve in this session, use a general-purpose agent told
     to read `WEBROOT/.claude/agents/feature-implementer.md` first). Give it the spec's absolute path.
     Working dir = WEBROOT.
   - **`track: backend`** → run Workflow with `scriptPath` =
     `WEBROOT/.claude/workflows/implement-backend-spec.js` and `args` =
     `{ webRoot: WEBROOT, fundScoreRoot: FUNDSCORE, specPath: <abs spec path>, slug: <slug> }`.
     This is the reviewed assembly line (EDA → implement → data-reviewer checkpoint after each step
     → commit), which halts on any FAIL.
5. **Codex sign-off gate (MANDATORY).** After the implementer's own gates pass, run
   `.claude/scripts/codex-review.sh --uncommitted` (from the repo the change landed in — WEBROOT for
   frontend, FUNDSCORE for backend). If `CODEX_GATE: blocked`, fix every P0/P1 finding (or hand it back to
   the implementer), then re-run the gate; repeat until `CODEX_GATE: pass`. The spec may NOT move to `done/`
   until codex passes. Cap ~3 rounds, then escalate. Surface P2/P3 advisories as warnings.
6. Report the outcome: what was implemented, the build/lint results (frontend) or checkpoint verdicts
   (backend), the codex verdict, the branch name, the data-scientist HTML report paths (backend), and whether
   the spec moved to `done/` (success) or stayed in `queue/` (blocked/failed — with the reason and the failing
   gate). Never report success unless the gates actually passed.
