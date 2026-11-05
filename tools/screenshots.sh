#!/usr/bin/env bash
# Runs the game on a virtual screen (xvfb) at desktop and phone width,
# then builds docs/screens/contact_sheet.png.
# Needs: godot (4.6) on PATH or $GODOT, and xvfb-run.
set -euo pipefail
cd "$(dirname "$0")/.."

GODOT="${GODOT:-godot}"
RAW=docs/screens/raw
rm -rf "$RAW"
mkdir -p "$RAW"

shoot() { # tag width height
  xvfb-run -a -s "-screen 0 ${2}x${3}x24" \
    "$GODOT" --path . --windowed --resolution "${2}x${3}" --position 0,0 \
    --rendering-driver opengl3 -s tools/screenshot.gd -- --out="$RAW" --tag="$1"
}

shoot desktop 1920 1080
shoot phone 375 812

xvfb-run -a -s "-screen 0 1280x720x24" \
  "$GODOT" --path . --windowed --resolution 1280x720 \
  -s tools/contact_sheet.gd -- --in="$RAW" --out=docs/screens/contact_sheet.png

count=$(ls "$RAW"/*.png | wc -l)
echo "Saved $count screenshots and docs/screens/contact_sheet.png"
