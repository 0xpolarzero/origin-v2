#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REF_DIR="$ROOT_DIR/references"

mkdir -p "$REF_DIR"

clone_or_pull() {
  local url="$1"
  local dir="$2"
  if [[ -d "$dir/.git" ]]; then
    echo "Updating $(basename "$dir")"
    git -C "$dir" pull --ff-only
  else
    echo "Cloning $(basename "$dir")"
    git clone --depth=1 "$url" "$dir"
  fi
}

clone_or_pull "https://github.com/Effect-TS/effect" "$REF_DIR/effect"
clone_or_pull "https://github.com/tim-smart/cheffect" "$REF_DIR/cheffect"
clone_or_pull "https://github.com/mikearnaldi/accountability" "$REF_DIR/accountability"
clone_or_pull "https://github.com/jj-vcs/jj" "$REF_DIR/jj"
clone_or_pull "https://github.com/badlogic/pi-mono" "$REF_DIR/pi-mono"
clone_or_pull "https://github.com/evmts/super-ralph" "$REF_DIR/super-ralph"

echo "Reference repositories are ready at $REF_DIR"
