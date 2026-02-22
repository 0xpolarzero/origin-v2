#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bun run resume -- <run-id>" >&2
  exit 1
fi

RUN_ID="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

if [[ -f ".env" ]]; then
  set -a
  source ./.env
  set +a
fi

mkdir -p .state

echo "Resuming Super Ralph workflow run: $RUN_ID"
bunx smithers resume workflow.tsx --run-id "$RUN_ID" --root "$REPO_ROOT"
