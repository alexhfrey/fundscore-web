export const meta = {
  name: 'review-artifacts',
  description: 'Review a set of internal artifacts (specs or pipeline prompts): write a plain-English brief, auto-resolve mechanical + engineering issues via a reviser, and surface only genuine product DECISIONS for the owner.',
  whenToUse: 'Driven by /review-specs or /review-prompts',
  phases: [
    { title: 'Review', detail: 'one reviewer per artifact: brief + tiered findings' },
    { title: 'Resolve', detail: 'reviser fixes mechanical + engineering in place; decisions left for the owner' },
  ],
}

// args = { target: 'specs' | 'prompts', artifacts: [absolute paths], webRoot, fundScoreRoot }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { target, webRoot, fundScoreRoot } = A
const artifacts = A.artifacts || []
if (!webRoot || !fundScoreRoot) throw new Error('args requires webRoot, fundScoreRoot')
if (!['specs', 'prompts'].includes(target)) throw new Error("args.target must be 'specs' or 'prompts'")
if (!artifacts.length) throw new Error('args.artifacts must be a non-empty array of paths')

const reviewerName = target === 'specs' ? 'spec-reviewer' : 'prompt-reviewer'
const base = (p) => p.split('/').pop()

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    brief: {
      type: 'object',
      properties: {
        what: { type: 'string' },
        why: { type: 'string' },
        user_impact: { type: 'string' },
      },
      required: ['what', 'why', 'user_impact'],
    },
    verdict: { type: 'string', enum: ['pass', 'revise'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          tier: { type: 'string', enum: ['mechanical', 'engineering', 'decision'] },
          issue: { type: 'string', description: 'for decision tier: a plain-language question' },
          evidence: { type: 'string' },
          proposed_fix: { type: 'string', description: 'for decision tier: the recommended answer + why' },
          rationale: { type: 'string' },
        },
        required: ['severity', 'tier', 'issue', 'proposed_fix'],
      },
    },
  },
  required: ['brief', 'verdict', 'findings'],
}

const REVISE_SCHEMA = {
  type: 'object',
  properties: {
    resolved: {
      type: 'array',
      items: { type: 'object', properties: { issue: { type: 'string' }, change: { type: 'string' } }, required: ['issue', 'change'] },
    },
    unresolved: {
      type: 'array',
      items: { type: 'object', properties: { issue: { type: 'string' }, reason: { type: 'string' } }, required: ['issue', 'reason'] },
    },
    summary: { type: 'string' },
  },
  required: ['resolved'],
}

const reviewPrompt = (artifactPath) => `You are the **${reviewerName}**. Read your instructions:
  ${webRoot}/.claude/agents/${reviewerName}.md

Review this artifact (read it, then verify its claims against the real code/data):
  ${artifactPath}
Repo roots — fundscore-web: ${webRoot} ; fund_score: ${fundScoreRoot}.

Write the plain-English brief, then sort every finding into a tier: \`mechanical\` (auto-fixed),
\`engineering\` (a determinate technical fix the reviser will resolve), or \`decision\` (a genuine
product / framing / scope / data-truth call for the owner — phrase as a plain question with your
recommendation). The bar for \`decision\` is high; most artifacts yield 0–2. Return the structured review.`

const revisePrompt = (artifactPath, fixFindings) => `Revise this artifact **in place**: ${artifactPath}
Repo roots — fundscore-web: ${webRoot} ; fund_score: ${fundScoreRoot}.

Apply EVERY finding below. For \`mechanical\` findings apply the exact edit; for \`engineering\` findings
fix the underlying problem (re-ground against the real code/data — VERIFY values yourself, never
fabricate or assume data into existence; if a fix needs data that doesn't exist, re-scope honestly or
mark a prerequisite). Make NO other changes, and do NOT resolve any \`decision\`-tier matter — those are
left for the owner. Preserve structure and frontmatter.

FINDINGS TO APPLY (JSON):
${JSON.stringify(fixFindings, null, 2)}

Return what you changed and anything you could not resolve and why.`

phase('Review')
log(`Reviewing ${artifacts.length} ${target} artifact(s) at the decision altitude`)

const reviews = await pipeline(
  artifacts,
  // Stage 1 — review: brief + tiered findings
  async (artifactPath) => {
    const review = await agent(reviewPrompt(artifactPath), {
      label: `review:${base(artifactPath)}`,
      phase: 'Review',
      schema: REVIEW_SCHEMA,
      model: 'sonnet', // spec/prompt-reviewer-tier work
    })
    return { artifactPath, review }
  },
  // Stage 2 — reviser resolves mechanical + engineering; decisions surface to the owner
  async ({ artifactPath, review }) => {
    const findings = review?.findings || []
    const toFix = findings.filter((f) => f.tier === 'mechanical' || f.tier === 'engineering')
    const decisions = findings.filter((f) => f.tier === 'decision')
    let rev = { resolved: [], unresolved: [] }
    if (toFix.length) {
      rev =
        (await agent(revisePrompt(artifactPath, toFix), {
          label: `resolve:${base(artifactPath)}`,
          phase: 'Resolve',
          schema: REVISE_SCHEMA,
          model: 'sonnet', // bounded mechanical/engineering fixes
        })) || rev
    }
    return {
      artifact: artifactPath,
      name: base(artifactPath),
      brief: review?.brief || null,
      verdict: review?.verdict || 'revise',
      decisions, // the ONLY thing the owner needs to act on
      engineering_resolved: rev.resolved || [],
      engineering_unresolved: rev.unresolved || [],
      fixed_count: toFix.length,
    }
  }
)

const good = reviews.filter(Boolean)
const decisionsTotal = good.reduce((n, r) => n + (r.decisions?.length || 0), 0)
const fixedTotal = good.reduce((n, r) => n + (r.engineering_resolved?.length || 0), 0)
log(`Auto-resolved ${fixedTotal} mechanical/engineering issue(s); surfaced ${decisionsTotal} decision(s) for the owner`)

return { target, reviews: good, decisions_total: decisionsTotal, fixed_total: fixedTotal }
