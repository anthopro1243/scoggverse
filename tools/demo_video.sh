#!/usr/bin/env bash
# Records the ~35 s demo with sound (tools/demo_video.gd) through Godot's Movie Maker, then
# encodes it to MP4 (H.264 + AAC). Movie Maker renders frame by frame, so it doesn't need to
# keep up in real time. Output: docs/media/demo_with_sound.mp4 (committed; a few MB).
# Needs: godot (4.6) on PATH or $GODOT, xvfb-run, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."

GODOT="${GODOT:-godot}"
OUT="${1:-docs/media/demo_with_sound.mp4}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$(dirname "$OUT")"

xvfb-run -a -s "-screen 0 1280x720x24" \
  "$GODOT" --path . --windowed --resolution 1280x720 --position 0,0 --rendering-driver opengl3 \
  --write-movie "$TMP/demo.avi" --fixed-fps 30 -s tools/demo_video.gd

ffmpeg -y -loglevel error -i "$TMP/demo.avi" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
