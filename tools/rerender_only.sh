#!/usr/bin/env bash
# Re-renders just the named shots (when only some art changed), then rebuilds the game's WebP
# assets. Unlike tools/rerender.sh it doesn't rebuild the deck textures or the standee prints
# (do the ones that changed first), so nothing else changes.
#   tools/rerender_only.sh final office office_dark jump_scoggis_khan_0 ...
set -euo pipefail
cd "$(dirname "$0")/.."
Q="$1"; shift
BLENDER="${BLENDER:-blender}"
n=0
for s in "$@"; do
  n=$((n + 1))
  start=$(date +%s)
  rm -f "art/renders/$Q/$s.png"
  "$BLENDER" -b --factory-startup -P tools/art/blender/render.py -- --shot="$s" --quality="$Q" 2>&1 \
    | grep -E "Error|Traceback|RENDERED" | grep -v CUEW || true
  [[ -f "art/renders/$Q/$s.png" ]] || { echo "FAILED $s"; exit 1; }
  echo "[$n/$#] $s $(( $(date +%s) - start ))s"
done
python3 tools/art/build_game_art.py "$Q"
