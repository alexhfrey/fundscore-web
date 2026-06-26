---
description: Story-tier loop — clarity-gate a story, write a minimal PRD + red-team only if vague, else pass through
---
Turn ONE `(story)` backlog item into something an implementer can build, with the LEAST ceremony that's
honest. Invoked by `/triage` for a `(story)`, or directly with the story described.

The whole point: PRD + red-team are **conditional**. Spend them only when the story is genuinely unclear;
pass clear ones straight through.

Steps:
1. **Read the story** + any linked context. Resolve WEBROOT and FUNDSCORE from
   `feature-pipeline/config/page-types.json` if the story needs grounding in code.

2. **Clarity gate (you judge, honestly).** The story is **CLEAR** only if ALL hold:
   - the functionality is unambiguous (one reasonable interpretation),
   - scope in/out is obvious,
   - "done" is testable (you can name the acceptance check),
   - no open **product decision** remains (what/for-whom/why is settled).
   If any one fails → **VAGUE**. State the verdict and the one-line reason. Don't default to CLEAR to skip work.

3. **CLEAR → pass through.** Write a short lean spec (problem, the functionality, scope in/out, acceptance,
   `track: frontend|backend|full-stack`) to `feature-pipeline/specs/queue/<slug>.md`. No PRD, no red-team.
   Go to step 5.

4. **VAGUE → one PRD + one red-team round, then escalate if needed.**
   a. Write a **minimal, clean PRD** to `feature-pipeline/prds/<slug>.md` — describe the FUNCTIONALITY, not the
      implementation. Keep it tight: Problem / Who & why / What it does (the behavior) / In scope / Out of
      scope / Acceptance (testable) / Open questions. A page, not an essay.
   b. **Red-team it (ONE round, independent agent).** Spawn an agent (general-purpose, told to read
      `WEBROOT/.claude/agents/spec-reviewer.md` for stance) with: "Adversarially review this PRD for a retail
      fund-research product. Find: ambiguities, untestable acceptance, missing/contradictory cases, scope
      that's secretly a product decision, and anything that would make two implementers build different
      things. Return: blocking_discrepancies[] (must-resolve), questions_for_owner[] (product calls only the
      owner can make), and nits[]." Pass the PRD path.
   c. **Resolve what you can in ONE revision** (the blocking_discrepancies that are clarifications, not product
      calls). Do NOT invent answers to product questions.
   d. **Decide:** if, after that one revision, any `questions_for_owner` or unresolved `blocking_discrepancies`
      remain → **STOP and escalate to the owner**: present the PRD + the specific open questions, leave the
      backlog item Open with a ` — AWAITING OWNER: <n> open questions` note. Do not proceed or guess.
   e. If clean → fold the PRD into a lean spec in `feature-pipeline/specs/queue/<slug>.md` (link the PRD) and
      continue.

5. **Hand off to implementation.** The spec is now queued. Run `/implement-next` (or report it's ready). The
   implementer's gates — including the mandatory `CODEX_GATE: pass` — apply there; this loop does not commit code.

6. Report: clarity verdict (clear/vague + why), whether a PRD+red-team ran, any owner escalation, the spec
   path, and the next step. On a CLEAR pass-through, say so plainly — the overhead was skipped on purpose.
