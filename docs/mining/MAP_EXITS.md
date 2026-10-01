# Japanese DQ9 static exit resources

The [browser parser](../../web/map-exits.mjs) extracts ordinary static exit facts from a caller's local Japanese DQ9 ROM. The retained Japanese revision-0 validation run extracts **978 conditional exit rows**, preserving duplicates and source order. The website distributes the parser; the factual JSON is generated from the local ROM you supply. It is not a traversal graph.

The project strategy is browser-local ROM mining for resource facts and map-ID bindings. A small separately sourced annotation/mapping JSON is appropriate only for information the ROM cannot provide. Legacy encounter labels are not used as truth or as a location join.

The reproducible revision-0 baseline is game code `YDQJ`, 268,435,456 bytes, SHA-256 `3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7`. The CLI computes this identity outside the browser parser. A supplied NitroFS instance exposes its game code, but does not expose enough header data to independently check revision or hash.

## Local browser API

On the map browser or map-recognition page, load a local NDS and explicitly choose **投入NDSの静的出口 JSON**. The existing Worker mines once and downloads the factual model. It does not run during frame tracking or select an exit for the current player. The button is disabled while one request is pending; replacing or releasing the NDS terminates that Worker and invalidates the request. No ROM-derived dataset is bundled or fetched. A parser error or exhausted resource budget produces no partial download.

```js
import {mineMapExits} from './map-exits.mjs';

const model = mineMapExits(await selectedLocalNdsFile.arrayBuffer());
// Or reuse the browser's existing project.nitro without parsing the ROM twice:
const sameFacts = mineMapExits(project.nitro);
```

`mineMapExits(input)` is synchronous and returns a fresh JSON-compatible model. It accepts an `ArrayBuffer`, a `Uint8Array` (including a nonzero byte offset), or an existing NitroFS object with `readFile`, `readDir`, and `cartridgeHeader.gameCode`. Run a full ROM pass in an existing worker to avoid blocking the interface. The module does not fetch, upload, write files, read a pathname, modify the supplied data, or compute a digest.

`decodeMapExitCalls(bytes, source, mapRecords)` is the smaller stream-level API. `bytes` must be an expanded BMBl stream. `source` contains `archivePath`, `member`, `memberIndex`, and `memberArchiveOffset`; `mapRecords` is a dense bounded list of `{mapId, fieldCode, callIndex, callOffset}`. It returns `{exits, capacityDeclarations}`. Other caller properties are not copied into the result.

The implementation reuses the existing NitroFS, NARC, Compression and typed-call parsers. It checks container extents, FNT cycles, member copy budgets/overlap, LZ10 references, stream counts and string extents before invoking permissive shared readers. Bounds include 4 MiB per resource, 16,384 exit rows overall and 64 MiB of decoded BMBl streams overall. Malformed inputs and exhausted budgets throw rather than yield a silently incomplete inventory. Raw streams with sixteen calls are distinguished from LZ10 by validating the entire call stream before decompression.

## Output and source interpretation

- `archives`: NitroFS archive order, BMBl member index and archive-relative member start, compression, decoded length, exit count and opcode104 capacity declarations
- `exits[].source`: archive/resource name, member/index/start, decoded-member-relative call index/offset, and every source maplist binding in maplist order
- `kind`, `target`, `trigger`, `destination`, `unknownMetadata`: selected exit fields retain argument index, original type, unsigned `raw32` bit pattern, and decoded value. This is not a dump of unrelated calls or strings
- `target.mapRecords`: exact case-sensitive matches against maplist `fieldCode`. Native helper `0209b6c0` chooses the first such record; `firstMapId` exposes that result. `sourceBindings` associates the archive basename case-insensitively and is explicitly a resource association
- `trigger`: source XYZ/dimensions/rotation plus converted signed32 center and min/max. Native conversion rounds the multiplication as float32, truncates toward zero after multiplying by 4096, then halves the converted dimensions with integer truncation
- `destination`: primary and additional party coordinates, requested entry XYZ in fixed units, facing and low16 rotation/facing storage. Requested Y is not a guarantee of settled terrain height
- `unknownMetadata`: raw fields stored at native `+0x64`, `+0x68`, and optional `+0x6c`. No story-flag meanings are assigned; missing optional fields remain null, with the native default recorded in the schema
- `fieldSchema`: source argument type/width, native field widths and record offsets. JSON normalizes negative zero to 0; the original float32 sign remains exact in `raw32`
- `gateProfile`, `runtimeAvailability`, `traversalProven`: refer to the unevaluated numeric gates in `runtimeGates`. Every row remains `unresolved` and `false`

Opcode 105 (`0201ca54`) is the unrotated form; opcode 114 (`0201cc0c`) adds rotation. The current baseline has only opcode 114, with 25 arguments on every row. The decoder also covers the source-defined base/optional argument forms. It rejects unverified argument types rather than inventing a conversion: numeric geometry may use type 1 or 2; target IDs must be type 1 or a type 0 resource string; kind/metadata/capacity must be type 1.

The loader chain is `02013ed4 → 0201415c → 0201e040 → 0201df5c`, dispatch table `020ef2c4`. Common helper `0201c8ec` resolves the target and `0201e300` appends a 112-byte record only while capacity permits. Failed named lookup does not append, although this inventory retains the source row. The scan in `overlay_d_17:0219d57c` applies numeric controller/world/hero gates, source order and `02031d18` geometry. Kind 1 additionally checks `02039278` and queues via `overlay_d_17:0219bed0`. The factual model records these numeric conditions but cannot evaluate them from the static resource.

## Baseline and retained gaps

The pass reads 681 AMBL archives and 667 BMBl streams. All 978 exit rows match the independent source inventory field for field, including all 25 original typed words, raw source/target aliases, maplist bindings, member names, call offsets and ordering. There are 935 kind 0 and 43 kind 1 rows, 975 exact named target bindings and 760 distinct bound directed map-ID pairs. Grouping those pairs does not remove duplicate trigger rows from the model.

Two type 0 targets with raw offset `0xffffffff` remain null: `C02M15` at call offset 116, and `D04M03` at 228. The target `M07M07` from `M07` at 564 is absent from maplist and remains unresolved. No name similarity or reverse-edge inference fills these gaps.

The inventory does not prove any row is currently loaded, permitted, geometrically reached or traversable. It does not cover scripts, spells, vehicles, runtime replacement/overrides, or generated floors. It assigns no AT cost, seed reset, human map label, encounter region or image-inheritance rule. No legacy encounter labels are used.

## Reproduction and tests

```sh
node scripts/test-map-exits.mjs
node scripts/test-map-exits-ui.mjs
node scripts/mine-map-exits.mjs --rom local-jp.nds
node scripts/test-map-exits.mjs --rom local-jp.nds
node scripts/test-map-exits.mjs --rom local-jp.nds --reference local-independent-inventory.json
node scripts/test-map-exits.mjs --rom local-jp.nds --json local-model.json
```

The miner defaults to `web/data/map-exits-jp.json`; `--out filename.json` chooses another local destination. The test needs no ROM for its synthetic malformed/truncated/count/type/string/container boundaries, LZ10, duplicate/source-order, null/missing targets, fixed-width conversion and no-input-mutation checks. Optional real-ROM tests compare the NitroFS and ROM APIs, all baseline counts, an explicitly supplied local model with `--json`, and all 978 rows against a separately supplied independent inventory. Neither script embeds a private pathname or writes ROM bytes.

The UI check exercises the actual exported-action functions and existing Worker module through a Node bridge, including duplicate, stale, error and release cases. An optional local NDS argument also verifies the complete Worker load→mine→result path. This is transport/lifecycle validation, not a browser visual or runtime-traversal claim.

The source-only publication contains the parser, explicit local action and synthetic tests; no factual dataset or private input is included. Locally generated JSON contains selected map IDs/resource aliases, typed exit fields and widths, resource/call provenance, known numeric gates, counts and missing semantics. It contains no ROM/archive/member byte payload, unrelated call log, human name table, credentials, captures or local filesystem paths.
