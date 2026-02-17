#!/bin/bash
# PostToolUse hook: run related tests after editing source files
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]] && exit 0
[[ "$FILE_PATH" == *.test.* ]] && exit 0

# Check if a test file exists alongside the source file
DIR=$(dirname "$FILE_PATH")
BASE=$(basename "$FILE_PATH")
NAME="${BASE%.*}"
EXT="${BASE##*.}"

TEST_FILE="$DIR/$NAME.test.$EXT"
if [ -f "$TEST_FILE" ]; then
  npx vitest run "$TEST_FILE" --reporter=dot 2>&1 | tail -5
fi
exit 0
