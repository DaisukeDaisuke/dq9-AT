# Encounter-context admission for automatic monster background work

Baseline: source checkpoint `6abc3897` supplied by the parent. This change only gates automatic monster recognition; explicit map/background previews keep the prior route.

## Source decision

The current path builds its residual model bank from `data/prm/encfld.bin`, through `decodeCalls`, `decodeEncounterContexts` and `contextsForMap`. It previously reached that lookup after scene/camera/material search. Admission now uses the same context decoder before `AutomaticVideoAlignment.scene`, including continuity-cache probes. It does not load DINO, a model catalog or encounter distributions to make this decision.

A fully decoded supported stream with no group for a candidate produces `no-encfld-group`: retain its name/map/time evidence but skip that candidate's expensive monster-background work. This is not monster absence, map identity or proof of zero AT consumption. Recognized candidates remain in map-name and search diagnostics and in timeline provenance. An explicit preview remains possible.

Missing files, empty streams, malformed boundaries, unknown command signatures, missing table flags/entries and other unsupported input produce `unknown`. They retain the existing background route. An incomplete decode cannot authorize a negative decision. All conditional groups and time/area flag rows survive without selection or threshold changes.

## Bounded verification

- Focused regression: 101 assertions, including 18 malformed/unsupported input cases, manual-preview isolation, cancellation and continuity-cache bypass prevention.
- Standard `scripts/build.sh` passes with LLVM19; the new regression is included. Existing capture / minimap-registration / marker / shell checks also pass (417 / 37 / 60 / 50).
- Current owned ROM: 23,072-byte encounter stream, 1,830 calls, 210 groups and 287 rows. All 210 groups and all 287 rows retain admission. Across its 1,010 maplist records, 210 retain the encounter-backed route and 800 have no group.
- All 21 catalog variants named てんしかい have no group. A boundary test retains all 21 names while invoking scene loading zero times. It uses synthetic pixels and does not claim browser/video latency.
- Historical 1200-second input: F01/map20001 and F43/map20043 remain eligible; F01M01/F01M02/H03 remain named alternatives without context-backed background work. Historical 4200: F04/map20004 remains eligible.
- Historical 2355: F02/map20002 retains its three rows. S03/map5300, S03M01/map5301 and the formerly selected S04/map5400 have no context and are skipped for this workflow. The old S04 result remains historical evidence; it is not forced through an exception or reclassified as current truth.

Current-ROM measurements and input hashes are in the separate private verification record. This patch contains no ROM, video, extracted assets, state/RAM/save data, generated browser capture or binary build output. Actual browser verification belongs to the parent integration task. No all-input recognition or complete automation claim is made.
