#!/bin/bash
# Auto-merge: run Claude in headless mode to check CI and merge the current PR.
# Usage: ./scripts/auto-merge.sh
#
# Requires: claude CLI, gh CLI
set -euo pipefail

claude -p "Check CI status for the current PR using 'gh pr checks'. If all checks pass, merge with 'gh pr merge --squash --delete-branch', then switch to main and pull. If checks are still running, wait up to 5 minutes polling every 30 seconds. If checks fail, summarize the failure and exit without merging." \
  --allowedTools "Bash,Read" \
  --max-turns 20
