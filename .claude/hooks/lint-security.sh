#!/bin/bash
# PostToolUse hook: run ESLint security rules on edited files
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]] && exit 0

npx eslint "$FILE_PATH" --rule 'security/detect-unsafe-regex:error' --rule 'security/detect-eval-with-expression:error' --rule 'security/detect-buffer-noassert:error' --no-warn-ignored 2>&1 | head -10
exit 0
