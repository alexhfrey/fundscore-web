---
description: Story-tier loop — clarity-gate a story, assign lean/standard/reviewed lane, write a minimal spec
---
Turn ONE `(story)` backlog item into something an implementer can build, with the LEAST ceremony that's
honest. Invoked by `/triage` for a `(story)`, or directly with the story described.

The whole point: PRD + red-team are **conditional**. Spend them only when the story is genuinely unclear;
pass clear ones straight through.

Lane classification is also conditional. Use the cheapest lane that is still honest:
- `lane: lean` — tiny, clear, localized implementation; no new data product; no serving-fact semantic change;
  no schema/migration; no financial calculation; no cross-repo contract; likely <=2 source files plus tests.
- `lane: standard` — normal frontend/product implementation that needs an implementer but not backend data
  review; existing served fields/contracts only.
- `lane: reviewed` — backend data work, fund_score changes, serving-fact semantics, financial calculations,
  schema/data migrations, cross-repo/full-stack contracts, ambiguous product/data-truth calls, or any change
  where a wrong value would mislead a fund profile.

Steps:
1. **Read the story** + any linked context. Resolve WEBROOT and FUNDSCORE from
   `feature-pipeline/config/page-types.json` if the story needs grounding in code.
   **Queue-depth nudge (soft, never a hard stop):** count the specs already in
   `feature-pipeline/specs/queue/`. If ≥3 are sitting unstarted, still spec THIS story if invoked for
   it, but say so prominently in the report and recommend draining before speccing more — queued
   specs decay as the code moves under them (history: a 17-deep queue yielded 1 implemented and 2
   orphaned by an in-flight redesign).
   **Dedup gate (first):** derive the deterministic kebab-case `<slug>` from the story title and check
   `feature-pipeline/specs/queue/<slug>.md` and `feature-pipeline/specs/done/<slug>.md`. If a spec already
   exists, do NOT re-spec — report `already specced → <path>` and its state (in `queue/` → the backlog item
   should move to **Specced (in queue)**; in `done/` → move it to **Done**) so the caller reconciles the
   backlog, and STOP.

2. **Clarity gate (you judge, honestly).** The story is **CLEAR** only if ALL hold:
   - the functionality is unambiguous (one reasonable interpretation),
   - scope in/out is obvious,
   - "done" is testable (you can name the acceptance check),
   - no open **product decision** remains (what/for-whom/why is settled).
   If any one fails → **VAGUE**. State the verdict and the one-line reason. Don't default to CLEAR to skip work.

3. **CLEAR → pass through.** Classify the lane first, then write a short spec to
   `feature-pipeline/specs/queue/<slug>.md`. No PRD, no red-team. The spec frontmatter MUST include:
   `id`, `title`, `status: queued`, `track: frontend|backend|full-stack`, `repo`, `lane:
   lean|standard|reviewed`, `depends_on`, `created`, and `scope`.
   - Use `lane: lean` only when the eligibility rules above are satisfied and the acceptance check is concrete.
   - Use `lane: standard` for normal frontend specs over existing data/contracts.
   - Use `lane: reviewed` for backend/data/high-risk specs. If the story is full-stack, split it into backend
     `lane: reviewed` and frontend `lane: standard` specs with `depends_on`, unless the frontend part is tiny
     enough to be `lane: lean` after the backend is done.
   Acceptance-number conventions: illustrative numbers from mocks/PRDs/ad-hoc analysis are
   era-stamped and NON-BINDING (acceptance recomputes from live sources, "or the deviation is
   explained" clause); capability claims must be checkable file/column references, never prose
   assertions.
   Go to step 5.

4. **VAGUE → one PRD + one red-team round, then escalate if needed.**
   a. Write a **minimal, clean PRD** to `feature-pipeline/prds/<slug>.md` — describe the FUNCTIONALITY, not the
      implementation. Keep it tight: Problem / Who & why / What it does (the behavior) / In scope / Out of
      scope / Acceptance (testable) / Open questions. A page, not an essay.
   b. **Red-team it (ONE round, independent agent).** Spawn an agent (general-purpose, told to read
      `WEBROOT/.claude/agents/artifact-reviewer.md` for stance) with: "Adversarially review this PRD for a retail
      fund-research product. Find: ambiguities, untestable acceptance, missing/contradictory cases, scope
      that's secretly a product decision, and anything that would make two implementers build different
      things. Return: blocking_discrepancies[] (must-resolve), questions_for_owner[] (product calls only the
      owner can make), and nits[]." Pass the PRD path.
   c. **Resolve what you can in ONE revision** (the blocking_discrepancies that are clarifications, not product
      calls). Do NOT invent answers to product questions.
   d. **Decide:** if, after that one revision, any `questions_for_owner` or unresolved `blocking_discrepancies`
      remain → **STOP and escalate to the owner**: present the PRD + the specific open questions, leave the
      backlog item Open with a ` — AWAITING OWNER: <n> open questions` note. Do not proceed or guess.
   e. If clean → fold the PRD into a spec in `feature-pipeline/specs/queue/<slug>.md` (link the PRD), including
      the lane frontmatter above, and continue. **Acceptance numbers live in ONE file — the spec.** The PRD
      keeps the decisions and behavior; move (don't copy) the quantified acceptance block into the spec and
      leave the PRD a pointer ("acceptance quantified in the spec"). Verbatim triplication is how a superseded
      number survives in a stale copy.

5. **Hand off to implementation.** The spec is now queued at `specs/queue/<slug>.md`. This loop does not commit
   code — either run `/implement-next` now, or report the spec is ready for later. Either way the story has
   **left `## Open`**: the caller moves the backlog item to **Specced (in queue)** linked to `<slug>`, unless
   `/implement-next` ships it in this same pass (then it goes straight to **Done**). The implementer's
   gates — including the mandatory `CODEX_GATE: pass` — apply there.

6. Report: clarity verdict (clear/vague + why), lane chosen and why, whether a PRD+red-team ran, any owner
   escalation, the spec `<slug>`/path, the resulting backlog state (**Specced (in queue)** / shipped / awaiting
   owner), and the next step. On a CLEAR pass-through, say so plainly — the overhead was skipped on purpose.
