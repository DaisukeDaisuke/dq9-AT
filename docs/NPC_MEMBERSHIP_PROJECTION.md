# Source-local NPC membership projection

`web/npc-membership.mjs` is an isolated, map-independent source predicate module.
It does not connect to `ATSession`, initialize a seed, mutate the world, or create
an actual descriptor/controller from a true/false allocation flag.

## Implemented source contracts

- `npcDefinitionExcluded`: RAM `02099e34` uses fixed inclusive map bounds
  **50101..50523** from `02099e58/5c`; RAM `02099eb8` tests signed NPC integer
  **1..63**. Both ignore their state argument. The definition handler skips iff
  both predicates pass. Current map is uint16; the definition ID remains raw32
- `decodeNpcDefinitions`: opcode 3, integer/integer/string/string/integer.
  Preserves raw ID through lookup, with separate stored uint16 ID and byte kind
  and flags. Floating-point identity conversion is deliberately unsupported
- `findNpcPlacement`: ordered logical list lookup corresponding to `0206ec74`,
  comparing the stored byte ID with the **full** definition ID. Raw 257 cannot
  match stored byte 1. First duplicate wins for this lookup
- `npcDefinitionDecision`: fixed exclusion precedes lookup, so a fixed skip can
  resolve without any placement list. Otherwise an incomplete list is unknown;
  a match means the separate definition-node 0x20 allocation is still needed
- `projectNpcDefinitions`: hypothetical prepend order of all eligible definition
  calls, assuming they execute and their allocations succeed. Duplicate
  definitions remain distinct; this is not the original heap list
- `projectUnconditionalNpcPlacements`: a deliberately narrow opcode-3 subset
  derived from `0206d164`. The raw map argument compares against uint16 current
  map without truncation. Matching calls require 0x78 allocation, including
  two-argument removal. The stored ID truncates to byte. Unique-ID insertion
  prepends; removal unlinks the matching ID. Coordinates are shape/finite-checked
  but are not projected. The native ordinal increment, including skipped maps,
  is not exported or simulated because only unique-ID membership is modeled
- Duplicate placement insertion is rejected: `0206ec9c` uses ranked same-ID
  alternate chains (+0x6c/+0x70), not simple last-write replacement. This module
  does not reproduce that ranking, or any conditional placement/modifier opcode

Both list projections explicitly start from an empty-list hypothesis; they do
not assert that the native loader cleared its lists. All list results are
conditional on completed, valid, non-aliasing allocations
and interpreter progress. Allocation failure can prevent a removal and later
calls; no result here claims that those conditions occurred. Unknown opcodes,
malformed shapes and unsupported duplicates invalidate the whole conditional
placement projection instead of returning a seemingly complete prefix.

## Source binding and exact-ROM regression

`readNpcMembershipSource` reads caller-supplied original ROM bytes in memory,
checks SHA-256
`3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7`,
then reuses the existing NitroFS, bounded NARC and call-stream parsers. It binds
an explicit map ID to a unique maplist call and selects exact place/npc member
names in an explicitly named archive. An analyst-selected archive is **not** a
proof of native loader selection. It returns archive/member hashes and offsets;
no extracted assets or private save bytes are committed.

Read-only regression inputs from the resource audit:

- D06M02 / 7602, D06 archive: complete single unconditional placement plus one
  kind-1 definition. The conditional source projection resolves one definition;
  actual membership and map-entry AT remain unknown
- H15 / 16500, H15 archive: opcode 3 plus route modifier opcode 6. The module
  refuses the unsupported modifier and reports unknown membership. Its one
  ROM definition does not become a runtime draw

## AT boundary

Every output retains `provedMinimumAT: 0`, `actualATConsumed: null`,
`runtimeMembershipResolved: false` and `bootProof: false`. A caller's success,
reachability, program counter or seed-epoch flags cannot change them. These are
source projections; restoring/serializing one cannot advance `ATSession`.

The separately verified source lemma is narrower: an actual valid successful
controller 0x20 allocation at `0203d65c/660` reaches `020409bc`, whose
`020409cc` call performs one UpdateAT before kind selection. Arrival at the
allocation return or draw-call instruction is an **open** endpoint. A completed
endpoint such as `020409d0` or caller return `0203d66c`, valid disjoint memory,
one reached invocation and an uninterrupted seed epoch are required for a
positive contribution. The definition-node allocation above is a different
allocation. Later allocation failure preserves an already completed draw but
can prevent later nodes. Source definition counts, kind labels and the 32-slot
storage threshold cannot supply a runtime constructor count.

This module deliberately supplies no API to certify that lemma from labels,
booleans or a later RAM snapshot. Heap production, linked-list aliases,
interpreter continuation, constructor completion and epoch binding remain work
for the original-state/native validation path. Town story/quest/event flags are
independent of the fixed generated-NPC range predicates.

## Verification

Generated synthetic fixtures (invented values; no extracted resource rows):

```sh
node scripts/test-npc-membership.mjs
```

Optional original-ROM regression, printing sanitized provenance/counts only:

```sh
node scripts/inspect-npc-membership.mjs /path/to/original.nds
```

The tests cover inclusive range boundaries, uint widths, raw-vs-stored IDs,
fixed skips with unavailable placement lists, duplicate lookup and definition
order, >32 definitions, unique placement order/removal/re-add, wrapped placement
IDs, unknown opcodes and malformed inputs. Endpoint/allocation/epoch spoofing
cases verify that this projector cannot manufacture a positive AT proof; they
do not claim to execute the native constructor or allocator.
