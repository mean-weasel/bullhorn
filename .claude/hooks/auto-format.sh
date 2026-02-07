#!/bin/bash
# PostToolUse hook: auto-format files after Edit/Write
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx && "$FILE_PATH" != *.css ]] && exit 0
npx prettier --write "$FILE_PATH" 2>/dev/null || true
exit 0
