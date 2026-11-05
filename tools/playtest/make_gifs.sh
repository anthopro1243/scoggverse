#!/usr/bin/env bash
# Turns the playtest videos (well.webm, open_door.webm) into GIFs under 60 s,
# speeding them up as needed. Usage: tools/playtest/make_gifs.sh <video dir> <out dir>
set -euo pipefail
IN="${1:-docs/media}"
OUT="${2:-docs/media}"
MAX=55 # seconds
mkdir -p "$OUT"
for name in well open_door; do
  src="$IN/$name.webm"
  [ -f "$src" ] || { echo "missing $src"; continue; }
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
  trim=()
  if [ "$name" = open_door ]; then
    # Only the end matters: the bot at the door, the jumpscare and the game-over screen, at real speed.
    trim=(-sseof -14)
    dur=$(python3 -c "print(min(14.0, $dur))")
  fi
  factor=$(python3 -c "print(max(1.0, $dur / $MAX))")
  fps=$([ "$name" = well ] && echo 4 || echo 15) # keeps each GIF under ~10 MB; the jumpscare needs the frames
  gif="$OUT/$([ "$name" = well ] && echo winning_night || echo jumpscare).gif"
  ffmpeg -v error -y "${trim[@]}" -i "$src" -vf "setpts=PTS/$factor,fps=$fps,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=$([ "$name" = well ] && echo 64 || echo 128):stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" "$gif"
  echo "$gif: $(python3 -c "print(round($dur / $factor, 1))") s (source ${dur%.*} s, sped up ${factor:0:4}x on top of the in-game speed), $(du -h "$gif" | cut -f1)"
done
