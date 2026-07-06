---
description: Interactively triage pending feature proposals (keep → approved, reject → rejected)
---
Walk me through the pending feature proposals so I can approve or reject each. (The file inbox at
`feature-pipeline/proposals/pending/` also works without this command — moving a file to
`approved/` is enough — but this is the guided way.)

Steps:
1. List `feature-pipeline/proposals/pending/*.md`. If empty, say so and stop.
2. Read each proposal. Note its title, impact / effort / scope, source pages, and the Pitch paragraph.
3. Use AskUserQuestion to triage — batch up to 4 proposals per call, one question each, with options
   **Keep**, **Reject**, **Skip**. Put the proposal's title + one-line pitch in the question text so I
   can decide quickly. Continue in batches until all pending proposals are triaged (or I stop).
4. Apply my decisions:
   - **Keep** → move the file to `feature-pipeline/proposals/approved/` and set frontmatter
     `status: approved`.
   - **Reject** → move to `feature-pipeline/proposals/rejected/` and set `status: rejected`.
   - **Skip** → leave it in `pending/`.
5. Summarize what moved where, and remind me that `/spec-approved` turns approved proposals into
   implementation specs.

Preserve each proposal's content when moving; only the `status` field changes.
