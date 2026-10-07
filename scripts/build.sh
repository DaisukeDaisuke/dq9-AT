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
CLANG="$CLANG" WASM_LD="$LD" bash scripts/build-map-kernel-simd.sh
node scripts/test-map-kernel-loader.mjs
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

# Cross-map numerical tests retain unknown outcomes without proof increments.
# Production UI rejects memory-marked snapshots; isolated synthetic arithmetic remains testable.
node scripts/test-at-session.mjs
node --test scripts/test-map-entry-at.mjs

# Conditional NPC membership stays separate from runtime AT proof.
node scripts/test-npc-membership.mjs
node scripts/test-npc-at-continuation.mjs
node scripts/test-actor-rom-mining.mjs
node scripts/test-npc-at-replay.mjs
node scripts/test-npc-replay-panel.mjs

# Capture identity must stay tied to frozen pixels across asynchronous analyses.
# The panel harness must resolve browser cache-query imports as module URLs.
node --experimental-vm-modules scripts/check-video-panel-capture.mjs
# Skip unsupported-by-context monster background work without dropping map evidence.
node scripts/test-automatic-monster-map-eligibility.mjs

# Explicit CPU/GPU asset preparation, cancellation and cached-only retry.
node scripts/test-residual-inference-preparation.mjs
node scripts/test-native-request-branches.mjs
node --test scripts/test-classification-display-deferred.mjs
node --test scripts/test-video-pipeline-timing.mjs
node --test scripts/test-first-gap-timing.mjs
node --test scripts/test-rejected-camera-evidence.mjs
node --test scripts/test-rejected-local-patch-evidence.mjs
node --test scripts/test-paused-local-video-startup.mjs
node --experimental-vm-modules --test scripts/check-paused-video-startup-panel.mjs

# Experimental ROM-derived pose matching: portable CPU/Worker and parser checks.
node scripts/test-monster-animation.mjs
node scripts/test-monster-recognition.mjs
node scripts/test-monster-recognize-page.mjs

# Explicit one-frame CPU glyph fallback; no GPU globals or private fixture inputs.
node scripts/test-font-akinator-cpu.mjs
node scripts/test-font-akinator-cpu-client.mjs
# Shell checks compare module paths independently of cache-query versions.
node scripts/test-map-recognize-page.mjs

# Approximate map-coordinate candidates: solo layout, bounded fallback and ranges.
node scripts/check-ds-screen-synthetic.mjs
node scripts/test-map-coordinate-fallback.mjs
node scripts/test-video-minimap-registration.mjs
node scripts/test-coordinate-range-ui.mjs

# A fixed house display anchor cannot become a physical chunk estimate.
node scripts/test-map-marker-coordinate.mjs

# ROM-local map display coordinates and reference overlays.
node scripts/test-map-coordinate-index.mjs
node scripts/test-map-coordinate-panel.mjs
node scripts/test-map-position-identification.mjs

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


# Source-bounded geometry line search and non-finite/cancellation guards.
node scripts/test-geometry-position-refinement.mjs

node scripts/test-original-proposal-support.mjs

# Detached immutable observation ownership, preserving generic clone semantics.
node --test scripts/test-observation-bundle-ownership.mjs

node --test scripts/test-tracking-preparation-copy.mjs

node --test scripts/test-map-input-timing.mjs

# Reuse only private same-frame upper preparation; preserve per-descriptor outputs.
node --test scripts/test-video-upper-preparation.mjs

# Capture/input tasks can run between continuity descriptors; stale work aborts.
node --test scripts/test-continuity-descriptor-yield.mjs

# Exact request-local completed minimap search reuse; incomplete work reruns.
node --test scripts/test-completed-minimap-registration-reuse.mjs

# ROM-only ordered field table preparation; runtime remains explicit.
node scripts/test-field-spawn-source.mjs

# Ready mode1 source-bounded fallback only after every original pass failed.
node scripts/test-ready-mode1-geometry-fallback.mjs

# Conditional mode1 map/actor/MSE replay and retained isolated results.
node scripts/test-mode1-mse-composition.mjs
node scripts/test-native-isolated-support.mjs

# Exact native yaw classes, resumable continuation and lossless evidence.
node scripts/test-native-yaw-domain.mjs
node scripts/test-native-yaw-continuation.mjs
node scripts/test-native-yaw-evidence.mjs

# Conservative final-color ownership for the conditional MSE subset.
node scripts/test-native-mse-ownership.mjs

# Exact SDK phase-domain cursor, bounded continuation and lossless evidence.
node scripts/test-native-phase-domain.mjs
node scripts/test-native-phase-continuation.mjs
node scripts/test-native-phase-evidence.mjs

node scripts/test-monster-classification-timing.mjs
