#!/bin/bash
# PostToolUse (matcher: Write|Edit|MultiEdit): format the file Claude just wrote. Never blocks.
file=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0
prettier="${CLAUDE_PROJECT_DIR:-$PWD}/node_modules/.bin/prettier"
[ -x "$prettier" ] && "$prettier" --write --ignore-unknown "$file" >/dev/null 2>&1
exit 0
