#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SCRIPT_DIR"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

DEFAULT_PROMPT="$SCRIPT_DIR/input/campaign-01-core-foundation.md"
PROMPT_PATH="$DEFAULT_PROMPT"
EXTRA_ARGS=()

if [[ $# -gt 0 ]]; then
  if [[ "$1" == -* ]]; then
    EXTRA_ARGS=("$@")
  else
    PROMPT_PATH="$1"
    shift
    EXTRA_ARGS=("$@")
  fi
fi

if [[ ! -f "$PROMPT_PATH" ]]; then
  if [[ -f "$SCRIPT_DIR/$PROMPT_PATH" ]]; then
    PROMPT_PATH="$SCRIPT_DIR/$PROMPT_PATH"
  else
    echo "Prompt file not found: $PROMPT_PATH" >&2
    exit 1
  fi
fi

MAX_CONCURRENCY="${SUPER_RALPH_MAX_CONCURRENCY:-8}"

ALLOW_UI="${SUPER_RALPH_ALLOW_UI:-}"
if [[ -z "$ALLOW_UI" ]]; then
  case "$(basename "$PROMPT_PATH")" in
    *ui-integration*) ALLOW_UI="true" ;;
    *) ALLOW_UI="false" ;;
  esac
fi

INPUT_JSON="{\"campaignPromptPath\":\"$PROMPT_PATH\",\"allowUi\":$ALLOW_UI,\"maxConcurrency\":$MAX_CONCURRENCY}"

mkdir -p .state

echo "Running Super Ralph workflow with prompt: $PROMPT_PATH"
if (( ${#EXTRA_ARGS[@]} > 0 )); then
  bunx smithers run workflow.tsx --input "$INPUT_JSON" --root "$REPO_ROOT" "${EXTRA_ARGS[@]}"
else
  bunx smithers run workflow.tsx --input "$INPUT_JSON" --root "$REPO_ROOT"
fi
