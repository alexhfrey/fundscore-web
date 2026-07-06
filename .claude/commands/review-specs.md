---
description: Review queued specs — auto-fix obvious issues, flag judgment calls, render an HTML report, then triage the flagged items
argument-hint: "[spec-slug ...]  (default: all queued specs)"
---
Review the implementation specs and surface what needs your judgment.

Steps:
1. Resolve WEBROOT (fundscore-web absolute path) and FUNDSCORE (`product.fund_score_repo` from
   `feature-pipeline/config/page-types.json`).
2. Collect spec paths: all `feature-pipeline/specs/queue/*.md`, or just the slugs in $ARGUMENTS.
3. Run Workflow with `scriptPath` = `WEBROOT/.claude/workflows/review-artifacts.js` and
   `args` = `{ target: "specs", artifacts: [absolute paths], webRoot: WEBROOT, fundScoreRoot: FUNDSCORE }`.
   Obvious/mechanical fixes are auto-applied to the spec files in place; judgment calls come back flagged.
4. Write the workflow result to `feature-pipeline/reviews/<YYYY-MM-DD>_spec_review.json` (use `date +%F`).
5. Render the report:
   `node scripts/critique/render-review.mjs --in <json> --out feature-pipeline/reviews/<date>_spec_review.html --title "Spec review <date>"`.
6. Make the report viewable (don't just hand over a file path — it won't open): (a) copy it to
   `public/_reviews/` so the running dev server serves it (`mkdir -p public/_reviews`; ensure
   `/public/_reviews/` is gitignored); (b) run `open <html path>` to launch it in the browser; (c) also
   send it with **SendUserFile**. Then give me the clickable URL
   `http://localhost:3000/_reviews/<file>.html` plus a one-paragraph summary: specs reviewed, auto-fixes
   applied (1–2 examples), and how many findings are flagged.
7. Triage the flagged items: for each spec with flagged findings, use AskUserQuestion (batch up to 4)
   summarizing the flags, with options **Approve as-is / Revise / Reject**. Apply:
   - **Approve as-is** → leave the spec in `queue/` (ready to implement).
   - **Revise** → dispatch the spec-writer (Agent `subagent_type: "spec-writer"`, or a general agent told
     to read `WEBROOT/.claude/agents/spec-writer.md`) to rewrite the spec addressing the named flagged
     findings only; keep it in `queue/`. Optionally re-review just that spec.
   - **Reject** → `mkdir -p feature-pipeline/specs/rejected` and move the spec there; note why.
8. Summarize the final state: which specs are ready, revised, or rejected. Remind me `/implement-next`
   (or `/loop /implement-next`) drains the queue.

Note: auto-fixes are applied in place and shown in the report for transparency — review them too.
