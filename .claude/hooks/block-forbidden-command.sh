#!/bin/bash
# PreToolUse (matcher: Bash): block commands that must only be run by hand.
# Exit 0 = allow. Exit 2 = block; stderr is shown to Claude. Fails closed.
block() { echo "Blocked: $1" >&2; exit 2; }

command -v jq >/dev/null || block "jq is missing, so the command can't be checked."
cmd=$(jq -er '.tool_input.command' 2>/dev/null) || block "the command couldn't be read."

grep -Eq 'rm[[:space:]]+-[a-zA-Z]*(rf|fr)[a-zA-Z]*[[:space:]]+(/|~|\$HOME)([[:space:]]|/?$)' <<<"$cmd" \
  && block "refusing to recursively delete / or the home folder."
grep -Eqi 'supabase[[:space:]]+db[[:space:]]+reset|db:migrate:prod|DROP[[:space:]]+DATABASE' <<<"$cmd" \
  && block "database resets and production migrations are run by hand. Ask the user."
grep -Eq 'vercel[[:space:]].*--prod' <<<"$cmd" \
  && block "production deploys go through a merge to main."
exit 0
