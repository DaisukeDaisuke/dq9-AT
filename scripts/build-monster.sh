#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CLANG="${CLANG:-clang}"
LD="${WASM_LD:-$(command -v wasm-ld || true)}"
if [[ -z "$LD" ]]; then
  VERSION="$($CLANG -dumpversion | cut -d. -f1)"
  LD="$(command -v "wasm-ld-$VERSION" || true)"
fi
if [[ -z "$LD" ]]; then printf 'wasm-ld missing\n' >&2; exit 1; fi
mkdir -p web/wasm
OBJECT="$(mktemp /tmp/dq9-monster-XXXXXX.o)"
trap 'rm -f "$OBJECT"' EXIT
"$CLANG" --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin -c wasm/monster_geometry.c -o "$OBJECT"
EXPORTS=()
for NAME in input vertices indices matrix stack commands vertex_count index_count error_opcode error_offset reset decode; do
  EXPORTS+=("--export=monster_$NAME")
done
MEMORY_EXPORT=()
if "$LD" --help | grep -- '--export-memory' >/dev/null; then MEMORY_EXPORT+=(--export-memory); fi
"$LD" --no-entry "${MEMORY_EXPORT[@]}" --initial-memory=16777216 "${EXPORTS[@]}" "$OBJECT" -o web/wasm/monster_geometry.wasm
printf 'Built monster geometry WASM: '; wc -c < web/wasm/monster_geometry.wasm
