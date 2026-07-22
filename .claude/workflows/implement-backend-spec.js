export const meta = {
  name: 'implement-backend-spec',
  description: 'Implement one backend-track data spec in fund_score as a reviewed assembly line: EDA plots, then implement → data-reviewer checkpoint after every step (a FAIL bounces the blocking issues back to the implementer, max 1 revision round), then one combined final data gate (served==gold + the full /check-data protocol) and a codex-gated commit. Stops when a checkpoint still fails after revision, or when the codex gate cannot produce a clean pass.',
  whenToUse: 'When /implement-next picks a track:backend spec',
  phases: [
    { title: 'EDA', detail: 'data-scientist explores inputs, emits HTML plots + go/no-go' },
    { title: 'Sample', detail: 'implement on a small sample → data-reviewer checkpoint 1 (revise-until-pass ×1)' },
    { title: 'Full build', detail: 'full build → data-reviewer checkpoint 2 (revise-until-pass ×1) + output plots' },
    { title: 'Serving', detail: 'serving rebuild → FINAL DATA GATE: one data-reviewer pass runs served==gold provenance AND the full /check-data protocol (revise-until-pass ×1)' },
    { title: 'Finalize', detail: 'codex --high gate enforced IN-WORKFLOW (no pass+SHA → stopped, never done), commit on branch, move spec to done' },
  ],
}

// args = { webRoot, fundScoreRoot, specPath, slug, model?, effort? }
// model/effort come from the spec's frontmatter (`model: fable|opus|sonnet`, `effort:
// low|medium|high|xhigh`) and apply to the IMPLEMENTER segments only. The gates are PINNED,
// not inherited: review quality must never depend on which model the orchestration session
// happens to run on (a Sonnet-driven /loop must not silently tier down the data gate).
// Tiering doctrine (owner, 2026-07-22): "optimize on intelligent design and speccing,
// implement with lower-cost, have hard gates." The quality GUARANTEE is the final data gate
// (+ codex): nothing ships without passing it, so it runs on fable, unconditionally. The
// intermediate checkpoints protect REWORK COST, not shipped quality — anything they miss
// still has to pass the fable final gate — and they differ in judgment density:
//   sample checkpoint → fable   (semantic review of the logic — basis/labels/joins — on small
//                                data; the cheapest place to catch plausible-but-wrong)
//   full-build checkpoint → opus (scale-up mechanics of already-fable-validated logic:
//                                coverage, distributions; most tokens, least judgment)
// data-scientist EDA/plots → opus (its claims are re-verified by the reviewer checkpoints).
// Override via A.sampleReviewModel / A.fullReviewModel / A.gateModel / A.edaModel only for
// deliberate experiments.
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { webRoot, fundScoreRoot, specPath, slug, model, effort } = A
if (!webRoot || !fundScoreRoot || !specPath || !slug)
  throw new Error('args requires webRoot, fundScoreRoot, specPath, slug')
const implOpts = { model: model || 'opus', ...(effort ? { effort } : {}) }
const sampleReviewModel = A.sampleReviewModel || 'fable'
const fullReviewModel = A.fullReviewModel || 'opus'
const gateModel = A.gateModel || 'fable'
const edaModel = A.edaModel || 'opus'

// Shared backend personas live in the fundscore-harness plugin checkout (single source of
// truth; also registered as `fundscore-data:<name>` plugin agents in both repos). Derive the
// checkout as a sibling of webRoot so this is portable across machines (no Node fs API in the
// workflow sandbox); callers may override with A.harnessRoot.
const harnessRoot = A.harnessRoot || webRoot.replace(/fundscore-web\/?$/, 'fundscore-harness')
const persona = (name) => `${harnessRoot}/plugins/fundscore-data/agents/${name}.md`
const codexScript = `${harnessRoot}/plugins/fundscore-data/scripts/codex-review.sh`
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
// The final data gate returns the review verdict PLUS the /check-data report it wrote.
const FINAL_GATE_SCHEMA = {
  type: 'object',
  properties: {
    ...REVIEW_SCHEMA.properties,
    report_path: { type: 'string', description: 'the combined check-data markdown report this gate wrote' },
  },
  required: ['verdict', 'blocking_issues', 'report_path'],
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
// Finalize must PROVE the codex gate ran and passed, and that a commit exists. The workflow
// verifies these fields — an empty commit_sha or a non-pass gate can never return status:done.
const FINALIZE_SCHEMA = {
  type: 'object',
  properties: {
    segment: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    codex_gate: { type: 'string', enum: ['pass', 'blocked', 'error'], description: 'result of the LAST codex-review.sh run; error = the gate could not execute (network/CLI failure)' },
    codex_log: { type: 'string', description: 'path to the codex review log' },
    commit_sha: { type: 'string', description: 'the fund_score commit SHA; empty if no commit was made' },
    spec_moved_to_done: { type: 'boolean', description: 'true ONLY if the spec file now lives in specs/done/' },
    blocker: { type: 'string', description: 'empty if none' },
  },
  required: ['segment', 'codex_gate', 'commit_sha', 'spec_moved_to_done', 'blocker'],
}

const impl = (segment, extra = '', schema = SEGMENT_SCHEMA) =>
  agent(
    common.replace('PERSONA', 'backend-implementer') +
      `\n\nDo ONLY the **${segment}** segment, then stop for review.${extra}`,
    { label: `impl:${segment}`, schema, phase: phaseOf(segment), ...implOpts }
  )
// Re-reviews run the SAME full checklist (a fix can break what previously passed; rigor never
// drops) but get the prior review so they verify fixes rather than re-derive everything.
const reReviewNote = (prior) =>
  prior
    ? `\n\nRE-REVIEW after a revision round. Your prior review of the previous version is below — run the\n` +
      `SAME full checklist (a fix can break what previously passed; rigor never drops), but use the prior\n` +
      `findings to verify rather than re-derive: confirm each prior blocking issue is fixed AT THE SOURCE,\n` +
      `then re-verify the remaining checks efficiently.\nPRIOR REVIEW (JSON):\n${JSON.stringify(prior, null, 2)}`
    : ''
const reviewModelOf = (step) => (step.includes('sample') ? sampleReviewModel : fullReviewModel)
const review = (step, payload, prior) =>
  agent(
    common.replace('PERSONA', 'data-reviewer') +
      `\n\nReview the **${step}** output below. Run the full verification gate (atomic spot checks vs raw\n` +
      `source, aggregate sanity vs baseline, COVERAGE/RECALL gate [realized coverage % + honest-missing vs\n` +
      `recoverable-missing split, spot-checked on the raw source — a large recoverable miss is BLOCKING, not\n` +
      `acceptable "partial coverage"], statistical coherence, no-leakage, naming, fabrication scan).\n` +
      `Return verdict pass/fail — any blocking issue is a fail.` +
      reReviewNote(prior) +
      `\n\nIMPLEMENTER OUTPUT (JSON):\n${JSON.stringify(payload, null, 2)}`,
    { label: `review:${step}`, schema: REVIEW_SCHEMA, phase: phaseOf(step), model: reviewModelOf(step) }
  )
function phaseOf(s) {
  if (s.includes('sample')) return 'Sample'
  if (s.includes('full')) return 'Full build'
  if (s.includes('serving')) return 'Serving'
  return 'Finalize'
}
const stopped = (where, detail) => ({ status: 'stopped', stopped_at: where, detail, slug })

// Rubric revise-loop checkpoint: the data-reviewer's checklist is the rubric; a FAIL sends the
// blocking issues back to the implementer to fix AT THE SOURCE (max 1 revision round), then
// re-reviews with the same full gate. Review rigor never drops across rounds. A segment that
// fails twice needs the owner, not a third opus round — the line stops.
const reviewedSegment = async (segment, step, extra = '') => {
  let out = await impl(segment, extra)
  if (out?.blocker) return { out, rev: null, stop: [segment, out.blocker] }
  let rev = await review(step, out)
  for (let round = 1; rev && rev.verdict === 'fail' && round <= 1; round++) {
    log(`${step}: checkpoint FAIL round ${round} — ${(rev.blocking_issues || []).length} blocking issue(s); bouncing back to implementer`)
    out = await impl(
      segment,
      `${extra}\n\nREVISION ROUND ${round} — the data-reviewer FAILED this segment. Fix EVERY blocking\n` +
        `issue at its source (never paper over data, never narrow a check to make it pass), then stop\n` +
        `for re-review.\nBLOCKING ISSUES (JSON):\n${JSON.stringify(rev.blocking_issues || [], null, 2)}`
    )
    if (out?.blocker) return { out, rev, stop: [segment, out.blocker] }
    rev = await review(`${step} (revision ${round})`, out, rev)
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
  { label: 'eda', schema: DS_SCHEMA, phase: 'EDA', model: edaModel }
)
if (eda && eda.verdict === 'no-go') return stopped('EDA', eda)
if (eda?.coverage_estimate) log(`EDA coverage ceiling: ${eda.coverage_estimate}`)
// Coverage is a first-class gate: every data-reviewer checkpoint below must verify the realized
// coverage and split honest-missing vs recoverable-missing (a large recoverable miss is BLOCKING),
// not just precision/fabrication. (See data-reviewer.md check 2a.)

// ---- Sample + checkpoint 1 (revise-until-pass, max 1 round) -----------------
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
  { label: 'output-plots', schema: DS_SCHEMA, phase: 'Full build', model: edaModel }
)

// ---- Serving integration + FINAL DATA GATE ----------------------------------
// One combined data-reviewer pass replaces the old checkpoint-3 + separate /check-data re-run
// (they substantially re-verified the same outputs): served==gold provenance AND the full
// /check-data protocol over every built output, with ONE revision round on fail.
phase('Serving')
let s3 = await impl('serving-integration')
if (s3?.blocker) return stopped('serving-integration', s3.blocker)

const builtOutputs = () => [...new Set([...(s2?.output_paths || []), ...(s3?.output_paths || [])])]
const finalGate = (payload, tag, prior) =>
  agent(
    common.replace('PERSONA', 'data-reviewer') +
      `\n\nFINAL DATA GATE${tag} (verdict only — fix nothing). This single pass is BOTH the serving\n` +
      `checkpoint and the /check-data gate; a spec cannot reach done without it. Do ALL of:\n` +
      `(1) served == gold provenance for the serving integration below — spot-check 3–5 joined rows\n` +
      `    end-to-end (your check 7a), fault-first.\n` +
      `(2) The /check-data protocol: read ~/.claude/skills/check-data/SKILL.md and execute BOTH halves\n` +
      `    YOURSELF in this session — (a) write+run the aggregate-diagnostics script, (b) the atomic\n` +
      `    spot checks — against EVERY feature/panel this spec built or rebuilt:\n` +
      `    ${JSON.stringify(builtOutputs(), null, 2)}\n` +
      `Write ONE combined markdown report to ${fundScoreRoot}/reports/${slug}_check_data.md and return\n` +
      `its path in report_path. verdict = fail if ANY blocking issue or any check FAILs; put check-data\n` +
      `WARNs in warnings.` +
      reReviewNote(prior) +
      `\n\nIMPLEMENTER OUTPUT (JSON):\n${JSON.stringify(payload, null, 2)}`,
    { label: `final-data-gate${tag}`, schema: FINAL_GATE_SCHEMA, phase: 'Serving', model: gateModel }
  )

let r3 = await finalGate(s3, '')
if (r3 && r3.verdict === 'fail') {
  log(`final data gate: FAIL — ${(r3.blocking_issues || []).length} blocking issue(s); one revision round`)
  s3 = await impl(
    'serving-integration',
    `\n\nREVISION ROUND — the final data gate FAILED. Fix EVERY blocking issue at its source (never\n` +
      `paper over data, never narrow a check to make it pass), then stop for re-review.\n` +
      `BLOCKING ISSUES (JSON):\n${JSON.stringify(r3.blocking_issues || [], null, 2)}`
  )
  if (s3?.blocker) return stopped('serving-integration', s3.blocker)
  r3 = await finalGate(s3, ' (revision 1)', r3)
}
if (!r3 || r3.verdict === 'fail') return stopped('final data gate', r3)
if ((r3.warnings || []).length) log(`final data gate WARNs — surfacing to owner: ${r3.warnings.join('; ')}`)

// ---- Finalize (codex gate enforced IN-WORKFLOW, then commit) ----------------
phase('Finalize')
const s4 = await impl(
  'finalize-commit',
  `\nThe final data gate passed; its combined check-data report is at ${r3.report_path} — stage that\n` +
    `report with the commit.\n\n` +
    `MANDATORY CODEX GATE, BEFORE the commit (the workflow verifies your structured output — a\n` +
    `non-pass gate or empty commit_sha means this spec does NOT move to done):\n` +
    `1. From ${fundScoreRoot}, run: ${codexScript}   (deep reasoning by default; scope --uncommitted).\n` +
    `2. On CODEX_GATE: blocked — fix every P0/P1 finding at its source, then re-run. Max 2 gate rounds.\n` +
    `3. Commit on the feature branch ONLY after CODEX_GATE: pass. Then move the spec to done/.\n` +
    `4. If the gate still blocks after 2 rounds, or cannot execute at all (network/CLI error): do NOT\n` +
    `   commit, do NOT move the spec, and return codex_gate: blocked|error with the blocker field set —\n` +
    `   never treat an unrunnable gate as a pass.\n` +
    `Return codex_gate, codex_log, commit_sha, spec_moved_to_done in your structured output.`,
  FINALIZE_SCHEMA
)
// Fail closed: a killed/dead finalize agent (null result) is an interrupted run, never done.
if (!s4) return stopped('finalize-commit', 'finalize agent returned null (killed or session died) — commit state unknown; resume or inspect the branch')
if (s4.blocker) return stopped('finalize-commit', s4.blocker)
if (s4.codex_gate !== 'pass' || !s4.commit_sha || s4.spec_moved_to_done !== true)
  return stopped('finalize gate', {
    codex_gate: s4.codex_gate,
    codex_log: s4.codex_log,
    commit_sha: s4.commit_sha,
    spec_moved_to_done: s4.spec_moved_to_done,
    detail: 'finalize incomplete — needs codex pass + commit SHA + spec in done/; spec stays in queue/ otherwise',
  })

return {
  status: 'done',
  slug,
  eda_report: eda?.report_path,
  output_report: ds2?.report_path,
  check_data: { report: r3.report_path, warns: r3.warnings || [] },
  codex: { gate: s4.codex_gate, log: s4.codex_log },
  commit_sha: s4.commit_sha,
  checkpoints: { sample: r1.verdict, full: r2.verdict, final_gate: r3.verdict },
  files_changed: s4.files_changed || [],
  warnings: [...[r1, r2, r3].flatMap((r) => r?.warnings || [])],
}
