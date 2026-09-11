#!/usr/bin/env bash
# PostToolUse hook (matcher: Write|Edit) — lint the single file the agent just
# edited. Fast, scoped feedback: only the touched file is linted, not the project.
#
# Exit codes (Claude Code hook contract):
#   0 -> pass, nothing surfaced
#   2 -> BLOCKING: stderr is fed back into the agent's context so it can fix the
#        finding on its next turn
#   other -> logged, non-blocking
#
# --max-warnings=0 makes this stricter than `npm run lint`: at the per-edit ring
# we want eslint warnings surfaced immediately while context is fresh. Drop that
# flag to mirror `expo lint` (errors only).
set -u

FILE=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path||j.tool_response?.filePath||"")}catch{}})')

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;   # not a lintable source file
esac

cd "$(dirname "$0")/../.." || exit 0
[ -f "$FILE" ] || exit 0   # file was deleted/moved

if ! npx --no-install eslint --max-warnings=0 "$FILE"; then
  echo "post-edit-lint: eslint reported problems in $FILE (see above). Fix them." >&2
  exit 2
fi
