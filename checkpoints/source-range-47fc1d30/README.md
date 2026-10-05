# Conditional source monster range

Source-only additive checkpoint. It is not a current false-positive repair or a universal draw-distance gate.

## Source rule

`readNaturalMonsterRangeRule({sdk, fieldOverlay})` verifies the supported ARM9/overlay17 code and decodes the post-tick lifetime box and exemptions from it. The supported rule is an inclusive XYZ box of source FX32 half-width0x19000 around same-map typed actor registry indices0..3. These indices are not assumed to denote four independent multiplayer leaders. Header mask0x0002, map ID and raw coordinates are separate required facts.

The source has route flags0x2/0x4/0x8, manager-map and post-tick state exemptions. The implementation supports only the explicitly supplied offline/raw-coordinate path. Other controller modes and coordinate replacement records remain unknown. No source camera anchor, model ID, ROM encounter row or visible character count supplies missing runtime flags or coordinates.

`evaluateNaturalMonsterRange({rule, actor, context})` returns the exact supported post-tick predicate result: retain, reset-deactivate or unresolved. The actor needs `positionFx`, `mapId`, `routeFlags` and, when the native branch reaches it, `state`. Context needs `afterTickReached:true`, `globalWord:0`, enabled `fieldGroupFlags`, `managerMapId`, `typedRelookupSameActor:true`, and four distinct `rangeActors` entries for indices0..3. Each entry has `slot`, `typedLookupKnown:true` and `pointer`. A nonzero returned pointer also needs `mapId` and `positionFx`. A missing/sparse/unknown entry is not an absent actor. All inputs refer to the same post-tick actor lifetime.

Reset intent is not video absence. To exclude a draw, the actual reset must have completed before the draw of the same lifetime with no intervening reactivation/recreation or relevant mutation. This module does not establish that condition, so `drawExclusionCertified` always remains false. Every result preserves unknown alternatives and adds zero proven AT calls.

## Additive proposal hook

`attachSourceMonsterRange(proposals, {rule, frame, branchId, regionId, modelId, variant, binding})` returns a new array in the same order. Each proposal keeps all original fields and receives `sourceRange` metadata. Nothing is deleted, rescaled, rescored or promoted to an identity.

A binding must independently match the complete frozen frame (`romSHA256`, `recordKey`, `sourceId`, `sourceEpoch`, `timelineSegment`, `mediaTime`, `fullRGBA_SHA256`) and exact branch/region/model/variant. It supplies `actor` and `context` as above. The proposal's own source-root position replaces only `actor.positionFx`. Missing, stale or differently scoped bindings remain unresolved. This contract does not authorize hand-entering guessed flags or party absence to obtain a desired outcome.

The optional auto-support patch accepts `request.sourceRangeBindings` as a bounded list of such independently supplied bindings. Zero, duplicate, oversized or malformed matching entries leave the domain unresolved. Existing requests do not supply these facts and therefore gain unresolved metadata only. Source-rule failure is also nonblocking. The best tested native result carries the metadata; old body fits, appearance order, conditional predictions and AT evidence are unchanged.

Patch base: SHA256 `73d6cd82e9c06827deb3113306408c75220580df285462a57148da1de47aa7df` of `web/monster-native-auto-support.mjs`. Apply the small patch rather than replacing a concurrently edited file. Copy the new range module alongside it. The full file is provided only for an isolated exact-base test.

## Validation and external inputs

Run `node scripts/validate-source-range.mjs --web PATH_TO_EXISTING_WEB --rom PATH_TO_ROM`. The existing web tree must provide the ARM9/overlay readers; all ROM bytes remain external. The module under test is the packaged source file.

Local validation compared366 supported original-ARM synthetic branch vectors,12 unchanged formal-state post-tick observations, and12 original-source disabled-bit/draw-branch leaf cases. These are bounded witnesses, not full gameplay/video or all-input acceptance. Missing-context and source-mutation tests also passed. The optional hook preserved the exact tested native scores/unsupported outcomes and the existing legacy decisions on the fixed anchors. No browser run, DINO rerun, complete pose domain or current species certification is claimed.

There are no ROM, RAM, SAV, video, model, geometry, image or captured-runtime assets in this package. Source addresses, source rule constants and source fingerprints are validation logic rather than bundled game content.
