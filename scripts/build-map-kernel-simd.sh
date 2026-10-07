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
OBJECT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dq9-map-simd.XXXXXXXX")"
printf 'SIMD object directory retained: %s\n' "$OBJECT_DIR"
OBJECTS=()
for SOURCE in wasm/map_render.c wasm/at_core.c wasm/field_at.c wasm/map_position.c wasm/world_at.c; do
 [[ -f "$SOURCE" ]] || continue
 OBJECT="$OBJECT_DIR/$(basename "${SOURCE%.c}").o"
 FLAGS=(); if [[ "$SOURCE" == wasm/map_position.c ]]; then FLAGS=(-msimd128); fi
 "$CLANG" --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin "${FLAGS[@]}" -c "$SOURCE" -o "$OBJECT"
 OBJECTS+=("$OBJECT")
done
MEMORY_EXPORT=()
if "$LD" --help | grep -- '--export-memory' >/dev/null; then MEMORY_EXPORT+=(--export-memory); fi
mkdir -p web/wasm
"$LD" --no-entry "${MEMORY_EXPORT[@]}" --export=__heap_base --initial-memory=33554432 --max-memory=134217728 "${OBJECTS[@]}" -o web/wasm/map_render_simd.wasm
printf 'Built '; wc -c < web/wasm/map_render_simd.wasm
