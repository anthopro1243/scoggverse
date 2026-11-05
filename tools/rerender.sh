#!/usr/bin/env bash
# Re-renders all the Milestone 3 art and rebuilds the game's WebP assets.
#   tools/rerender.sh [test|look|final] [--force]
# Renders that already exist are skipped, so an interrupted run resumes where it stopped
# (a shot writes its PNG only when it finishes). --force re-renders everything.
set -euo pipefail
cd "$(dirname "$0")/.."
Q="${1:-final}"
FORCE="${2:-}"
BLENDER="${BLENDER:-blender}"
python3 tools/art/textures.py >/dev/null      # flyers, checklist, banner, book spines
python3 tools/art/slides.py >/dev/null        # deck posters, p. 17 bill, p. 61 poster, chalkboard
python3 tools/art/cutouts.py >/dev/null       # standee prints
mapfile -t SHOTS < <("$BLENDER" -b --factory-startup -P tools/art/blender/list_shots.py 2>/dev/null | sed -n 's/^SHOT //p')
echo "${#SHOTS[@]} shots at quality $Q"
n=0
for s in "${SHOTS[@]}"; do
  n=$((n + 1))
  out="art/renders/$Q/$s.png"
  if [[ -f "$out" && "$FORCE" != "--force" ]]; then
    continue
  fi
  start=$(date +%s)
  "$BLENDER" -b --factory-startup -P tools/art/blender/render.py -- --shot="$s" --quality="$Q" 2>&1 \
    | grep -E "Error|Traceback|RENDERED" | grep -v CUEW || true
  echo "[$n/${#SHOTS[@]}] $s $(( $(date +%s) - start ))s"
done
python3 tools/art/build_game_art.py "$Q"
