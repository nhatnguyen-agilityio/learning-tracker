#!/bin/bash
# Stop hook: show a macOS notification when Claude finishes. Never blocks.
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input" 2>/dev/null)" = "true" ] && exit 0
folder=$(basename "$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)")
osascript -e "display notification \"Finished in ${folder:-project}.\" with title \"Claude Code\"" >/dev/null 2>&1
exit 0
