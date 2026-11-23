#!/usr/bin/env bash
# Builds the website's favicons and header logo from the official iOS app icon.
# Run from the project root: bash web-novastream/scripts/make-brand-icons.sh
set -euo pipefail

SRC="ios-novastream/NovaStreamIPTV/Assets.xcassets/AppIcon.appiconset/icon.png"
PUB="web-novastream/public/brand"
ASSETS="web-novastream/src/assets"
mkdir -p "$PUB" "$ASSETS"

# Small sizes zoom in on the play symbol so it stays readable in a browser tab.
TIGHT="$(mktemp --suffix=.png)"
magick "$SRC" -gravity center -crop 720x720+0+0 +repage "$TIGHT"

magick "$TIGHT" -resize 32x32 "$PUB/novastream-32.png"
magick "$TIGHT" -resize 48x48 "$PUB/novastream-48.png"
magick "$TIGHT" -resize 96x96 "$PUB/novastream-96.png"
magick "$SRC" -resize 180x180 "$PUB/novastream-apple-180.png"
magick "$SRC" -resize 192x192 "$PUB/novastream-192.png"
magick "$SRC" -resize 512x512 "$PUB/novastream-512.png"

# /favicon.ico is what search engines and old browsers ask for by default.
magick "$TIGHT" -define icon:auto-resize=48,32,16 "web-novastream/public/favicon.ico"
# Older fixed paths kept up to date for anything that still points at them.
magick "$TIGHT" -resize 32x32 "web-novastream/public/favicon.png"
magick "$SRC" -resize 1024x1024 "web-novastream/public/icon.png"

# Header logo, bundled through Vite (content-hashed).
magick "$TIGHT" -resize 128x128 "$ASSETS/novastream-logo.png"

rm -f "$TIGHT"
echo "done"
