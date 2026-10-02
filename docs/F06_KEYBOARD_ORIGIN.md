日本語要約: F06の記録済み初期状態から、味方の上下左右への移動・キーを離した減速停止・下への再開を、実際の再現器の入口で検証した。直進・右転回・上転回・左転回の4経路で、位置・角度・速度・ノードと続く2回の乱数消費がROMに一致。対応入力はDown／Right／Up／Left／Noneに限定する。従来packetは生成結果の手前で停止し、任意の同一初期時点creator packetがある場合は生成関数の戻りまで導出する。起動から全経路を予測した証明ではなく、初期状態・時計入力・カメラ不変などの条件を明示した限定対応。

# Bounded F06 keyboard origin replay

## Supported path and stopping point

`createFirstSpawnReplay` accepts a separate `dq9-f06-origin-runtime-v1` packet with `originKind: "fresh-f06-pre-scheduler"` and a matching `dq9-f06-origin-controls-v1` trajectory. This runs the existing `FirstSpawnReplay.advance` / F06 continuation machinery. It is not an arbitrary-map save-state importer and does not invent transition history.

The original state is a fresh F06 field0 with timer0, flags12, globalWord0, one selected HERO, a positive ordinary load lock, stationary heading0/speed0,12 distinct registered free/inactive natural objects, complete node flags, and explicit original HERO/clock/environment primitives. Pose and node belong to the original frame only. ROM-derived scene, terrain, graph, encounter distributions and direction table are reconstructed locally. Initial scene/NPC binding, unmodeled writers, camera invariance, complete reached clocks and exclusion of other AT consumers remain explicit conditions.

Every tick contains sourceFrame, scheduler delta, scaled controller delta, phase, one of Down/Right/Up/Left/None, and all ordinary keyboard gates. `None` means released directions. Diagonals, touch, changing camera yaw, special motion and missing/false/unknown gates are rejected. Keyboard effects occur after the current motion update. Release retains the target direction; resumed Down sets target0. Right6434/Down0/Up12868/Left19302 are read from guarded ARM9 input-reader, direction-byte branch and table literals in the locally supplied ROM.

Without the optional creator input described below, the factory stops before creator result. It never accepts `continueNewborn: true` or continues unknown post-creator consumers. Its other-consumer exclusion is a declared condition, not a full-world simulation. Reached clock inputs are explicit, not predicted.

## Legacy compatibility

Existing `dq9-f06-hero-motion-v1` packets and streams containing only Down remain unchanged. Optional `keyboardGates` on their control stream enables the same narrow cardinal/release path. `heldDirections` alone cannot enable alternative directions. The continuation passes the corresponding validated input for each tick.

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

The new readers bind Up mask0x40 at02012134 and Left mask0x20 at0201210c, including full reader instructions, branch calls, direction-byte8/10 stores, and table entries0/2 at ROM table020e8150. Equivalent bindings are checked for Down/Right. All keyboard gates remain mandatory. Diagonals stay unsupported. Each route has four observer-off/on profile pairs with64 frame checks and5 full-RAM checkpoints, zero drops, and unchanged yaw0 checked only as comparison. Future native outputs are opened only after the production projection file is frozen.


## Deployed Down/Right UI check

Release08e19525c6410672d4a79cd0250445dc82ddcac6 passed CI/deploy36955480109 and real cloud Chrome first-spawn panel checks. Both original routes reached30 stages,2 AT calls,seed0xa46fab4f,timer1019,node24/table20/species88,stopping before creator. Distinct endpoints matched the native comparison. Reset and repeated initialization reproduced results; missing files/declaration, wrong runtime schema and newborn continuation were gated. Restoring valid inputs recovered. These were UI-level checks, not a deployed-byte or traffic audit. The subsequent Up/Left release1ae134b5fec598fbd45b51f1e119f2f780b8f03e passed exact CI/deploy36956415149 and actual cloud Chrome checks: Up selected node25 at [-16220,9420,-155084], Left selected node24 at [-23134,9420,-149448], both30 stages/AT2/seed0xa46fab4f/timer1019/table20/species88. Reset/reinitialization, diagonal rejection and valid-input recovery, plus Down/Right smoke checks passed. This is bounded UI-level validation before creator, not a byte/traffic audit or whole-game proof.

## Optional same-origin creator return

The same factory now accepts paired optional `creator` and `creatorContext` fields. `creator` is the existing `dq9-f06-creator-v1` packet with the same original frame, original pool-heap words and the existing thirteen constructor/allocation/writer conditions. Those conditions remain explicit assumptions; this extension does not establish allocation success or introduce another success/stability flag. `creatorContext` contains only the original controller pointer, four field identity/map/flags/creation counters, twelve pool e0 bytes, and complete serial counter/registry/48-slot/four-external-record primitives. Original free slot/header identities must agree with the existing inventory. Groups1–3 must be explicitly known absent. Unknown, contradictory, extra/future fields and mismatched frames are rejected; false/unknown constructor conditions stop unresolved at the creator.

`prepareF06Creator` and `bindF06CreatorOrigin` feed the existing `advanceF06Continuation` creator branch. Template/config/model resources, partial component tag, placement, serial selection and actor values are derived there from the local ROM and original inputs. No selected species, future pointer, animation allocation outcome, native later position/status or RNG result is accepted. Without the optional pair, original packet outputs remain unchanged.

Four new native ROM+SAV boot replays cover straight, Right/release, Up/release and Left/release from fresh1990. The actual factory reaches the source creator return at2052, slot112/species88/table20/serial2/e0=0, with two AT calls from this origin and seed0xa46fab4f. Successful creation resets the scheduler timer to0. Thirty-one projected numeric actor fields match the post-creator/pre-body2053 RAM checkpoint for each route. Exact native creator entry/return and RNG entry/return registers agree; each off/on pair has65 CPU/state/pixel comparisons and seven equal4MiB RAM checkpoints, with zero dropped events. Projections are frozen before the verifier opens later outcomes.

The native body at2053 is a later phase of the same controller invocation, not an additional scheduler tick. This optional path deliberately stops at creator/scheduler return before same-pass HERO/body and leaves `futureActorTicksPermitted:false`, visual state and world step unresolved. It is a real fresh-origin factory prerequisite, not first-body continuation or a carried1200 proof. Original1990 serial counter2 and slot112 e0=0 are used; the older1200 counter1/e0=128 are not substituted. The retained inner animation object remains the correlated null-or-owned family; no complete type word is invented.
