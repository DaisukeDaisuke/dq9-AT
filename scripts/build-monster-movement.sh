#!/usr/bin/env bash
# Standalone source-only build; no ROM, save, native fixture or Emscripten runtime.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLANG="${CLANG:-clang}"
WASM_LD="${WASM_LD:-wasm-ld}"
BUILD="$ROOT/.build/monster-movement"
OUT="$ROOT/web/wasm/monster_movement.wasm"
mkdir -p "$BUILD" "$(dirname "$OUT")"
"$CLANG" --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin \
  -c "$ROOT/wasm/monster_movement.c" -o "$BUILD/monster_movement.o"
"$WASM_LD" --no-entry --initial-memory=1048576 "$BUILD/monster_movement.o" -o "$OUT"
node --input-type=module - "$OUT" <<'JS'
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const path=process.argv[2],bytes=await readFile(path),module=new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module),[]);
const names=new Set(WebAssembly.Module.exports(module).map(e=>e.name));
for(const name of ['memory','monster_motion_input','monster_motion_output','monster_motion_trig','monster_motion_atan_table','monster_motion_prefix','monster_motion_turn_angle','monster_motion_state2_steer','monster_terrain_input','monster_terrain_output','monster_terrain_query','monster_walking_terrain_query','monster_walking_anchor_test'])assert(names.has(name),`Missing export: ${name}`);
console.log(JSON.stringify({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),imports:0,exports:[...names],scope:'ABI only; native numerical replay is separate'}));
JS
