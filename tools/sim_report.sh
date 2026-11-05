#!/usr/bin/env bash
# Runs the night simulator for Nights 1-6 (decent player) plus the idle and doors-shut
# players, and writes docs/sim/night_sim.md. Usage: tools/sim_report.sh [nights per run]
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
N="${1:-1000}"
OUT=docs/sim/night_sim.md
declare -A TARGET=([1]=95 [2]=85 [3]=65 [4]=45 [5]=25 [6]=10)
row() { # night player
  "$GODOT" --headless -s tools/night_sim.gd -- --nights="$N" --night="$1" --player="$2" 2>/dev/null | grep -E "^\| $1 \|"
}
mkdir -p docs/sim
{
  echo "### Decent player, Nights 1-6 ($N nights each)"
  echo
  echo "| Night | AI levels (leader / left / right / sprinter) | Nights | Win rate | Avg power left (wins) | Avg power left (all) | Most common death | Target win rate |"
  echo "|---|---|---|---|---|---|---|---|"
  for n in 1 2 3 4 5 6; do echo "$(row $n well) ${TARGET[$n]}% ± 10 |"; done
  echo
  echo "### Doing nothing (Night 1 and Night 3)"
  echo
  echo "| Night | AI levels | Nights | Win rate | Avg power left (wins) | Avg power left (all) | Most common death |"
  echo "|---|---|---|---|---|---|---|"
  row 1 none; row 3 none
  echo
  echo "### Both doors shut all night (Night 1)"
  echo
  echo "| Night | AI levels | Nights | Win rate | Avg power left (wins) | Avg power left (all) | Most common death |"
  echo "|---|---|---|---|---|---|---|"
  row 1 doors_shut
} > "$OUT"
cat "$OUT"
