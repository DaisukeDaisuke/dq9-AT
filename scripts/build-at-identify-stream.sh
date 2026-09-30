#!/usr/bin/env bash
# Exact reviewed streaming kernel; Pages verifies the supplied source-built artifact.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLANG="${CLANG:-clang}"
OUT="$ROOT/web/wasm/at_identify_stream.wasm"
CHECK="$OUT"
case "${1:-}" in
  --verify) ;;
  "") mkdir -p "$ROOT/.build/at-identify-stream"; CHECK="$ROOT/.build/at-identify-stream/candidate.wasm"
      "$CLANG" --target=wasm32 -O3 -ffreestanding -nostdlib -Wl,--no-entry -Wl,--export-all -Wl,--initial-memory=524288 "$ROOT/wasm/at_identify_stream.c" -o "$CHECK" ;;
  *) echo "Usage: $0 [--verify]" >&2; exit 2 ;;
esac
node --input-type=module - "$CHECK" <<'JS'
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const bytes=await readFile(process.argv[2]),module=new WebAssembly.Module(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256,'fe39118a209b516d55456ded498a2dfc627cf473d248c29dd176e5316a9ca955','Different artifact requires equivalence review; do not remove this guard');
assert.deepEqual(WebAssembly.Module.imports(module),[]);
for(const name of ['memory','mask_address','gap_min_address','gap_max_address','output_address','begin','scan_chunk','total_processed','total_matches'])assert(WebAssembly.Module.exports(module).some(e=>e.name===name),name);
console.log(JSON.stringify({bytes:bytes.length,sha256,imports:0,scope:'frozen streaming kernel hash/ABI; no current-game AT claim'}));
JS
if [[ "$CHECK" != "$OUT" ]]; then mkdir -p "$(dirname "$OUT")"; cp "$CHECK" "$OUT"; fi
