#!/usr/bin/env bash
# codex-review.sh — cross-model (OpenAI codex) SIGN-OFF GATE for the triage loops.
#
# Codex must sign off before any task is considered done. This runs codex's
# purpose-built `codex exec review`, classifies its findings by codex's own
# severity tags, and emits a hard gate signal:
#   CODEX_GATE: blocked   → P0/P1 finding(s) exist (or codex errored). Task is NOT done.
#   CODEX_GATE: pass      → no high-severity findings (P2/P3 advisories may remain).
# Exit 2 on blocked, 0 on pass — so a loop can gate on the exit code AND the text.
#
# Protocol (enforced by the calling loop): if blocked, Claude Code fixes EVERY
# P0/P1 finding, then RE-RUNS this gate, repeating until it passes. Only then may
# the task be marked done / committed.
#
# Usage:
#   codex-review.sh                 # review uncommitted (staged+unstaged+untracked)
#   codex-review.sh --base main     # review this branch vs main
#   codex-review.sh --commit <sha>  # review one commit
#
# Env: CODEX_REASONING (default: medium) — the gate runs repeatedly, so default to
#      medium for cost/speed; set =high for a final sign-off pass.
set -uo pipefail

SCOPE_ARGS=("--uncommitted")
case "${1:-}" in
  --uncommitted) SCOPE_ARGS=("--uncommitted") ;;
  --base)        SCOPE_ARGS=("--base" "${2:?--base needs a branch}") ;;
  --commit)      SCOPE_ARGS=("--commit" "${2:?--commit needs a sha}") ;;
  "")            : ;;
  *) echo "usage: codex-review.sh [--uncommitted | --base BRANCH | --commit SHA]" >&2; exit 64 ;;
esac

REASONING="${CODEX_REASONING:-medium}"
OUT_DIR="${CODEX_REVIEW_DIR:-feature-pipeline/reviews}"
mkdir -p "$OUT_DIR" 2>/dev/null || true
TAG=$(git rev-parse --short HEAD 2>/dev/null || echo nohead)
LOG="$OUT_DIR/codex-review-${TAG}.txt"

echo "▶ codex exec review ${SCOPE_ARGS[*]} (reasoning=$REASONING)  log: $LOG" >&2
codex exec -c model_reasoning_effort="$REASONING" review "${SCOPE_ARGS[@]}" 2>&1 | tee "$LOG"
rc=${PIPESTATUS[0]}

echo ""
if [ "$rc" -ne 0 ]; then
  echo "CODEX_GATE: blocked   (codex exited $rc — a failed gate, not a pass; see $LOG)"
  exit 2
fi

# Codex tags findings [P0]..[P3]. P0/P1 = must-fix → block. P2/P3 = advisory.
BLOCKERS=$(grep -oiE '\[P[01]\][^\n]*' "$LOG" | sort -u)
if [ -n "$BLOCKERS" ]; then
  echo "CODEX_GATE: blocked   (must-fix findings below — fix ALL, then re-run this gate)"
  echo "$BLOCKERS"
  exit 2
fi
ADVISORIES=$(grep -ciE '\[P[23]\]' "$LOG" || true)
echo "CODEX_GATE: pass   (no P0/P1 findings; ${ADVISORIES:-0} advisory P2/P3 note(s) — surface to user)"
exit 0
