#!/usr/bin/env bash
# Exact reviewed bounded-search kernel. No ROM or private packet is a build input.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLANG="${CLANG:-clang}"
OUT="$ROOT/web/wasm/at_identify.wasm"
mkdir -p "$(dirname "$OUT")"
case "${1:-}" in
  --verify) ;; # Pages uses the byte-identical reviewed binary, never an unreviewed compiler output.
  "") "$CLANG" --target=wasm32 -O3 -ffreestanding -nostdlib -Wl,--no-entry -Wl,--export-all -Wl,--initial-memory=262144 "$ROOT/wasm/at_identify.c" -o "$OUT" ;;
  *) echo "Usage: $0 [--verify]" >&2; exit 2 ;;
esac
node --input-type=module - "$OUT" <<'JS'
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const bytes=await readFile(process.argv[2]),module=new WebAssembly.Module(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(WebAssembly.Module.imports(module),[]);
for(const name of ['memory','mask_address','gap_min_address','gap_max_address','samples_address','search','accepts'])assert(WebAssembly.Module.exports(module).some(e=>e.name===name),name);
assert.equal(sha256,'a0279c9bd1c810af75640d3c7bba8ab5a65993c55c3dad53df9dc52cc23edb99','Different artifact requires a new equivalence review; expected LLVM/emsdk3.1.6 build');
console.log(JSON.stringify({bytes:bytes.length,sha256,imports:0,scope:'reviewed kernel rebuild/ABI; no state-identification claim'}));
JS
