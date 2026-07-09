export const meta = {
  name: 'spec-out-approved',
  description: 'Turn approved feature proposals into implementation-ready spec(s) in the spec queue, classified by track (frontend/backend/full-stack).',
  whenToUse: 'After approving proposals, to generate specs the implementers can drain',
  phases: [{ title: 'Spec', detail: 'one spec-writer per approved proposal' }],
}

// args = { webRoot, fundScoreRoot, proposals: [absolute proposal paths] }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { webRoot, fundScoreRoot } = A
const proposals = A.proposals || []
if (!webRoot || !fundScoreRoot) throw new Error('args requires webRoot, fundScoreRoot')
if (!proposals.length) throw new Error('args.proposals must be a non-empty array of proposal paths')

const SPEC_SCHEMA = {
  type: 'object',
  properties: {
    specs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          track: { type: 'string', enum: ['frontend', 'backend'] },
          lane: { type: 'string', enum: ['lean', 'standard', 'reviewed'] },
          repo: { type: 'string', enum: ['fundscore-web', 'fund_score'] },
          depends_on: { type: 'string' },
          path: { type: 'string' },
          blocked_by_backend: { type: 'boolean' },
        },
        required: ['slug', 'title', 'track', 'lane', 'path'],
      },
    },
  },
  required: ['specs'],
}

function specPrompt(proposalPath) {
  return `You are the **spec-writer** for FundScore.ai. Read your instructions:
  ${webRoot}/.claude/agents/spec-writer.md
and the product/repo config:
  ${webRoot}/feature-pipeline/config/page-types.json   (product.fund_score_repo = ${fundScoreRoot})

Turn this approved proposal into implementation-ready spec(s):
  ${proposalPath}

Classify the track (frontend / backend / full-stack) and implementation lane. For full-stack, write TWO linked specs
(backend + frontend with depends_on). Ground every spec in real code — fundscore-web at ${webRoot},
fund_score at ${fundScoreRoot}. Write spec file(s) to ${webRoot}/feature-pipeline/specs/queue/<slug>.md
and never assume data into existence (mark missing data as a backend prerequisite).

Lane rules:
- lane: lean = tiny localized non-data implementation with concrete acceptance checks; no fund_score changes,
  no serving-fact semantic changes, no schema/migration, no financial calculation, no cross-repo contract.
- lane: standard = normal frontend/product implementation over existing data/contracts.
- lane: reviewed = backend data, serving semantics, financial calculations, schema/data migrations,
  cross-repo/full-stack contracts, or anything where a wrong value would mislead a fund profile.

Every written spec must include lane frontmatter.

Return the structured list of spec(s) you wrote.`
}

phase('Spec')
log(`Speccing ${proposals.length} approved proposal(s)`)

const results = await pipeline(
  proposals,
  async (proposalPath) =>
    agent(specPrompt(proposalPath), {
      label: `spec:${proposalPath.split('/').pop()}`,
      phase: 'Spec',
      schema: SPEC_SCHEMA,
      model: 'opus', // spec-writer-tier work
    })
)

const allSpecs = results.filter(Boolean).flatMap((r) => r.specs || [])
log(`Wrote ${allSpecs.length} spec file(s) to feature-pipeline/specs/queue/`)
return { spec_count: allSpecs.length, specs: allSpecs }
