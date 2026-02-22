#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="${1:-$SCRIPT_DIR/.state/origin-v2-super-ralph.db}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "Database not found: $DB_PATH" >&2
  echo "Run a workflow first to create it." >&2
  exit 1
fi

echo "Opening Smithers TUI for: $DB_PATH"
bunx smithers tui --path "$DB_PATH"
