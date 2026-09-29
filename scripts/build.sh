#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CLANG="${CLANG:-clang}"
LD="${WASM_LD:-$(command -v wasm-ld || command -v wasm-ld-18 || true)}"
if [[ -z "$LD" ]]; then printf 'wasm-ld missing: install lld-18 in the Codespace\n' >&2; exit 1; fi
mkdir -p web/wasm
"$CLANG" --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin -c wasm/map_render.c -o /tmp/dq9-at-map-render.o
"$LD" --no-entry --export-memory --export=__heap_base --initial-memory=33554432 --max-memory=134217728 /tmp/dq9-at-map-render.o -o web/wasm/map_render.wasm
printf 'Built '; wc -c < web/wasm/map_render.wasm
