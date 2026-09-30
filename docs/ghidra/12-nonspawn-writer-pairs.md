# Non-spawn initialization: actual return/writer pairing

2026-09-30; dq9_new2.nds; fresh supplied erahulita.dst.

## Observation
`erahulita-at46-c3.json` starts from299291569. Before the first field spawn/table draw there are24 updates: alternating6 movement-controller initializations and6 actor-phase initializations, then12 pickup materializations. Their actual return PCs are020409d0,0203ccf0,0208fbd8.
Restored the same state and attached `scripts/nonspawn-consumers.pscript.js`. Independently recorded random return, destination object, bounds where relevant, and value AFTER the actual writer. The24 random returns agree in order with the earlier46-call recording. Actual values are stored in `erahulita-nonspawn-pairs-c3.json`.

## Exact arithmetic under the observed reached branches
|Kind|Return PC|Writer|Computation|
|---|---|---|---|
|movement-init|020409d0|020409dc to object+4|random%2000+2000|
|actor-phase-init|0203ccf0|0203cd18 to object+0x84|truncate(float32(float32(random%200)/100)*4096)|
|pickup-materialize|0208fbd8|0208fbec to object+0x10|lower+random%(upper-lower)|
The12 observed pickup descriptors have lower4096, upper49152, an exclusive upper range. Their random outputs are below the span; the modulo branch still comes from the instruction sequence rather than fitting these12 numbers.
Ghidra helpers0200c084 and0200c698 already have canonical names FloatDivision and FloatMultiplication. Initial batch using guessed FUN names failed, then resolved with get_function_by_address. FloatDivision and FloatToInt1@0200c4c0 were decompiled; single-precision division and truncation retained in WASM. Constants0203cd48=100.0f,0203cd4c=4096.0f were read directly.

## Scope
Reached-event arithmetic is reusable across maps; deciding which actors/resources instantiate, their order, and draw-free skipped paths still needs map/runtime inputs. These observations do not prove that all6 actors are NPCs or that the12 pickup entries are pots/barrels. Do not promote these object counts into a universal per-map consumption rule. Container break/loot and ongoing NPC motion remain separate paths.

## Production integration
`wasm/world_at.c` and `web/world-at.mjs` implement ordered reached consumers. Unknown reachability, unknown type, or unsupported descriptor bounds suspend with the minimum consumed prefix, rather than guessing. Worker operation `world-consumers` and existing actual trace importer use this code. This does not alter ATSession proof state or add a boot reseeding path.

## Related actual results
The four actual AT recordings now total303updates,175ATRandInt returns and25creation inputs; pre-world-module replay allmatch. Candidate/save-restore executes all25 observations, keeps actual positions, and does not promote state-relative lower bound above0. World-module writer replay now completed using the5292-byte Codespace build SHA280d1d50f4b28895e000e9cdeef51430800fb746dc70d21c8aede0c136812d5a:24/24 paired outputs match with0 mismatches (actual-world-consumer-replay.json).
