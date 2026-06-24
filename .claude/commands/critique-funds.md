---
description: Capture fund-profile pages and run the critic panel to produce feature proposals
argument-hint: "[TICKER ...]  (default: config default_targets)"
---
Run the Phase 1 critique pipeline for fundscore-web fund-profile pages.

Context: run this from the fundscore-web repo. Config: `feature-pipeline/config/page-types.json`.
Workflow: `.claude/workflows/critique-and-propose.js`. Capture script: `scripts/critique/capture.mjs`.

Steps:
1. Resolve the fundscore-web working dir as an absolute path — call it WEBROOT.
2. Ensure the dev server is up: check `http://localhost:3000/`. If it doesn't respond, start
   `npm run dev` in the background and poll until it responds (the page reads from local Postgres,
   which must also be up).
3. Tickers: use $ARGUMENTS if provided (space-separated), else the fund_profile `default_targets`
   from the config.
4. For each ticker T, capture the page and confirm `ok:true` (screenshot + served_facts present):
   `node scripts/critique/capture.mjs --page-type fund_profile --ticker T`
5. Run the critique workflow — Workflow with
   `scriptPath` = `WEBROOT/.claude/workflows/critique-and-propose.js` and
   `args` = `{ webRoot: WEBROOT, pageType: "fund_profile", tickers: [...], critics: ["marketing","design","engineering","data-quality","narrative"] }`.
6. When it completes, list the new files in `feature-pipeline/proposals/pending/` and summarize each
   proposal (title · impact · scope). Tell me to run `/review-proposals` to triage.

Notes: the workflow reads each critic's persona from `.claude/agents/<critic>-critic.md` and writes
proposals to `feature-pipeline/proposals/pending/`. Captures live in `feature-pipeline/captures/`
(gitignored). The data-quality critic reaches into the fund_score repo for ground-truth checks.
