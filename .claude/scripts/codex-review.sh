#!/usr/bin/env bash
# Thin wrapper — the canonical codex gate lives in the fundscore-harness plugin (single source
# of truth). Kept so existing `.claude/scripts/codex-review.sh` references keep working.
exec /Users/alexfrey/Projects/fundscore-harness/plugins/fundscore-data/scripts/codex-review.sh "$@"
