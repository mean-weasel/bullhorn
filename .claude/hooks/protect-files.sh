#!/bin/bash
# PreToolUse hook: block edits to sensitive files
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0

# Block .env.local
[[ "$FILE_PATH" == *".env.local" ]] && echo "BLOCKED: .env.local contains secrets — edit manually" >&2 && exit 2

# Block package lock files
[[ "$FILE_PATH" == *"package-lock.json" ]] && echo "BLOCKED: package-lock.json is auto-generated — use npm install" >&2 && exit 2

# Block migration files (create via: make db-new name=...)
[[ "$FILE_PATH" == *"supabase/migrations/"*.sql ]] && echo "BLOCKED: migrations are immutable — create new ones with make db-new" >&2 && exit 2

exit 0
