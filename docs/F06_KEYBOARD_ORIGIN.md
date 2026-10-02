日本語要約: 固定cameraYaw=0と既存の明示条件に限り、斜め4方向を本番のF06入力経路へ追加した。原ROMの同時押しbranch・direction table・target writerを照合し、portable／ROM回帰を独立実行した。提出されたnative比較報告は8経路で一致を示すが、全raw profileとobserver非干渉を独立再実行した証拠とは区別する。L/Rカメラ回転・ほこらUpRight+Rの既知不一致は未解決のまま。world/bodyおよびcreator後の既存停止境界は変更しない。

# Bounded F06 keyboard origin replay

## Supported path and stopping point

`createFirstSpawnReplay` accepts a separate `dq9-f06-origin-runtime-v1` packet with `originKind: "fresh-f06-pre-scheduler"` and a matching `dq9-f06-origin-controls-v1` trajectory. This runs the existing `FirstSpawnReplay.advance` / F06 continuation machinery. It is not an arbitrary-map save-state importer and does not invent transition history.

The original state is a fresh F06 field0 with timer0, flags12, globalWord0, one selected HERO, a positive ordinary load lock, stationary heading0/speed0,12 distinct registered free/inactive natural objects, complete node flags, and explicit original HERO/clock/environment primitives. Pose and node belong to the original frame only. ROM-derived scene, terrain, graph, encounter distributions and direction table are reconstructed locally. Initial scene/NPC binding, unmodeled writers, camera invariance, complete reached clocks and exclusion of other AT consumers remain explicit conditions.

Every tick contains sourceFrame, scheduler delta, scaled controller delta, phase, one of Down/Right/Up/Left/UpLeft/UpRight/DownLeft/DownRight/None, and all ordinary keyboard gates. `None` means released directions. Conflicting or three-direction inputs, non-direction button combinations, touch, changing camera yaw, special motion and missing/false/unknown gates remain outside the contract. Keyboard effects occur after the current motion update. Release retains the target direction; resumed Down sets target0. Right6434/Down0/Up12868/Left19302 and the four diagonal values below are read from guarded ARM9 readers, simultaneous-key branches and table literals in the supplied ROM. They are world target angles only when the source camera yaw is0.

Without the optional creator input described below, the factory stops before creator result. It never accepts `continueNewborn: true` or continues unknown post-creator consumers. Its other-consumer exclusion is a declared condition, not a full-world simulation. Reached clock inputs are explicit, not predicted.

## Legacy compatibility

Existing `dq9-f06-hero-motion-v1` packets and streams containing only Down remain unchanged. Optional `keyboardGates` on their control stream enables the bounded eight-direction/release path. `heldDirections` alone cannot enable alternative directions. The continuation passes the corresponding validated input for each tick.

The older carried1200 regression uses measured D04 pre/post-HERO trajectory inputs. It remains useful regression evidence, but is not equivalent to the new fresh-origin no-future-pose proof and must not be described as a fully predicted1200 prefix.

## Released speed residue

Ordinary deceleration may produce a signed speed such as−7 for one pass. In the source02032fc4, released movement with nonpositive old speed resets speed to0 and skips translation. The kinematic guard now accepts negative speed only for movementByte0. Negative active or special movement stays unsupported. The change does not bypass orientation, vertical, goal, acceleration or collision guards.

## Validation result

Two local fresh1990-origin routes, straight Down and Down→Right→release→Down, reached scheduler selection2052 with identical native/predicted30 pre-HERO and29 post-HERO XYZ, angle, node and speed records, timer progression and two ordered AT calls. The seed chain was0x16e2ca29→0x9cdec1ae→0xa46fab4f. Both selected node24/table20/species88, timer1019 before creator. The turn/release route included genuine displacement, deceleration to zero and resumed movement.

The initial yaw0 was checked independently. Later yaw0 is comparison-only; invariance remains a condition. Observer-off/on parity passed for both CPU register sets, screen pixels and relevant runtime state at64 checkpoints and full4MiB RAM at5 checkpoints for each of eight profile pairs. Independently booted profiles differed only at enumerated RTC-region bytes; no exact whole-RAM equality is claimed across separate boots.

These are bounded empirical and conditional source-model results, not universal timing, camera, collision, map-transition, party-following or whole-game RNG guarantees.

## Tests and build

`bash scripts/build.sh` builds the WASM through the existing pipeline and runs the portable aggregate, including `test-f06-keyboard.mjs` and `test-f06-origin.mjs`. `node scripts/test-f06-keyboard.mjs /path/to/local-rom.nds` additionally verifies the guarded local-ROM direction binding. No ROM, SAV, native RAM, private trajectory or generated executable is embedded in the source-only patch.

## Additional cardinal validation

Two additional isolated fresh1990 routes hold Down until2010, Up or Left until2024, release until2036 and resume Down. Both match native through scheduler selection2052:30 pre-HERO and29 post-HERO position/angle/node/speed records, timer progression, and exactly two ordered AT entry/return seeds and random values. The seed chain remains0x16e2ca29→0x9cdec1ae→0xa46fab4f. Up ends at[-16220,9420,-155084] and selects node25; Left ends at[-23134,9420,-149448] and selects node24. Both select table20/species88 with timer1019. These native decision-entry node differences demonstrate the directional geometry consequence. No map transition occurred in either bounded capture; HERO map was checked every frame and global map at each full-RAM checkpoint.

The cardinal readers bind Up mask0x40 at02012134 and Left mask0x20 at0201210c, including full reader instructions, branch calls, direction-byte8/10 stores, and table entries0/2 at ROM table020e8150. Equivalent bindings are checked for Down/Right. All keyboard gates remain mandatory. The earlier cardinal capture used four observer-off/on profile pairs per route; the submitted WORK4 comparison below reports eight profiles per route. Future native outputs are opened only after the production projection file is frozen.

## Fixed-camera diagonal source integration (WORK4)

The integration independently verifies the guarded direction readers, simultaneous-key branch order, direction bytes, ROM table and target-angle writer, and reruns the aggregate plus optional local-ROM regressions. Work3’s exported `sourceArm9` and production AT-source gate are preserved. No C arithmetic, movement WASM source, camera updater, renderer or map UI is changed.

The route endpoints and native counts below come from the submitted comparison reports. Their internal consistency was independently audited; the full per-profile events/commands/summary, off/on RAM/hash, original runtime/controls, frozen projections and builder/verifier were not all supplied. This is not an independent rerun of all native parity or observer-noninterference evidence. Cross-profile bytes at0x023ffdec..0x023ffdee remain a reported difference whose cause/safety has not been established from those missing inputs.

The simultaneous-key branch order is UpLeft, UpRight, DownLeft, DownRight, then Up, Down, Left, Right. The host validator supplies the full active-high12-button mask; the native readers independently test the low16 input word at02114ad0. The source subtracts8 from the direction byte to index020e8150.

| Input | Host mask | Direction byte | Table index | Base angle (cameraYaw0) | Reported final pre-selection XYZ |
|---|---:|---:|---:|---:|---|
| UpLeft | 0x60 | 12 | 4 | 16085 | [-20717,9420,-153945] |
| UpRight | 0x50 | 13 | 5 | 9651 | [-11723,9420,-153945] |
| DownLeft | 0xa0 | 14 | 6 | 22519 | [-21108,9420,-144559] |
| DownRight | 0x90 | 15 | 7 | 3217 | [-11331,9420,-144559] |

The submitted report describes each new route holding Down from1990, its diagonal from2010, None from2024, and Down from2036. It reports30 pre/29 post HERO comparisons per route for XYZ, facing, targetAngle, speed, movementByte, node index, timer and lock, with error0. They each select node24/table20/species88 at2052, timer1019, and two ordered AT draws with seed16e2ca29→9cdec1ae→a46fab4f. The report describes these outcomes as comparisons against a frozen prediction. It reports eight successful observer-off/on profile pairs per route (64 pairs across eight routes),64 frame comparisons and five full4MiB RAM comparisons per pair, drop0. These totals are4096 frame pairs and320 RAM pairs; they are reported counts, not new independent captures. Failed attempts are excluded from the reported passes. Reached clocks remain inputs.

The source binding checks the camera getter (controller+3b0, camera+70), camera-yaw addition/wrap and ordinary target-angle store as well as all four simultaneous-key branches. Tests exercise built C/WASM hold/release/negative-residue/stop/resume, opposite diagonal reversal, cardinal switches, locks, shortest-turn/wrap, phase0..3 and node ties with a synthetic flat-ground fixture. The optional local-ROM test uses ROM trig; native terrain evidence is the separate capture comparison. C arithmetic and generated movement code were not changed.

## Integrated-source verification (2026-10-02)

On the source snapshot for release `e4738a5eb67f65ff74056f0f530645bf56b73c4c`, the five-file integration preserves the Work3 `sourceArm9` export and the Work1–3/map-coordinate additions. The complete 44-script aggregate passes; keyboard portable548, keyboard with original-ROM557 (including both diagonal displacement signs), origin268 and AT-source with original-ROM695 checks pass. Camera values, L/R button combinations, false/unknown camera invariance and future tick fields remain rejected for each diagonal; multi-substep, small-motion rollback, unsupported collision and corrected-height branches remain unresolved.

Using the previously accepted fresh1990 original packet and reached clocks, prescribed fixed-camera schedules were rerun through the current production factory for all eight directions. Predictions were saved before reading the submitted comparison report. All2224 field comparisons agree, including240 pre/232 post HERO states, route endpoints, node/table/species and16 total AT draws; each route remains unresolved before creator with timer1019 and seed0xa46fab4f. This confirms integration against the report with the earlier accepted origin; it does not recover missing WORK4 native raw inputs or establish observer noninterference. Existing fresh1990 (30 phases/2 draws) and connected1200 (149 phases/134 draws) factory results are unchanged from the pre-integration source.

## L/R camera dependency remains unsupported

ROM020a3ea4 reads L(0x200) and R(0x100) through020121ac. Camera flags at+244 can disable both inputs; bit0x10 is tested at020a3f54. Four additional native schedules apply L/R while holding Down or DownRight from2016 through2021, release L/R at2022, release directions at2024 and reapply the same direction at2036. The submitted F06 report says camera+244 is0x10 throughout the window, both rotation inputs are cleared, yaw stays0 and the yaw setter0202e218 is not reached. This is a gated input observation, not validation of active rotation or rotation settling.

The camera update is observed before the scheduler/HERO in the controller order. HERO orientation and speed/XYZ still use the prior targetAngle. The direction path then reads current yaw at02037e1c, adds its base angle at02037e20, wraps at02037e24 and writes targetAngle through0203336c. Thus a changed camera yaw can affect this pass's targetAngle while movement uses the previous target; the new target affects the next supported motion pass. A later frame's RAM yaw cannot replace the yaw actually read at that instruction.

The WORK4 report freezes and compares the additional factory prefixes only before the first L/R input at2016. Later targetAngle/facing/XYZ and camera values are diagnostic comparisons only. The production packet still requires cameraYaw0/invariance and rejects camera values on future ticks. Rotation-enabled native origins, camera writer state/clock derivation, intermediate rotation and settling after release remain unvalidated. General camera-relative movement is not complete, and camera/world/body guards have not been relaxed.

The separate shrine UpRight+R comparison remains a known failed strict check. The first observed X difference is127 between direction-return frame50 and controller-end frame51; subsequent differences can grow. The actual writer and cause remain unknown. No shrine correction or camera-relative implementation is included, and the discrepancy is not converted into AT proof or waived by this fixed-camera integration.


## Deployed Down/Right UI check

Release08e19525c6410672d4a79cd0250445dc82ddcac6 passed CI/deploy36955480109 and real cloud Chrome first-spawn panel checks. Both original routes reached30 stages,2 AT calls,seed0xa46fab4f,timer1019,node24/table20/species88,stopping before creator. Distinct endpoints matched the native comparison. Reset and repeated initialization reproduced results; missing files/declaration, wrong runtime schema and newborn continuation were gated. Restoring valid inputs recovered. These were UI-level checks, not a deployed-byte or traffic audit. The subsequent Up/Left release1ae134b5fec598fbd45b51f1e119f2f780b8f03e passed exact CI/deploy36956415149 and actual cloud Chrome checks: Up selected node25 at [-16220,9420,-155084], Left selected node24 at [-23134,9420,-149448], both30 stages/AT2/seed0xa46fab4f/timer1019/table20/species88. Reset/reinitialization, diagonal rejection and valid-input recovery, plus Down/Right smoke checks passed. This is bounded UI-level validation before creator, not a byte/traffic audit or whole-game proof.

## Optional same-origin creator return

The same factory now accepts paired optional `creator` and `creatorContext` fields. `creator` is the existing `dq9-f06-creator-v1` packet with the same original frame, original pool-heap words and the existing thirteen constructor/allocation/writer conditions. Those conditions remain explicit assumptions; this extension does not establish allocation success or introduce another success/stability flag. `creatorContext` contains only the original controller pointer, four field identity/map/flags/creation counters, twelve pool e0 bytes, and complete serial counter/registry/48-slot/four-external-record primitives. Original free slot/header identities must agree with the existing inventory. Groups1–3 must be explicitly known absent. Unknown, contradictory, extra/future fields and mismatched frames are rejected; false/unknown constructor conditions stop unresolved at the creator.

`prepareF06Creator` and `bindF06CreatorOrigin` feed the existing `advanceF06Continuation` creator branch. Template/config/model resources, partial component tag, placement, serial selection and actor values are derived there from the local ROM and original inputs. No selected species, future pointer, animation allocation outcome, native later position/status or RNG result is accepted. Without the optional pair, original packet outputs remain unchanged.

Four new native ROM+SAV boot replays cover straight, Right/release, Up/release and Left/release from fresh1990. The actual factory reaches the source creator return at2052, slot112/species88/table20/serial2/e0=0, with two AT calls from this origin and seed0xa46fab4f. Successful creation resets the scheduler timer to0. Thirty-one projected numeric actor fields match the post-creator/pre-body2053 RAM checkpoint for each route. Exact native creator entry/return and RNG entry/return registers agree; each off/on pair has65 CPU/state/pixel comparisons and seven equal4MiB RAM checkpoints, with zero dropped events. Projections are frozen before the verifier opens later outcomes.

The native body at2053 is a later phase of the same controller invocation, not an additional scheduler tick. This optional path deliberately stops at creator/scheduler return before same-pass HERO/body and leaves `futureActorTicksPermitted:false`, visual state and world step unresolved. It is a real fresh-origin factory prerequisite, not first-body continuation or a carried1200 proof. Original1990 serial counter2 and slot112 e0=0 are used; the older1200 counter1/e0=128 are not substituted. The retained inner animation object remains the correlated null-or-owned family; no complete type word is invented.
