#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

if [[ -f ".env" ]]; then
  set -a
  source ./.env
  set +a
fi

INPUT_PATH="${1:-$SCRIPT_DIR/input/default.json}"

if [[ ! -f "$INPUT_PATH" ]]; then
  if [[ -f "$SCRIPT_DIR/$INPUT_PATH" ]]; then
    INPUT_PATH="$SCRIPT_DIR/$INPUT_PATH"
  else
    echo "Input file not found: $INPUT_PATH" >&2
    exit 1
  fi
fi

mkdir -p .state

echo "Running workflow with input: $INPUT_PATH"
bunx smithers run workflow.tsx --input "$(cat "$INPUT_PATH")" --root "$REPO_ROOT"
