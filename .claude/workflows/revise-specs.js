export const meta = {
  name: 'revise-specs',
  description: 'Revise flagged specs by looping each back to the spec-writer to address its review findings, then re-review each revised spec.',
  whenToUse: 'After /review-specs, to act on flagged findings',
  phases: [
    { title: 'Revise', detail: 'spec-writer rewrites each spec addressing its flags' },
    { title: 'Re-review', detail: 'spec-reviewer re-checks each revised spec' },
  ],
}

// args = { webRoot, fundScoreRoot, reviewJson, specPaths: [absolute paths] }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { webRoot, fundScoreRoot, reviewJson } = A
const specPaths = A.specPaths || []
if (!webRoot || !fundScoreRoot || !reviewJson) throw new Error('args requires webRoot, fundScoreRoot, reviewJson')
if (!specPaths.length) throw new Error('args.specPaths must be a non-empty array')

const base = (p) => p.split('/').pop()

const REVISE_SCHEMA = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      items: { type: 'object', properties: { issue: { type: 'string' }, change: { type: 'string' } }, required: ['issue', 'change'] },
    },
    unresolved: {
      type: 'array',
      items: { type: 'object', properties: { issue: { type: 'string' }, reason: { type: 'string' } }, required: ['issue', 'reason'] },
    },
    summary: { type: 'string' },
  },
  required: ['changes', 'summary'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'revise'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: { type: 'string' },
          issue: { type: 'string' },
          evidence: { type: 'string' },
          fix_class: { type: 'string', enum: ['auto', 'flag'] },
          proposed_fix: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['severity', 'issue', 'fix_class'],
      },
    },
  },
  required: ['verdict', 'summary', 'findings'],
}

const revisePrompt = (specPath) => `You are the **spec-writer** for FundScore.ai in **REVISE mode**.
Read your instructions: ${webRoot}/.claude/agents/spec-writer.md

Revise this spec **in place**: ${specPath}
Read the review findings for THIS spec from: ${reviewJson}
  (find the entry in "reviews" whose "name" == "${base(specPath)}"; address each item in its "flagged"
  array — the "auto_applied" items are already done.)

For each flagged finding:
- **Factual error** → verify the correct value yourself against the real data/code (fund_score at
  ${fundScoreRoot}, fundscore-web at ${webRoot}) and correct the spec. Do not trust the spec's old
  numbers OR the finding blindly — confirm against source.
- **Scope / design re-decision** → apply the recommended direction; if a premise was wrong (e.g. a
  suppression case that affects 0 funds), remove the design built around it.
- **Cross-spec contract gap** → make the contract explicit (name the shared key/helper and which spec owns it).
Preserve the correct parts, the structure, and the frontmatter. **Never fabricate data or assume data
into existence** — if a finding shows the feature isn't buildable as written, re-scope honestly or mark
a real prerequisite.

Return the structured list of changes per finding, plus any finding you did NOT fully resolve and why.`

const reviewPrompt = (specPath) => `You are the **spec-reviewer**. Read your instructions:
  ${webRoot}/.claude/agents/spec-reviewer.md
Re-review this just-revised spec (verify against the real code/data; repo roots — fundscore-web:
${webRoot}, fund_score: ${fundScoreRoot}):
  ${specPath}
Confirm the prior findings are resolved and surface any that remain or any new issue. Return the
structured review.`

phase('Revise')
log(`Revising ${specPaths.length} spec(s), then re-reviewing each`)

const results = await pipeline(
  specPaths,
  // Stage 1 — revise in place
  async (specPath) => {
    const rev = await agent(revisePrompt(specPath), {
      label: `revise:${base(specPath)}`,
      phase: 'Revise',
      schema: REVISE_SCHEMA,
      model: 'opus', // spec-writer-tier work
    })
    return { specPath, rev }
  },
  // Stage 2 — re-review the revised spec
  async ({ specPath, rev }) => {
    const re = await agent(reviewPrompt(specPath), {
      label: `re-review:${base(specPath)}`,
      phase: 'Re-review',
      schema: REVIEW_SCHEMA,
      model: 'sonnet', // spec-reviewer-tier work
    })
    const remaining = (re?.findings || []).filter((f) => f.fix_class === 'flag')
    return {
      artifact: specPath,
      name: base(specPath),
      verdict: re?.verdict || 'revise',
      summary: re?.summary || '',
      auto_applied: rev?.changes || [], // what the reviser changed (rendered as the green block)
      auto_skipped: rev?.unresolved || [],
      flagged: remaining, // findings that still remain after the revision
    }
  }
)

const good = results.filter(Boolean)
const stillFlagged = good.reduce((n, r) => n + (r.flagged?.length || 0), 0)
const nowPass = good.filter((r) => r.verdict === 'pass').length
log(`Revised ${good.length} spec(s): ${nowPass} now pass, ${stillFlagged} finding(s) still flagged`)

return { target: 'specs', reviews: good, still_flagged_total: stillFlagged, now_pass: nowPass }
