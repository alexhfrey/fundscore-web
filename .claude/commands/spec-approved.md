---
description: Generate implementation specs for approved proposals that don't have one yet
---
Turn approved feature proposals into implementation-ready specs.

Steps:
1. Resolve WEBROOT (fundscore-web absolute path) and FUNDSCORE (`product.fund_score_repo` from
   `feature-pipeline/config/page-types.json`).
2. List `feature-pipeline/proposals/approved/*.md`. For each, check whether a spec with the same slug
   already exists in `feature-pipeline/specs/queue/` or `feature-pipeline/specs/done/`; skip those.
   Collect the remaining proposals' absolute paths.
3. If none remain, say so and stop.
4. Run Workflow with `scriptPath` = `WEBROOT/.claude/workflows/spec-out-approved.js` and
   `args` = `{ webRoot: WEBROOT, fundScoreRoot: FUNDSCORE, proposals: [absolute paths] }`.
5. When done, list the new specs in `feature-pipeline/specs/queue/` with each one's `track`
   (frontend / backend) and any `depends_on`. Call out full-stack features (a backend spec + a
   frontend spec that depends on it). Remind me that `/implement-next` (or `/loop /implement-next`)
   drains the queue.
