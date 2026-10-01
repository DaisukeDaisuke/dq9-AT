# F06 native recovery checkpoint, 2026-10-01 UTC

This is a fresh, bounded native observation on a **new explicitly recorded SAV/input route**. It is not a reconstruction of the lost original frame950 runtime/trajectory, not a blind result, and not yet a rerun of the complete production replay. The public implementation remains stopped before the F06 creator result.

## Newly verified

- The unchanged Japanese revision0 ROM was imported into the restored headless observer runtime. Raw SAV import verified its byte roundtrip and reloaded at paused frame0
- The restored original observer runtime is unchanged. ARM9/ARM7 CPU state, rendering boundaries, and input commands were matched between observer-off/on runs
- A new origin at frame1200 reaches maps7402→7401→7400→20006 using the recorded explicit buttons/frame commands. Its shrine birth timing differs from the old route; equal terminal AT numbers do not prove the old trajectory was recovered
- Four independent observer-off/on profile pairs each retained1,900 events, zero drops, continuous sequences,98 matching CPU/selected-memory/pixel boundary comparisons, and11 exact full4MiB RAM comparisons
- All observed instructions match source-checked bytes at their configured sites. The event sequence, registers, CPU state and instruction identity are identical across profiles after excluding only the differently configured observation words. Cross-profile final RAM differences are explicitly recorded at0x023ffded/0x023ffdee; no cross-run full-RAM identity is claimed
- Every one of134 AT entry/return pairs agrees with the LCG recurrence from the newly sampled origin seed0x9ebad4ad. Final seed is0xa46fab4f

## Exact creator/scheduler boundary

At completedFrames2052 (within the frame that completes2053), the F06 scheduler starts with timer986 and advances it to1019. The table and weighted selections add two draws, giving134 total calls from this run's1200 origin. Creator entry selects map20006, table20, species88, node24.

At source-checked creator return021a2e38 and caller return02074ebc:

- Return slot112, actor header35, serial2; global serial counter2→3
- Native XYZ[-30665,9434,-91287]
- Scale halfwords[226,226,226], e0 byte0, route byte0
- Controller binding0x022aa0e0; first four AI bytes[1,2,0,1], AI140=12
- Timer remains1019 and seed remains0xa46fab4f during creator return

At scheduler return02074ecc, timer is0; there are no additional AT draws. This is an exact native return observation, not a claim about the later same-pass hero/body, renderer, or visible-frame attribution.

## Fresh source checks

A new bounded ARM9+overlay17 Ghidra import completed, with original ROM unchanged. The creator, serial allocator, field-template loader, encounter scale conversion and heap reset/allocation leaves were decompiled/disassembled anew.

-0209d7e8 uses float multiply by4096 then signed truncation/halfword storage, or integer shift-left12, replacing signed16 zero with4096
-020321c0→020b14b8(3) resets heap cursors;020b1400/020b1414 do not clear the payload.020b134c zero-fill is conditional on control bit0
- Fresh origin RAM confirms the heap signature/control/extent and all12 pool e0 bytes0x80. This is newly read evidence, not values copied from the recovery narrative
- ROM mining recovers species order[51,10,88,145,256,147], sorted model order[10,51,88,145,147,256], and AI prepend order[256,147,145,88,51,10]. Species88 has widthShort2048,heightShort8192,AI flags0x003c1211,byte2=12,signedByte3=99
- Outer02036260 success still does not imply every descriptor allocation succeeded. The required-descriptor/allocation condition must remain explicit when reconstructing source-only templates

## Checks and remaining work

The current production F06 motion portable suite passes143 checks. The old optional runtime/trajectory replay was not run because its private input files were lost. No source/API claim is substituted for that missing run.

Next: use a newly measured valid origin to rebuild the minimum guarded production input/control stream, exercise existing scheduler/creator APIs, preserve source allocation and parser unknowns, and compare derived output against the held-out return observations above. Later snapshots are comparison-only and must not supply creator results, serial outputs, final coordinates or scale outputs to prediction.

No ROM, SAV, raw RAM, frame pixels, extracted game assets, or private runtime packet is part of this report. No public implementation was changed or pushed by this checkpoint.

## Additional local-origin production replay, 23:04 UTC

The frame2052 observer-off main-RAM snapshot is a fresh local origin strictly before the due scheduler invocation. It is not treated as a state derived by the1200-origin model. Prediction reads that earlier runtime and ROM only, derives preferred node/candidate/table/species, executes the unchanged production `FirstSpawnReplay`/`FieldScheduler`/`projectMonsterCreation`, and writes the projection before opening the held-out return observations.

The local-origin conditional replay passes167 checks, including13 negative/absent-resource cases. It starts at seed0x16e2ca29/timer986 and derives2 draws, seed0xa46fab4f/timer0, slot112/species88/table20/node24/serial2, XYZ[-30665,9434,-91287], heading11657 andscale[226,226,226]. Exact observed return values match for XYZ, scale, header, serial, controller binding and the measured AI fields. The missing template/component/material/serial/terrain and alias cases stop unknown while retaining the two-call prefix; explicit absent model/AI allocation returns rejection without resetting timer1019.

This closes one conditional local-origin numeric creator transition using existing production modules. Ordinary scene/effective-position/stability conditions remain explicit. It does not establish source-only template allocation success, reconnect the complete1200-origin replay, or extend through same-pass hero/body. No future creator output is used as a prediction input. The helper and numerical result are private reproducibility artifacts; raw runtime inputs remain excluded from the source release.

## Recovered1200-origin first segment, 23:15 UTC

A fresh initial runtime-v1 and trajectory-v1 have now been reconstructed from the new frame1200 original and source-ordered control observations. Both the unchanged production factory `createFirstSpawnReplay` and its underlying engine produce identical outputs. Prediction is frozen before native outcome comparison.

The first85 shrine scheduler phases produce119 calls, seed0xf5ffc6ac, timer0 and species83/slot112/serial1 at XYZ[0,1066,16384]. All85 native scheduler seed/timer triples and the captured numeric creator fields agree;134 checks pass. Five native terrain object bindings were extracted at1200 and matched to the same ROM scene/resources, preserving inactive objects/ancestors and zero-transform checks rather than omitting them.

This segment stops at the first shrine creator. It has not yet composed the remaining16 shrine body/walking phases, three map transitions and F06 continuation from1200. The valid local2052-origin result above remains a separate test. Complete input conversion does not claim a video-origin AT navigator.

## Extended complete shrine prefix, 23:22 UTC

The regenerated1200-origin runtime-v2 and measured trajectory-v2 now pass through all101 complete shrine phases using the unchanged production factory:119 calls, seed0xf5ffc6ac, field timer528. The derived actor has e0=0,stateTimer561,17 updates andserial1. All101 native scheduler seed/timer triples and the held-out completed-frame1400 actor XYZ/e0/state/timer/counter agree (107 checks). The four dynamic anchors and controller/script/hero gates were read from the original1200 RAM, with source getters freshly checked. The three map transitions and F06 constructor carry remain the next separate boundary.

A source naming issue was also identified: the legacy transition primitive `networkWord` is used by placement opcode14/17 handlers via02010210, which reads registry+0x3dc and tests whether the day/time category is nonzero. It is not a network-mode word. The original1200 value2 and resulting branch remain unchanged. This naming correction does not imply a numerical regression or general day-clock support.
