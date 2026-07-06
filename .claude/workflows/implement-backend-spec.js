export const meta = {
  name: 'implement-backend-spec',
  description: 'Implement one backend-track data spec in fund_score as a reviewed assembly line: EDA plots, then implement → data-reviewer checkpoint after every step (a FAIL bounces the blocking issues back to the implementer, max 2 revision rounds), then a hard /check-data gate and commit. Stops when a checkpoint still fails after revision.',
  whenToUse: 'When /implement-next picks a track:backend spec',
  phases: [
    { title: 'EDA', detail: 'data-scientist explores inputs, emits HTML plots + go/no-go' },
    { title: 'Sample', detail: 'implement on a small sample → data-reviewer checkpoint 1 (revise-until-pass ×2)' },
    { title: 'Full build', detail: 'full build → data-reviewer checkpoint 2 (revise-until-pass ×2) + output plots' },
    { title: 'Serving', detail: 'serving rebuild → data-reviewer checkpoint 3 (served == gold, revise-until-pass ×2)' },
    { title: 'Finalize', detail: 'hard /check-data gate (any FAIL stops), commit on branch, move spec to done' },
  ],
}

// args = { webRoot, fundScoreRoot, specPath, slug, model?, effort? }
// model/effort come from the spec's frontmatter (`model: fable|opus|sonnet`, `effort:
// low|medium|high|xhigh`) and apply to the IMPLEMENTER segments only — the data-reviewer /
// data-scientist gate agents stay on the session default so review quality never drops with a
// cheaper implementer. Without a spec-level pin the implementer defaults to opus — the gates
// (data-reviewer, data-scientist) stay on the session model, so reviewer ≥ implementer holds.
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { webRoot, fundScoreRoot, specPath, slug, model, effort } = A
if (!webRoot || !fundScoreRoot || !specPath || !slug)
  throw new Error('args requires webRoot, fundScoreRoot, specPath, slug')
const implOpts = { model: model || 'opus', ...(effort ? { effort } : {}) }

// Shared backend personas live in the fundscore-harness plugin checkout (single source of
// truth; also registered as `fundscore-data:<name>` plugin agents in both repos). Derive the
// checkout as a sibling of webRoot so this is portable across machines (no Node fs API in the
// workflow sandbox); callers may override with A.harnessRoot.
const harnessRoot = A.harnessRoot || webRoot.replace(/fundscore-web\/?$/, 'fundscore-harness')
const persona = (name) => `${harnessRoot}/plugins/fundscore-data/agents/${name}.md`
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
    coverage_estimate: { type: 'string', description: 'REQUIRED for EDA: the coverage ceiling — what fraction of the target universe will get a value, split honest-missing vs recoverable-missing (spot-checked). Lead finding.' },
    hazards: { type: 'array', items: { type: 'string' } },
  },
  required: ['report_path', 'verdict'],
}

const impl = (segment, extra = '') =>
  agent(
    common.replace('PERSONA', 'backend-implementer') +
      `\n\nDo ONLY the **${segment}** segment, then stop for review.${extra}`,
    { label: `impl:${segment}`, schema: SEGMENT_SCHEMA, phase: phaseOf(segment), ...implOpts }
  )
const review = (step, payload) =>
  agent(
    common.replace('PERSONA', 'data-reviewer') +
      `\n\nReview the **${step}** output below. Run the full verification gate (atomic spot checks vs raw\n` +
      `source, aggregate sanity vs baseline, COVERAGE/RECALL gate [realized coverage % + honest-missing vs\n` +
      `recoverable-missing split, spot-checked on the raw source — a large recoverable miss is BLOCKING, not\n` +
      `acceptable "partial coverage"], statistical coherence, no-leakage, naming, fabrication scan).\n` +
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

// Rubric revise-loop checkpoint: the data-reviewer's checklist is the rubric; a FAIL sends the
// blocking issues back to the implementer to fix AT THE SOURCE (max 2 revision rounds), then
// re-reviews with the same full gate. Review rigor never drops across rounds. Still failing
// after round 2 → the line stops for the owner.
const reviewedSegment = async (segment, step, extra = '') => {
  let out = await impl(segment, extra)
  if (out?.blocker) return { out, rev: null, stop: [segment, out.blocker] }
  let rev = await review(step, out)
  for (let round = 1; rev && rev.verdict === 'fail' && round <= 2; round++) {
    log(`${step}: checkpoint FAIL round ${round} — ${(rev.blocking_issues || []).length} blocking issue(s); bouncing back to implementer`)
    out = await impl(
      segment,
      `${extra}\n\nREVISION ROUND ${round} — the data-reviewer FAILED this segment. Fix EVERY blocking\n` +
        `issue at its source (never paper over data, never narrow a check to make it pass), then stop\n` +
        `for re-review.\nBLOCKING ISSUES (JSON):\n${JSON.stringify(rev.blocking_issues || [], null, 2)}`
    )
    if (out?.blocker) return { out, rev, stop: [segment, out.blocker] }
    rev = await review(`${step} (revision ${round})`, out)
  }
  if (!rev || rev.verdict === 'fail') return { out, rev, stop: [`checkpoint (${step})`, rev] }
  return { out, rev, stop: null }
}

// ---- EDA -------------------------------------------------------------------
phase('EDA')
const eda = await agent(
  common.replace('PERSONA', 'data-scientist') +
    `\n\nMode 1 (pre-build EDA): explore the candidate inputs for this spec, emit a self-contained HTML\n` +
    `plot report to ${fundScoreRoot}/reports/feature_pipeline/${slug}_eda.html, and give a go/caution/no-go.\n` +
    `REQUIRED lead finding: quantify the COVERAGE CEILING — from a real sample, what fraction of the\n` +
    `target universe will actually get a value, with the non-covered remainder split into honest-missing\n` +
    `(no source data) vs recoverable-missing (data IS in the source but a naive extractor misses it —\n` +
    `confirm by spot-checking raw records). Return it in coverage_estimate. A low rate or large\n` +
    `recoverable-missing fraction is a caution/no-go — do not wave it through as "partial coverage".`,
  { label: 'eda', schema: DS_SCHEMA, phase: 'EDA' }
)
if (eda && eda.verdict === 'no-go') return stopped('EDA', eda)
if (eda?.coverage_estimate) log(`EDA coverage ceiling: ${eda.coverage_estimate}`)
// Coverage is a first-class gate: every data-reviewer checkpoint below must verify the realized
// coverage and split honest-missing vs recoverable-missing (a large recoverable miss is BLOCKING),
// not just precision/fabrication. (See data-reviewer.md check 2a.)

// ---- Sample + checkpoint 1 (revise-until-pass, max 2 rounds) ----------------
phase('Sample')
const seg1 = await reviewedSegment('implement-sample', 'implement-sample')
if (seg1.stop) return stopped(seg1.stop[0], seg1.stop[1])
const s1 = seg1.out, r1 = seg1.rev

// ---- Full build + checkpoint 2 + output plots ------------------------------
phase('Full build')
const seg2 = await reviewedSegment('implement-full', 'implement-full')
if (seg2.stop) return stopped(seg2.stop[0], seg2.stop[1])
const s2 = seg2.out, r2 = seg2.rev
const ds2 = await agent(
  common.replace('PERSONA', 'data-scientist') +
    `\n\nMode 2 (post-build output review): visualize the built output (${JSON.stringify(s2?.output_paths || [])}).\n` +
    `Emit a self-contained HTML report to ${fundScoreRoot}/reports/feature_pipeline/${slug}_output.html for human review.`,
  { label: 'output-plots', schema: DS_SCHEMA, phase: 'Full build' }
)

// ---- Serving integration + checkpoint 3 ------------------------------------
phase('Serving')
const seg3 = await reviewedSegment('serving-integration', 'serving-integration (served == gold provenance)')
if (seg3.stop) return stopped(seg3.stop[0], seg3.stop[1])
const s3 = seg3.out, r3 = seg3.rev

// ---- Finalize --------------------------------------------------------------
phase('Finalize')

// Hard /check-data gate: runs the full protocol on every built/rebuilt output BEFORE the
// commit. Any FAIL stops the line; WARNs surface to the owner. This is a scripted gate, not
// implementer discretion — a spec cannot reach `done` without a fresh check report.
const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    overall: { type: 'string', enum: ['PASS', 'WARN', 'FAIL'] },
    report_path: { type: 'string' },
    fails: { type: 'array', items: { type: 'string' } },
    warns: { type: 'array', items: { type: 'string' } },
  },
  required: ['overall', 'report_path'],
}
const builtOutputs = [...new Set([...(s2?.output_paths || []), ...(s3?.output_paths || [])])]
const cd = await agent(
  common.replace('PERSONA', 'data-reviewer') +
    `\n\nCHECK-DATA GATE (do not fix anything — verdict only). Read the protocol at\n` +
    `~/.claude/skills/check-data/SKILL.md and execute BOTH halves YOURSELF in this session:\n` +
    `(1) write+run the aggregate-diagnostics script, (2) do the atomic spot checks, fault-first.\n` +
    `Run it against EVERY feature/panel this spec built or rebuilt:\n${JSON.stringify(builtOutputs, null, 2)}\n` +
    `Write ONE combined markdown report to ${fundScoreRoot}/reports/${slug}_check_data.md.\n` +
    `Overall = worst across features (FAIL if any FAIL). Return overall, report_path, fails, warns.`,
  { label: 'check-data-gate', schema: CHECK_SCHEMA, phase: 'Finalize' }
)
if (!cd || cd.overall === 'FAIL') return stopped('check-data gate', cd)
if (cd.overall === 'WARN') log(`check-data WARN — surfacing to owner: ${(cd.warns || []).join('; ')}`)

const s4 = await impl(
  'finalize-commit',
  `\nThe check-data gate passed (${cd.overall}); its report is at ${cd.report_path} — stage that report with the commit.`
)
if (s4?.blocker) return stopped('finalize-commit', s4.blocker)

return {
  status: 'done',
  slug,
  eda_report: eda?.report_path,
  output_report: ds2?.report_path,
  check_data: { overall: cd.overall, report: cd.report_path },
  checkpoints: { sample: r1.verdict, full: r2.verdict, serving: r3.verdict },
  files_changed: s4?.files_changed || [],
  warnings: [...[r1, r2, r3].flatMap((r) => r?.warnings || []), ...(cd.warns || [])],
}
