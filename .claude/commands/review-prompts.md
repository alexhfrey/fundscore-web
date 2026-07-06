---
description: Audit the pipeline machinery (agent defs, workflows, commands) — auto-fix mechanical issues, flag behavioral changes — and render an HTML report
argument-hint: "[path ...]  (default: all agents + workflows + commands)"
---
Review the feature-pipeline machinery itself for prompt quality and reliability.

Steps:
1. Resolve WEBROOT (fundscore-web absolute path) and FUNDSCORE (`product.fund_score_repo` from config).
2. Collect artifact paths: `.claude/agents/*.md`, `.claude/workflows/*.js`, `.claude/commands/*.md`
   (or just the paths in $ARGUMENTS). You may exclude `spec-reviewer.md` / `prompt-reviewer.md` to avoid
   self-review, or include them — your call.
3. Run Workflow with `scriptPath` = `WEBROOT/.claude/workflows/review-artifacts.js` and
   `args` = `{ target: "prompts", artifacts: [absolute paths], webRoot: WEBROOT, fundScoreRoot: FUNDSCORE }`.
   Mechanical fixes (broken path/agent-name refs, typos, schema/prompt mismatches, missing defensive
   `args` parse) are auto-applied; **any behavioral change is flagged**, never auto-applied.
4. Write the result to `feature-pipeline/reviews/<YYYY-MM-DD>_prompt_review.json` (use `date +%F`).
5. Render: `node scripts/critique/render-review.mjs --in <json> --out feature-pipeline/reviews/<date>_prompt_review.html --title "Machinery review <date>"`.
6. Make the report viewable (a file path alone won't open): copy it to `public/_reviews/` so the dev
   server serves it (`mkdir -p public/_reviews`; keep `/public/_reviews/` gitignored), run `open <html>`,
   AND send it with **SendUserFile**. Give me the clickable URL `http://localhost:3000/_reviews/<file>.html`
   plus a one-paragraph summary (artifacts reviewed, auto-fixes applied, behavioral changes flagged).
7. Triage the flagged (behavioral) findings: present them grouped by artifact and ask which to apply.
   Default to NOT changing machinery behavior without my explicit OK. For each finding I approve, apply
   the exact edit to the `.md` / `.js` file; leave the rest.
8. Summarize what changed and what I declined.
