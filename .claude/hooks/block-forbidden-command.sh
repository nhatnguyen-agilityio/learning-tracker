#!/bin/bash
# PreToolUse (matcher: Bash): block commands that must only be run by hand.
# Exit 0 = allow. Exit 2 = block; stderr is shown to Claude. Fails closed.
# This guards against mistakes. It is best effort, not a security boundary.
# Matching runs on the whole command text, so a forbidden command that is only
# quoted or mentioned (for example in a commit message) is blocked too.
block() { echo "Blocked: $1" >&2; exit 2; }

command -v jq >/dev/null || block "jq is missing, so the command can't be checked."
command -v python3 >/dev/null || block "python3 is missing, so the command can't be checked."
cmd=$(jq -er '.tool_input.command' 2>/dev/null) || block "the command couldn't be read."

reason=$(python3 -I -c '
import os, re, sys

# Escapes and quotes are dropped first, so commands nested in bash -c or eval are
# still seen. Redirections go too, because their & is not a command separator.
cmd = re.sub(r"\\(.)", r"\1", sys.argv[1].replace("\\\n", " "))
cmd = re.sub(r"[\"\x27]", "", cmd)
cmd = re.sub(r"\d*[<>]&[\d-]*|&>>?", " ", cmd)
HOME_TARGET = re.compile(r"^(/|/\*|~|~/|~/\*|\$HOME|\$\{HOME\})/?\*?$")
RULES = [
    (r"\bdrop\s+database", "dropping a database is run by hand. Ask the user."),
    (r"\bsupabase\b[^;&|\n]*\sdb\s+reset", "database resets are run by hand. Ask the user."),
    (r"db:migrate:prod", "production migrations are run by hand. Ask the user."),
    (r"\bvercel\b[^;&|\n]*\s--prod\b", "production deploys go through a merge to main."),
]

def deletes_home(words):
    names = [os.path.basename(w).lower() for w in words]
    if "rm" not in names:
        return False
    args = words[names.index("rm") + 1 :]
    shorts = "".join(a[1:] for a in args if a.startswith("-") and not a.startswith("--"))
    recursive = "r" in shorts.lower() or "--recursive" in args
    return recursive and any(HOME_TARGET.match(a) for a in args)

for pattern, message in RULES:
    if re.search(pattern, cmd, re.I):
        print(message)
        sys.exit()
for part in re.split(r"&&|\|\||[;|&()`\n]", cmd):
    if deletes_home(part.split()):
        print("refusing to recursively delete / or the home folder.")
        break
' "$cmd") || block "the command couldn't be checked."

[ -n "$reason" ] && block "$reason"
exit 0
