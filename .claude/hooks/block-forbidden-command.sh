#!/bin/bash
# PreToolUse (matcher: Bash): block commands that must only be run by hand.
# Exit 0 = allow. Exit 2 = block; stderr is shown to Claude. Fails closed.
# This guards against mistakes. It is best effort, not a security boundary.
block() { echo "Blocked: $1" >&2; exit 2; }

command -v jq >/dev/null || block "jq is missing, so the command can't be checked."
command -v python3 >/dev/null || block "python3 is missing, so the command can't be checked."
cmd=$(jq -er '.tool_input.command' 2>/dev/null) || block "the command couldn't be read."

reason=$(python3 -I -c '
import re, shlex, sys

cmd = sys.argv[1].replace("\\\n", " ")
HOME_TARGET = re.compile(r"^(/|/\*|~|~/|~/\*|\$HOME|\$\{HOME\})/?\*?$")


def tokens(part):
    try:
        return shlex.split(part)
    except ValueError:
        return part.split()


def contains(words, wanted):
    size = len(wanted)
    return any(words[i : i + size] == wanted for i in range(len(words)))


def check(words):
    if "rm" in words:
        args = words[words.index("rm") + 1 :]
        shorts = "".join(a[1:] for a in args if a.startswith("-") and not a.startswith("--"))
        recursive = "r" in shorts.lower() or "--recursive" in args
        if recursive and any(HOME_TARGET.match(a) for a in args):
            return "refusing to recursively delete / or the home folder."
    if contains(words, ["supabase", "db", "reset"]):
        return "database resets are run by hand. Ask the user."
    if any("db:migrate:prod" in w for w in words):
        return "production migrations are run by hand. Ask the user."
    if "vercel" in words and any(w == "--prod" or w.startswith("--prod=") for w in words):
        return "production deploys go through a merge to main."
    return ""


if re.search(r"drop\s+database", cmd, re.I):
    print("dropping a database is run by hand. Ask the user.")
    sys.exit()
for part in re.split(r"&&|\|\||;|\||\n", cmd):
    found = check(tokens(part))
    if found:
        print(found)
        break
' "$cmd") || block "the command couldn't be checked."

[ -n "$reason" ] && block "$reason"
exit 0
