#!/usr/bin/env bash
# Renders the two Instagram posts (1080x1350) from post.html with headless Chromium.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
for store in gplay ios; do
  chromium --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1350 --virtual-time-budget=5000 --run-all-compositor-stages-before-draw \
    --screenshot="$DIR/novastream-instagram-$store.png" \
    "file://$DIR/post.html?store=$store" >/dev/null 2>&1
done
ls -la "$DIR"/*.png
