#!/usr/bin/env bash
# PostToolUse hook (matcher: Write|Edit) — full-project TypeScript check after a
# .ts/.tsx edit. tsc has no cheap single-file mode that still honours tsconfig,
# so this is whole-project by necessity.
#
# Exit codes: 0 pass · 2 BLOCKING (stderr -> agent context) · other = logged.
#
# COST NOTE: `tsc --noEmit` takes ~20s on this project. That is borderline for a
# per-edit hook. If it starts slowing the agent loop:
#   - move this check to a pre-commit git hook (lefthook / husky), or
#   - change the settings.json entry for this hook to "asyncRewake": true so it
#     runs in the background and only wakes the agent when it fails (exit 2).
set -u

FILE=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path||j.tool_response?.filePath||"")}catch{}})')

case "$FILE" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;   # non-TS edit — no type surface changed
esac

cd "$(dirname "$0")/../.." || exit 0

if ! npx --no-install tsc --noEmit; then
  echo "post-edit-typecheck: tsc --noEmit failed after editing $FILE (see above). Fix the type errors." >&2
  exit 2
fi
