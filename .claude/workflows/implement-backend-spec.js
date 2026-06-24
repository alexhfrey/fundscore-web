export const meta = {
  name: 'implement-backend-spec',
  description: 'Implement one backend-track data spec in fund_score as a reviewed assembly line: EDA plots, then implement → data-reviewer checkpoint after every step, then commit. Stops on any FAIL.',
  whenToUse: 'When /implement-next picks a track:backend spec',
  phases: [
    { title: 'EDA', detail: 'data-scientist explores inputs, emits HTML plots + go/no-go' },
    { title: 'Sample', detail: 'implement on a small sample → data-reviewer checkpoint 1' },
    { title: 'Full build', detail: 'full build → data-reviewer checkpoint 2 + output plots' },
    { title: 'Serving', detail: 'serving rebuild → data-reviewer checkpoint 3 (served == gold)' },
    { title: 'Finalize', detail: '/check-data, commit on branch, move spec to done' },
  ],
}

// args = { webRoot, fundScoreRoot, specPath, slug }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { webRoot, fundScoreRoot, specPath, slug } = A
if (!webRoot || !fundScoreRoot || !specPath || !slug)
  throw new Error('args requires webRoot, fundScoreRoot, specPath, slug')

const persona = (name) => `${webRoot}/.claude/agents/${name}.md`
const common = `
Persona/instructions: read ${persona('PERSONA')}
Spec to implement (read it fully, by absolute path): ${specPath}
fund_score repo root (cd here; use \`uv run python\`): ${fundScoreRoot}
fundscore-web repo root (serving schema lives here): ${webRoot}
Slug: ${slug}`

const SEGMENT_SCHEMA = {
  type: 'object',
  properties: {
    segment: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    commands: { type: 'array', items: { type: 'string' } },
    output_paths: { type: 'array', items: { type: 'string' } },
    stats: { type: 'string', description: 'coverage / counts / distributions you computed' },
    spot_check_records: { type: 'array', items: { type: 'string' }, description: '5+ records a reviewer can check vs raw source' },
    ready_for_review: { type: 'boolean' },
    blocker: { type: 'string', description: 'empty if none' },
  },
  required: ['segment', 'ready_for_review', 'blocker'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    blocking_issues: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    spot_checks: { type: 'array', items: { type: 'string' } },
    aggregate_checks: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'blocking_issues'],
}
const DS_SCHEMA = {
  type: 'object',
  properties: {
    report_path: { type: 'string' },
    key_stats: { type: 'string' },
    verdict: { type: 'string', description: 'go|caution|no-go (EDA) or pass|concern (output review)' },
    hazards: { type: 'array', items: { type: 'string' } },
  },
  required: ['report_path', 'verdict'],
}

const impl = (segment, extra = '') =>
  agent(
    common.replace('PERSONA', 'backend-implementer') +
      `\n\nDo ONLY the **${segment}** segment, then stop for review.${extra}`,
    { label: `impl:${segment}`, schema: SEGMENT_SCHEMA, phase: phaseOf(segment) }
  )
const review = (step, payload) =>
  agent(
    common.replace('PERSONA', 'data-reviewer') +
      `\n\nReview the **${step}** output below. Run the full verification gate (atomic spot checks vs raw\n` +
      `source, aggregate sanity vs baseline, statistical coherence, no-leakage, naming, fabrication scan).\n` +
      `Return verdict pass/fail — any blocking issue is a fail.\n\nIMPLEMENTER OUTPUT (JSON):\n${JSON.stringify(payload, null, 2)}`,
    { label: `review:${step}`, schema: REVIEW_SCHEMA, phase: phaseOf(step) }
  )
function phaseOf(s) {
  if (s.includes('sample')) return 'Sample'
  if (s.includes('full')) return 'Full build'
  if (s.includes('serving')) return 'Serving'
  return 'Finalize'
}
const stopped = (where, detail) => ({ status: 'stopped', stopped_at: where, detail, slug })

// ---- EDA -------------------------------------------------------------------
phase('EDA')
const eda = await agent(
  common.replace('PERSONA', 'data-scientist') +
    `\n\nMode 1 (pre-build EDA): explore the candidate inputs for this spec, emit a self-contained HTML\n` +
    `plot report to ${fundScoreRoot}/reports/feature_pipeline/${slug}_eda.html, and give a go/caution/no-go.`,
  { label: 'eda', schema: DS_SCHEMA, phase: 'EDA' }
)
if (eda && eda.verdict === 'no-go') return stopped('EDA', eda)

// ---- Sample + checkpoint 1 -------------------------------------------------
phase('Sample')
const s1 = await impl('implement-sample')
if (s1?.blocker) return stopped('implement-sample', s1.blocker)
const r1 = await review('implement-sample', s1)
if (!r1 || r1.verdict === 'fail') return stopped('checkpoint-1 (sample)', r1)

// ---- Full build + checkpoint 2 + output plots ------------------------------
phase('Full build')
const s2 = await impl('implement-full')
if (s2?.blocker) return stopped('implement-full', s2.blocker)
const r2 = await review('implement-full', s2)
if (!r2 || r2.verdict === 'fail') return stopped('checkpoint-2 (full build)', r2)
const ds2 = await agent(
  common.replace('PERSONA', 'data-scientist') +
    `\n\nMode 2 (post-build output review): visualize the built output (${JSON.stringify(s2?.output_paths || [])}).\n` +
    `Emit a self-contained HTML report to ${fundScoreRoot}/reports/feature_pipeline/${slug}_output.html for human review.`,
  { label: 'output-plots', schema: DS_SCHEMA, phase: 'Full build' }
)

// ---- Serving integration + checkpoint 3 ------------------------------------
phase('Serving')
const s3 = await impl('serving-integration')
if (s3?.blocker) return stopped('serving-integration', s3.blocker)
const r3 = await review('serving-integration (served == gold provenance)', s3)
if (!r3 || r3.verdict === 'fail') return stopped('checkpoint-3 (serving)', r3)

// ---- Finalize --------------------------------------------------------------
phase('Finalize')
const s4 = await impl('finalize-commit')
if (s4?.blocker) return stopped('finalize-commit', s4.blocker)

return {
  status: 'done',
  slug,
  eda_report: eda?.report_path,
  output_report: ds2?.report_path,
  checkpoints: { sample: r1.verdict, full: r2.verdict, serving: r3.verdict },
  files_changed: s4?.files_changed || [],
  warnings: [r1, r2, r3].flatMap((r) => r?.warnings || []),
}
