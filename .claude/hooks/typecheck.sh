#!/bin/bash
# PostToolUse hook: run TypeScript type checking after .ts/.tsx edits
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]] && exit 0
npx tsc --noEmit --pretty 2>&1 | head -20
exit 0
