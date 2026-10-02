#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CLANG="${CLANG:-clang}"
LD="${WASM_LD:-$(command -v wasm-ld || true)}"
if [[ -z "$LD" ]]; then
  VERSION="$($CLANG -dumpversion | cut -d. -f1)"
  LD="$(command -v "wasm-ld-$VERSION" || true)"
fi
if [[ -z "$LD" ]]; then printf 'wasm-ld missing: install the matching lld package\n' >&2; exit 1; fi
mkdir -p web/wasm
OBJECTS=()
for SOURCE in wasm/map_render.c wasm/at_core.c wasm/field_at.c wasm/map_position.c wasm/world_at.c; do
  [[ -f "$SOURCE" ]] || continue
  OBJECT="/tmp/dq9-at-$(basename "${SOURCE%.c}").o"
  "$CLANG" --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin -c "$SOURCE" -o "$OBJECT"
  OBJECTS+=("$OBJECT")
done
MEMORY_EXPORT=()
if "$LD" --help | grep -- '--export-memory' >/dev/null; then MEMORY_EXPORT+=(--export-memory); fi
"$LD" --no-entry "${MEMORY_EXPORT[@]}" --export=__heap_base --initial-memory=33554432 --max-memory=134217728 "${OBJECTS[@]}" -o web/wasm/map_render.wasm
printf 'Built '; wc -c < web/wasm/map_render.wasm
bash scripts/build-monster.sh
CLANG="$CLANG" WASM_LD="$LD" bash scripts/build-monster-movement.sh

# This kernel has an exact reviewed hash. Rebuild separately with pinned emsdk 3.1.6.
bash scripts/build-at-identify.sh --verify
node scripts/test-at-identify.mjs
node scripts/test-at-identify-page.mjs
# Separate known-origin / terminal-index mode. Never overwrite the low31 kernel.
bash scripts/build-at-identify-stream.sh --verify
node scripts/test-at-identify-index.mjs
node scripts/test-at-identify-index-page.mjs

# Accepted Work2 finite oracles and real Worker cancellation/coverage regressions.
node scripts/test-at-worker-regressions.mjs
node scripts/test-at-binary64-regressions.mjs

# Cross-map session predicates retain unknown outcomes without proof increments.
node scripts/test-at-session.mjs

# Conditional NPC membership stays separate from runtime AT proof.
node scripts/test-npc-membership.mjs

# Capture identity must stay tied to frozen pixels across asynchronous analyses.
node --experimental-vm-modules scripts/check-video-panel-capture.mjs

# Experimental ROM-derived pose matching: portable CPU/Worker and parser checks.
node scripts/test-monster-animation.mjs
node scripts/test-monster-recognition.mjs
node scripts/test-monster-recognize-page.mjs

# Explicit one-frame CPU glyph fallback; no GPU globals or private fixture inputs.
node scripts/test-font-akinator-cpu.mjs
node scripts/test-font-akinator-cpu-client.mjs
node scripts/test-map-recognize-page.mjs

# Approximate map-coordinate candidates: solo layout, bounded fallback and ranges.
node scripts/check-ds-screen-synthetic.mjs
node scripts/test-map-coordinate-fallback.mjs
node scripts/test-coordinate-range-ui.mjs

# A fixed house display anchor cannot become a physical chunk estimate.
node scripts/test-map-marker-coordinate.mjs

# Static exit facts and explicit local mining action; no private inputs.
node scripts/test-map-exits.mjs
node scripts/test-map-exits-ui.mjs

# Explicit first-spawn replay; portable inputs only, no private fixture required.
node scripts/test-at-source.mjs
node scripts/test-first-spawn.mjs
node scripts/test-first-spawn-page.mjs
node scripts/test-monster-newborn.mjs
node scripts/test-newborn-replay.mjs
node scripts/test-multi-actor-replay.mjs
node scripts/test-map-transition-replay.mjs
node scripts/test-pickup-materialization.mjs
node scripts/test-pickup-transition.mjs
node scripts/test-pickup-updater.mjs
node scripts/test-f06-continuation.mjs

# Static creator values from the local ROM; allocation bindings remain guarded.
node scripts/test-monster-creation-resources.mjs

# Fixed RT-DETR browser runtime input/output guards.
node scripts/test-rtdetr-runtime-check.mjs

# Bounded frozen-frame enemy ROI proposal contracts.
node scripts/test-resource-decoders.mjs
node scripts/test-monster-position-proposals.mjs
node scripts/test-monster-warm-split.mjs
node scripts/test-monster-proposal-accounting.mjs

# Connected original-state F06 motion through the first guarded selection draws.
node scripts/test-f06-hero-motion.mjs
node scripts/test-f06-creator.mjs

# Explicit bounded F06 fresh-origin keyboard contracts.
node scripts/test-f06-keyboard.mjs
node scripts/test-f06-origin.mjs
