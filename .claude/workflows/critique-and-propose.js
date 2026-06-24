export const meta = {
  name: 'critique-and-propose',
  description: 'Run the critic panel over captured fundscore-web pages, synthesize feature proposals, and write them to the review inbox',
  whenToUse: 'After capturing one or more pages, to produce reviewable feature proposals',
  phases: [
    { title: 'Critique', detail: 'fan out the critic panel per page' },
    { title: 'Propose', detail: 'per-page product synthesis of the critiques' },
    { title: 'Finalize', detail: 'global dedup + write proposals to the inbox' },
  ],
}

// args = {
//   webRoot:  absolute path to the fundscore-web repo
//   pageType: e.g. "fund_profile"
//   tickers:  ["FCNTX", ...]   (capture bundles must already exist)
//   critics:  ["marketing","design","engineering","data-quality","narrative"]
// }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const webRoot = A.webRoot
const pageType = A.pageType || 'fund_profile'
const tickers = A.tickers || []
const critics = A.critics || ['marketing', 'design', 'engineering', 'data-quality', 'narrative']

if (!webRoot) throw new Error('args.webRoot (absolute fundscore-web path) is required')
if (!tickers.length) throw new Error('args.tickers must be a non-empty array')

const slugOf = (t) => `${pageType}__${t}`
const captureDir = (t) => `${webRoot}/feature-pipeline/captures/${slugOf(t)}`

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'one-paragraph overall read of the page from this critic\'s lens' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          area: { type: 'string' },
          observation: { type: 'string' },
          evidence: { type: 'string', description: 'the specific on-page text/number/element or file:line' },
          suggestion: { type: 'string' },
        },
        required: ['severity', 'observation', 'evidence', 'suggestion'],
      },
    },
    feature_ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          rationale: { type: 'string' },
          audience: { type: 'string', enum: ['retail', 'advisor', 'both'] },
        },
        required: ['title', 'rationale'],
      },
    },
  },
  required: ['summary', 'findings', 'feature_ideas'],
}

const CANDIDATES_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          pitch: { type: 'string', description: 'one vivid paragraph a human can yes/no in seconds' },
          problem: { type: 'string', description: 'the problem + the concrete critic evidence' },
          audience: { type: 'string', enum: ['retail', 'advisor', 'both'] },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          scope: { type: 'string', enum: ['page', 'global'] },
          source_critiques: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'pitch', 'problem', 'impact', 'scope'],
      },
    },
  },
  required: ['candidates'],
}

const MANIFEST_SCHEMA = {
  type: 'object',
  properties: {
    written: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          impact: { type: 'string' },
          scope: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['slug', 'title', 'path'],
      },
    },
    skipped_duplicates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, reason: { type: 'string' } },
      },
    },
  },
  required: ['written'],
}

function criticPrompt(critic, ticker) {
  return `You are the **${critic}** critic in the FundScore.ai feature-critique pipeline.

First read your full operating instructions:
  ${webRoot}/.claude/agents/${critic}-critic.md
and the product context (the "product" section):
  ${webRoot}/feature-pipeline/config/page-types.json

Then review this captured page:
  page type: ${pageType}
  target:    ${ticker}
  capture directory: ${captureDir(ticker)}/
    screenshot.png, screenshot-mobile.png, text.txt, served_facts.json, sources.json, meta.json
  repo root (read source files by absolute path under here): ${webRoot}

Follow your instructions exactly. Cite specific on-page evidence (a number, label, element) or
file:line for every finding. Do not fabricate problems. Return your critique in the required
structured form.`
}

function synthPrompt(page) {
  return `You are the **product-strategist** for FundScore.ai, acting in **Role A (per-page synthesis)**.
Read your instructions: ${webRoot}/.claude/agents/product-strategist.md

Here are the critic findings for ${page.ticker} (${pageType}). Merge overlapping findings across
critics into a small set (2–5) of strong candidate proposals. Drop trivia. A data/correctness bug
that misleads users is always high impact. Do NOT write any files in this role — return candidates only.

CRITIQUES (JSON):
${JSON.stringify(page.critiques, null, 2)}`
}

function globalPrompt(pages) {
  const allCandidates = pages.map((p) => ({ ticker: p.ticker, candidates: p.candidates?.candidates || [] }))
  return `You are the **product-strategist** for FundScore.ai, acting in **Role B (global dedup + write)**.
Read your instructions: ${webRoot}/.claude/agents/product-strategist.md

Below are per-page candidate proposals from this run. Produce the final set and WRITE each as a
markdown file (frontmatter + Pitch/Problem/Why it fits) to:
  ${webRoot}/feature-pipeline/proposals/pending/<slug>.md

Before writing, read existing titles so you never duplicate a decided idea:
  ${webRoot}/feature-pipeline/proposals/pending/
  ${webRoot}/feature-pipeline/proposals/approved/
  ${webRoot}/feature-pipeline/proposals/rejected/
  ${webRoot}/feature-pipeline/specs/queue/   and   ${webRoot}/feature-pipeline/specs/done/
Collapse the same idea raised on multiple pages into ONE global proposal (list the pages as
source_pages). Keep genuinely page-specific issues page-scoped. Use \`date +%F\` for the created date.

Return the manifest of what you wrote and what you skipped as duplicates.

PER-PAGE CANDIDATES (JSON):
${JSON.stringify(allCandidates, null, 2)}`
}

// ---- run -------------------------------------------------------------------
phase('Critique')
log(`Critiquing ${tickers.length} page(s) with ${critics.length} critics each: ${tickers.join(', ')}`)

const pages = await pipeline(
  tickers,
  // Stage 1 — fan out the critic panel for this page (parallel, no cross-page barrier)
  async (ticker) => {
    const results = await parallel(
      critics.map((critic) => () =>
        agent(criticPrompt(critic, ticker), {
          label: `${critic}:${ticker}`,
          phase: 'Critique',
          schema: CRITIQUE_SCHEMA,
        }).then((c) => (c ? { critic, ...c } : null))
      )
    )
    return { ticker, slug: slugOf(ticker), critiques: results.filter(Boolean) }
  },
  // Stage 2 — per-page product synthesis (Role A)
  async (page) => {
    const candidates = await agent(synthPrompt(page), {
      label: `synthesize:${page.ticker}`,
      phase: 'Propose',
      schema: CANDIDATES_SCHEMA,
    })
    return { ...page, candidates }
  }
)

// Stage 3 — global dedup + write to the inbox (barrier: needs all pages)
phase('Finalize')
const good = pages.filter(Boolean)
log(`Synthesized candidates for ${good.length} page(s); running global dedup + write`)

const manifest = await agent(globalPrompt(good), {
  label: 'global-dedup-write',
  phase: 'Finalize',
  schema: MANIFEST_SCHEMA,
})

log(`Wrote ${manifest?.written?.length ?? 0} proposal(s) to feature-pipeline/proposals/pending/`)
return {
  pageType,
  tickers,
  critiques_per_page: good.map((p) => ({ ticker: p.ticker, critic_count: p.critiques.length })),
  written: manifest?.written || [],
  skipped_duplicates: manifest?.skipped_duplicates || [],
}
