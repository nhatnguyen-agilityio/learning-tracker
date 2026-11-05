#!/bin/bash
# Stop hook: show a macOS notification when Claude finishes. Never blocks.
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input" 2>/dev/null)" = "true" ] && exit 0
folder=$(basename "$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)")
# The folder name goes in as an argument, so it is never run as AppleScript.
osascript -e 'on run argv' \
  -e 'display notification ("Finished in " & item 1 of argv & ".") with title "Claude Code"' \
  -e 'end run' -- "${folder:-project}" >/dev/null 2>&1
exit 0
