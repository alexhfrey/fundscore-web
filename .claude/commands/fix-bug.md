---
description: Lean loop to fix one bug — reproduce, fix at root cause, verify, review (Claude + codex), commit
---
Fix ONE bug. Lean and main-loop-driven: you do the work directly; delegate only when breadth genuinely
needs it. Invoked by `/triage` for a `(bug)` item, or directly with the bug described in the argument.

Principles: root-cause, don't patch symptoms. Minimal-impact change. No new bug introduced. Prove it works.

Steps:
1. **Reproduce / locate.** Pin the bug to a file:line and a failing observation (a test, a wrong value, an
   error, a screenshot). If you can't reproduce it, say so and STOP — don't guess-fix.
   - Only if locating it means sweeping many files/conventions, spawn ONE `Explore` agent for the search and
     wait for the conclusion. Otherwise search inline.
2. **Fix at the root cause.** Smallest change that resolves it. Match surrounding code style. Don't touch
   unrelated code.
3. **Verify.** Re-run the exact reproduction and show it now passes. Run the nearest test(s)/build/lint.
   Never mark done on an unverified fix.
4. **Codex sign-off gate (MANDATORY — no task is done without it):**
   - Run `.claude/scripts/codex-review.sh --uncommitted` from the repo root.
   - If `CODEX_GATE: blocked`, **fix every P0/P1 finding yourself first**, then **re-run the gate**. Repeat
     until `CODEX_GATE: pass`. Cap at ~3 rounds; if it still blocks, STOP and escalate to the user with the
     remaining finding (do not pass on it). Surface P2/P3 advisories but they don't block.
   - (A Claude `/code-review` first is optional for non-trivial diffs, but codex `pass` is the hard gate.)
5. **Commit** (only after `CODEX_GATE: pass` AND tests/build green; and only when asked, or when invoked by
   `/triage`). Branch first if on the default branch. Scope the commit to the bug; `Co-Authored-By` trailer.
6. Report: root cause, the fix, the verification evidence, the codex gate result, and the commit SHA.

Cost discipline: this should be mostly main-loop work plus the two review calls — no agent fan-out for a
normal bug. If it balloons into a multi-file data/feature change, stop and reclassify it (it's a data issue
or a story, not a bug).
