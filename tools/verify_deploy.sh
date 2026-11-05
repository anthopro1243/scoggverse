#!/usr/bin/env bash
# Checks that a deployment serves exactly the committed web build: downloads every file in web/
# from the site's /game/ folder (where the Scoggverse site serves the game) and compares its
# SHA-256 with the local copy.
#   tools/verify_deploy.sh [url]          (default: the live site)
# Preview deployments need a login; pass a share link's token as $SHARE (from the Vercel
# connector's get_access_to_vercel_url) to check one: SHARE=<token> tools/verify_deploy.sh <url>
set -uo pipefail
cd "$(dirname "$0")/.."
URL="${1:-https://five-nights-at-scoggies.vercel.app}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
if [[ -n "${SHARE:-}" ]]; then
  curl -s -o /dev/null -c "$JAR" -b "$JAR" -L "$URL/?_vercel_share=$SHARE"
fi
fail=0
for f in web/*; do
  name="$(basename "$f")"
  [[ "$name" == .gdignore ]] && continue
  # Vercel injects its feedback-toolbar <script> into HTML on preview deployments (not production).
  live="$(curl -s -b "$JAR" "$URL/game/$name" | perl -0pe 's#<script async data-explicit-opt-in="true"[^>]*vercel\.live[^>]*></script>##' | sha256sum | cut -d' ' -f1)"
  mine="$(sha256sum "$f" | cut -d' ' -f1)"
  if [[ "$live" == "$mine" ]]; then echo "same     $name"; else echo "DIFFERS  $name"; fail=1; fi
done
exit $fail
