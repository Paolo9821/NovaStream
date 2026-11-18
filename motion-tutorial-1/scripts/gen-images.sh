#!/usr/bin/env bash
# Generates the illustrated environments used across the four NovaStream films.
# Flat editorial illustrations (never photo-real), NovaStream palette: deep navy, electric blue, cyan, mint, amber.
#   bash motion-tutorial-1/scripts/gen-images.sh <outDir>
set -u
OUT=${1:?outDir}
mkdir -p "$OUT"
STYLE="Flat vector editorial illustration, clearly illustrated and not photographic, clean geometric shapes, subtle grain texture, limited palette of deep navy #05080F and #0A1124, electric blue #2F7BFF, cyan #38D5F5, mint #34E0A1 and a touch of warm amber #FFB547. No text, no letters, no logos, no user interface on any screen: screens show only a soft abstract blue-cyan glow. No vignette, no blur."

img() { # name ratio prompt
  (rork ai image "$3 $STYLE" --name "$1" --aspect-ratio "$2" --opaque -o "$OUT/"; echo "exit $?") > "$OUT/$1.log" 2>&1 &
}

img ill_livingroom 16:9 "Cosy modern living room at night seen from behind a sofa, a large wall-mounted TV glowing, a floor lamp with warm amber light, plants, calm atmosphere, wide composition with the TV slightly right of centre."
img ill_family 16:9 "A family on a sofa at night watching a big TV: two adults and a child under a blanket, a small padlock-shaped cushion on the sofa, warm and safe mood, wide composition."
img ill_devices 16:9 "A TV on a low cabinet with a small streaming stick and a TV box beside it, a smartphone and a tablet leaning on the cabinet, all screens glowing blue, neat still life, centred wide composition."
img ill_remote 9:16 "Close view of a hand pointing a TV remote at a glowing TV in a dark living room, the person's other hand on their forehead in frustration, humorous mood, vertical composition, TV in the upper half."
img ill_phone 9:16 "Two hands holding a smartphone sideways in landscape on a sofa at night, the phone screen glowing blue and cyan, cosy blanket and amber lamp in the background, vertical composition, phone in the middle."
img ill_tablet 9:16 "A person relaxing in an armchair holding a tablet in landscape like a small TV, screen glowing, warm amber lamp, plant, vertical composition."
wait
