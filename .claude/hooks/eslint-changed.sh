#!/bin/bash
# PostToolUse[Edit|Write] hook: lint the just-edited web source file so real lint errors
# surface immediately (fixed inline) instead of piling up until the build+lint done-gate.
# Non-blocking by design: the write already happened; exit 2 only feeds the errors back to
# Claude. Fails open (exit 0) on any tooling problem so it can never wedge a session.
input=$(cat)

file=$(printf '%s' "$input" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))
except Exception: pass' 2>/dev/null)

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v npx >/dev/null 2>&1 || exit 0

# --quiet = errors only (warnings don't interrupt); cap runtime so a hung lint can't block.
out=$(npx --no-install eslint --quiet "$file" 2>/dev/null)
[ $? -eq 0 ] && exit 0

{
  echo "eslint found error(s) in the file you just edited ($file) — fix before moving on:"
  printf '%s\n' "$out"
} >&2
exit 2
