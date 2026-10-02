日本語要約: F06の記録済み初期状態から、味方の下移動・右への方向転換・キーを離した減速停止・下への再開を、実際の再現器の入口で検証した。2経路とも位置・角度・速度・ノードと続く2回の乱数消費がROMに一致。対応入力はDown／Right／Noneに限定し、生成結果の手前で停止する。起動から全経路を予測した証明ではなく、初期状態・時計入力・カメラ不変などの条件を明示した限定対応。

# Bounded F06 keyboard origin replay

## Supported path and stopping point

`createFirstSpawnReplay` accepts a separate `dq9-f06-origin-runtime-v1` packet with `originKind: "fresh-f06-pre-scheduler"` and a matching `dq9-f06-origin-controls-v1` trajectory. This runs the existing `FirstSpawnReplay.advance` / F06 continuation machinery. It is not an arbitrary-map save-state importer and does not invent transition history.

The original state is a fresh F06 field0 with timer0, flags12, globalWord0, one selected HERO, a positive ordinary load lock, stationary heading0/speed0,12 distinct registered free/inactive natural objects, complete node flags, and explicit original HERO/clock/environment primitives. Pose and node belong to the original frame only. ROM-derived scene, terrain, graph, encounter distributions and direction table are reconstructed locally. Initial scene/NPC binding, unmodeled writers, camera invariance, complete reached clocks and exclusion of other AT consumers remain explicit conditions.

Every tick contains sourceFrame, scheduler delta, scaled controller delta, phase, one of Down/Right/None, and all ordinary keyboard gates. `None` means released directions. Up/Left/diagonals, touch, changing camera yaw, special motion and missing/false/unknown gates are rejected. Keyboard effects occur after the current motion update. Release retains the target direction; resumed Down sets target0. Right6434/Down0 are read from guarded ARM9 source literals in the locally supplied ROM.

The factory stops before creator result. It does not accept `continueNewborn: true`, project a birth, or continue unknown post-creator consumers. Its other-consumer exclusion is a declared condition, not a full-world simulation. Reached clock inputs are explicit, not predicted.

## Legacy compatibility

Existing `dq9-f06-hero-motion-v1` packets and streams containing only Down remain unchanged. Optional `keyboardGates` on their control stream enables the same narrow Down/Right/None path. `heldDirections` alone cannot enable alternative directions. The continuation passes the corresponding validated input for each tick.

The older carried1200 regression uses measured D04 pre/post-HERO trajectory inputs. It remains useful regression evidence, but is not equivalent to the new fresh-origin no-future-pose proof and must not be described as a fully predicted1200 prefix.

## Released speed residue

Ordinary deceleration may produce a signed speed such as−7 for one pass. In the source02032fc4, released movement with nonpositive old speed resets speed to0 and skips translation. The kinematic guard now accepts negative speed only for movementByte0. Negative active or special movement stays unsupported. The change does not bypass orientation, vertical, goal, acceleration or collision guards.

## Validation result

Two local fresh1990-origin routes, straight Down and Down→Right→release→Down, reached scheduler selection2052 with identical native/predicted30 pre-HERO and29 post-HERO XYZ, angle, node and speed records, timer progression and two ordered AT calls. The seed chain was0x16e2ca29→0x9cdec1ae→0xa46fab4f. Both selected node24/table20/species88, timer1019 before creator. The turn/release route included genuine displacement, deceleration to zero and resumed movement.

The initial yaw0 was checked independently. Later yaw0 is comparison-only; invariance remains a condition. Observer-off/on parity passed for both CPU register sets, screen pixels and relevant runtime state at64 checkpoints and full4MiB RAM at5 checkpoints for each of eight profile pairs. Independently booted profiles differed only at enumerated RTC-region bytes; no exact whole-RAM equality is claimed across separate boots.

These are bounded empirical and conditional source-model results, not universal timing, camera, collision, map-transition, party-following or whole-game RNG guarantees.

## Tests and build

`bash scripts/build.sh` builds the WASM through the existing pipeline and runs the portable aggregate, including `test-f06-keyboard.mjs` and `test-f06-origin.mjs`. `node scripts/test-f06-keyboard.mjs /path/to/local-rom.nds` additionally verifies the guarded local-ROM direction binding. No ROM, SAV, native RAM, private trajectory or generated executable is embedded in the source-only patch.
