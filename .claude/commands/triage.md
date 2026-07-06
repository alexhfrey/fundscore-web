---
description: Drain the triage backlog — pick the next item and route it to the bug/data/story loop
---
Process ONE item from `feature-pipeline/backlog.md`. Designed to be looped: `/loop /triage` drains the
backlog one item at a time. Lean by default — the main loop drives; delegate only broad research and the
final review.

Steps:
1. Read `feature-pipeline/backlog.md`. Pick the **first unchecked `- [ ]` item under `## Open`** (top = highest
   priority). If there are none, say "backlog empty — nothing to triage" and STOP (this ends a `/loop`).
2. Parse the leading `(type)`:
   - `(bug)` → invoke the `fundscore-data:fix-bug` skill (fundscore-harness plugin) for this item.
   - `(data)` → invoke the `fundscore-data:fix-data` skill (fundscore-harness plugin) for this item.
   - `(story)` → execute the steps in `.claude/commands/spec-story.md` for this item. That clarity-gates the
     story: clear ones get a lean spec and pass through; vague ones get a minimal PRD + one red-team round and
     escalate to the owner if questions remain. It produces a queued spec (and runs `/implement-next`), or
     stops with owner questions — it does NOT fan out the heavy critic pipeline. If the story instead needs
     fresh discovery (new page critique, net-new product direction), say so and point to `/critique-funds`
     rather than forcing it through here.
3. Run the chosen loop end-to-end. It only counts as **done** if its own gates passed — including the
   mandatory codex sign-off (`CODEX_GATE: pass`, after Claude fixed any P0/P1 findings) and tests/build —
   AND the change is committed. No codex pass → not done.
4. Update `backlog.md` by outcome — a story has THREE possible outcomes, not two:
   - **Shipped** (the loop committed a change — always the case for a fixed `(bug)`/`(data)`; a `(story)` only
     if `/implement-next` implemented AND committed it in this pass): change `- [ ]` → `- [x]` and move the
     line to the top of `## Done`.
   - **Specced but not shipped** (a `(story)` that produced a queued spec but wasn't built this pass — deferred,
     a dependency isn't ready, or handed to `/implement-next` for later; also when `spec-story` reports the
     story was **already specced**): change `- [ ]` → `- [~]`, append ` → specs/queue/<slug>.md`, and move it
     to `## Specced (in queue)`. Do NOT leave it under `## Open` — that re-triages it and duplicates the spec.
     (If the existing spec is already in `specs/done/`, move it straight to `## Done` instead.)
   - **Blocked / escalated** (a fix failed, or a vague `(story)` awaiting owner answers with **no spec written
     yet**): leave it under `## Open`, append a short ` — BLOCKED: <reason>` (or ` — AWAITING OWNER: <n>
     questions`) note, and STOP so a `/loop` doesn't spin on it.
5. Report: item, type, what changed, the gate verdicts (tests, Claude review, codex), the commit SHA, and
   whether the backlog was updated. Never report success unless the gates actually passed.
