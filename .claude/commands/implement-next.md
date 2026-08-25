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

## ⚠ MATERIALITY FIRST — decide it yourself and ship, unless it is genuinely material
**Default to deciding. The owner has decision AUTHORITY, not decision BANDWIDTH** — spending their
attention to protect your own certainty is a failure, not caution. Before you surface ANY decision,
finding, hazard or "needs a ruling" — yours or one a segment handed you — run the materiality test and
**state its verdict out loud**:

1. **Is it live to users right now?** A gold/product/lakehouse write behind an owner-gated serving reload
   (fence F4) is **not** user-visible. Nothing you write there can reach a user until that reload runs.
2. **How big is it, in numbers?** Rows, funds, dollars, pp of NAV, % of the book. If you cannot put
   numbers on it, **go measure it** — that measurement usually dissolves the question outright.
3. **Does the answer change whether this ships, or only how?** If every option still ships, it is not a
   ruling — it is an implementation choice, and it is yours.

**Fails the test → PICK THE BEST OPTION AND KEEP GOING.** Do not stop, do not ask, do not batch it for
later. Record the call in the spec (an `## ADDENDUM — dispatcher ruling` block: what you chose, the
numbers, and why) so it is reversible knowingly, then ship. Getting it done beats getting it ratified.
Mention what you decided in the final report — one line each, not a consultation.

**Passes the test → surface exactly that one thing**, lead with the materiality verdict (not the
findings), give a recommendation, and decide everything else inline. A batch of three where two are
trivial reads as "I won't make calls" and burns the owner's patience on noise.

**Never interrupt a read-only diagnostic phase (EDA, data-scientist, review) to escalate something it
might still change.** Let it finish — it is cheap, and it usually returns the rest of the picture. Killing
a segment mid-flight discards the whole segment and re-pays it on relaunch. On 2026-08-21 stopping an EDA
early to ask one question cost two discarded runs (~44% of all agent work on that spec) and the second
finding arrived from the very EDA that had been interrupted.

**THE OWNER'S TRIAGE RULE (owner decision 2026-08-22)** — this supersedes any ad-hoc reading of the
materiality test above when a WORKER stops mid-run to ask you something:
- **(a) trivial** → decide it, move on, mention it in the report.
- **(b) technical and material** (moves numbers/coverage/a threshold/how something is verified, but is
  not a product question) → **decide it, record it, and let the run continue** — the data-reviewer
  checkpoint after that segment reviews the call itself. That review IS the safeguard; it is why you
  do not stop and do not need the owner.
- **(c) a genuine product call** blocking further work → **stop, ping the owner, wait.** Do not guess.

Sizing decides the tier — measure first; an unsized question defaults to (c) and burns an owner turn.
**Never edit a workflow, gate, check or agent definition to unblock a run.** On 2026-08-21 a dispatcher
did exactly that (adding a mechanism telling segments not to re-raise blockers); a safety classifier
blocked it and it was reverted. Put the ruling in the SPEC — an `## ADDENDUM` block the worker reads —
and resume from that segment. The machinery is never the place to record a decision.

**Rulings land BETWEEN rounds, never into a live one.** A spec ADDENDUM is read at SEGMENT START:
appending one while a segment is in flight is invisible to the running worker yet fully visible to the
reviewer that follows it, so the ruling lands as a failure instead of an instruction. On 2026-08-24 a
ruling committed 24 seconds before a round closed got the worker FAILED against text it could not have
read — burning the run's only revision round ([[rulings-land-between-rounds]]). Before committing any
ADDENDUM: check whether a segment is running (agent-transcript mtimes / process table). If one is,
either hold the ruling until it returns, or commit it WITH a note that it post-dates the running round.
Symmetrically: when a reviewer reports "the implementer ignored ruling X", compare the ruling's commit
timestamp to the round's last write before believing it.

**Escalation stays mandatory for:** a canonical write whose BILL is wrong (see the write-target check in
step 4), anything that would push web `main` (F3), the serving reload (F4), destructive/irreversible acts
beyond the spec's authorised scope, and a genuinely NEW rule/threshold/allowlist that changes what users
are told. Those are real. Almost nothing else is.

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
2. Pick the next **ready** spec. Ready = `depends_on` is empty OR every dependency slug already has
   a spec in `feature-pipeline/specs/done/`. Among ready specs, order by:
   **(a) `priority:` frontmatter ascending** — an optional integer, lower runs first; specs without
   it sort after every spec that has one. This is how the owner steers the queue without
   back-dating `created:`, which would falsify the record.
   **(b) then oldest `created:`** — the default when no priority is set.
   **If an argument names a spec slug** (`/implement-next <slug>`),
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
   - **WRITE-TARGET CHECK (any spec that writes an artifact — do this, it is ~30 seconds and it is the
     one the gate used to miss).** "The reference resolves" is NOT the same as "the target can receive
     the write." For **every artifact the spec says it will write**, read the target's ACTUAL schema and
     confirm it carries the column the spec intends to change, in the shape the spec assumes:
     `pl.read_parquet_schema(path)` (or `duckdb DESCRIBE`) — never infer it from the spec's prose, from a
     builder that mentions the column, or from a sibling artifact.
     Three failure modes this catches, all seen in production on 2026-08-21 (`sector-consensus-canonical-write`):
       1. **The column isn't there at all** — it is attached at READ time by a consumer, so the file has
          nothing to relabel. (`holdings_lookthrough_window.parquet` had no `sector`; the artifact that
          actually persisted and served those rows was `positioning_changes_panel.parquet`, which was not
          in the bill.)
       2. **The artifact name is a shorthand that doesn't exist on disk** (`exposure_xray` → the real
          panel is `exposure_xray_panel.parquet`).
       3. **The column is a VALUE in a long-format panel, not a column** — relabelling then makes rows
          merge/appear/vanish and change rank, which is not the "0 fills, 0 losses" swap the spec claims.
     Also ask, for each target: **what OTHER artifact inherits this column and would desync if it is not
     rebuilt?** Grep the builders that read this artifact and materialize the same field
     (`passive_blend_holdings` inherited `sector` from the holdings frames and was missing from the bill).
     If a write target fails any of these, the write bill is wrong — fix the bill BEFORE dispatching;
     a mid-run discovery costs a whole discarded segment.
   - **LANE-VS-DELIVERABLE CHECK (over-gating — the write bill is now in hand, so spend 30 seconds
     on the OTHER direction too).** The lane rules above only guard against UNDER-gating; nothing
     catches a measurement dressed as a shipping run. On 2026-08-24 a spec whose own text said "the
     code change is small. The measurement is the point" ran the full reviewed assembly line for ~4h
     with every write confined to `data/_tmp/` — nothing it produced could reach a user
     ([[lane-must-match-deliverable]]). Ask: **does any write in the bill land on a canonical
     artifact (gold/product/serving), and is the deliverable something a SYSTEM reads — or a report
     the OWNER reads?** If every write is `_tmp`-scoped and the deliverable is a report/decision, do
     NOT dispatch the full reviewed workflow. Run a bounded loop instead: implementer (EDA only if
     the spec demands it) → **one adversarial data-reviewer pass on the numbers** → codex — and state
     the downgrade and its reason in the report. Quality holds because the adversarial review still
     covers every number the owner will act on; what is skipped is the serving phase and gates that
     protect artifacts this spec never touches. **Lane is a floor for RISK, not a ceiling for COST.**
     If the spec DOES write canonical data, the reviewed lane stands — never lighten it.
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
     never `done`). The model/effort override applies to implementer segments only; reviewer/gate
     agents are PINNED in the workflow and never tier down with the implementer or the session:
     sample checkpoint + final data gate → fable (the final gate is the quality guarantee; the
     sample checkpoint is the cheapest place to catch semantic errors), full-build checkpoint →
     opus (scale-up mechanics of fable-validated logic — anything it misses still hits the fable
     final gate), data-scientist EDA/plots → opus.
6. **Codex sign-off gate (MANDATORY for code changes, lane-sized).** After the implementation's own gates
   pass, run the gate from the repo the change landed in (WEBROOT for frontend, FUNDSCORE for backend) —
   `~/Projects/fundscore-harness/plugins/fundscore-data/scripts/codex-review.sh --uncommitted` (the plugin
   is the single source of truth; the WEBROOT `.claude/scripts/codex-review.sh` wrapper also works for
   frontend, but the harness path works from either repo).
   The script runs **deep reasoning by default — one clean pass IS the gate**; there is no medium→high
   ladder to climb (`--medium` exists only for cheap intermediate rounds when you genuinely expect several;
   a medium pass never gates anything). **Batch related fixes into ONE commit so the gate runs once**: the
   verdict is keyed to the pending diff, so a commit-per-file cadence multiplies 10-minute high-tier
   runs for zero added safety (three sequential gates on one branch on 2026-08-24/25 were each
   necessary only because the work was committed in separate slices). Docs/prompt-only changes may skip codex if `git diff --check` and
   the nearest render/lint validation pass; state the skip explicitly.
   If `CODEX_GATE: blocked`, fix every P0/P1 finding (or hand it back to the implementer), then re-run;
   repeat until `CODEX_GATE: pass`. Cap ~3 rounds, then escalate. **The spec may NOT move to `done/` until
   the default (high-tier) `codex-review.sh --uncommitted` reports `CODEX_GATE: pass`** — and an unrunnable
   gate (network/CLI error) is blocked, never a pass. This is also enforced mechanically: a PreToolUse
   hook (`codex-commit-gate.sh`, fundscore-harness plugin, registered in both repos) blocks any
   `git commit` whose pending changes include code files unless a fresh high-tier passing verdict
   (`codex-verdict-<HEAD>.json` with `gates_commit: true`, newer than the changes) exists in
   `feature-pipeline/reviews/`. Docs/prompt-only commits pass the hook automatically;
   `SKIP_CODEX_GATE=1` overrides deliberately (say why in the commit message). For the reviewed lane the workflow already enforces
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
