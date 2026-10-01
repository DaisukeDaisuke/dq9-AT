# Conditional browser spawn and movement replay

The existing monster explorer now composes ROM graph/table/terrain data with an
explicit initial runtime, phase-specific hero trajectory and supplied seed.
The default mode stops at the first creator call. The continuation option
carries every actor it creates through supported body/lifetime/walking phases.
It does not import later actors or reset the seed from observations.

Load a Japanese revision0 NDS and the two local JSON files, enter the seed at
the start of those inputs, declare the conditions and initialize. Advance one,
ten, or run until the input ends or an unsupported branch stops. The map draws
only modeled actors, with slot/species labels and paths. The older manual
1actor experiment is labeled separately. Files stay in the browser.

## Supported context

This slice is map7402 with a known registered unused12-object natural pool and
one possible party member. Null registry pointers are not allocatable objects.
The initial48-slot registry contains no pre-existing active natural actor and
no duplicate non-null object pointers. Other party slots are explicitly absent.
Story/activity, stable runtime and no external AT consumers are declared
conditions, not conclusions from visibility.

The nearby-actor member cap is computed from modeled active XYZ in the native
asymmetric box. Each derived birth updates the pool, serial and field counters.
Within a logical phase, all actors run in native slot order through body and
lifetime; the separate walking traversal follows. Unresolved branches and the
first lifetime reset stop the current projection. Later map transitions,
alert/chase/collision branches and global-world completeness remain separate.

## Local inputs

Runtime v1 has schema `dq9-first-spawn-runtime-v1` and keys `mapId`, `fieldIndex`,
`initialTimer`, `selectedHeroSlot`, `conditions`, `parties`, `runtimeNodeFlags`
and `creatorContext`. The creator primitives cover four fields, model/AI/template
resources, serial state,48-slot inventory, protected ranges and terrain object
bindings. No graph or decoded terrain bytes are imported: the loaded ROM owns
those resources. Runtime JSON is limited to8MiB.

The selected field's `tables` can be omitted. ROM encfld supplies the table
IDs, flags and packed species/weights; native0209d7e8 shifts integer scale1
left12, giving4096 for all four supported7402 items. Native0209dbbc appends
those halfword pairs. The field container offset is+0x5c. All four items match
the retained native preinput. Other scale conversions remain unsupported, and
conflicting legacy table inputs are rejected. Old encounter labels are unused.

The ordinary loaded field's model and AI values are now mined from the ROM too.
`encmons.bin` supplies the unconditioned selected-map species list;
`mons_data2.nat` supplies signed model dimensions; `fld_mons_data.bin` supplies
AI bytes/flags. The model list is sorted/deduplicated and the AI list is prepended
in source order. Speed mode zero clears the low route-mode bits, as in0206fe98.
The complete retained7402 preinput agrees for all four species.

`resources.models.entries` may be omitted. Its nonzero `basePointer`, native
`declaredCount` and field-bound `containerPointer` remain required. Each
`resources.ai.records` entry can contain just its `pointer` and `next`; the known
`head` and container pointer remain required. The complete linked list must have
the ROM-derived length and terminate without cycles. Supplied legacy numeric
values must agree with the ROM. Missing allocation counts, pointers, incomplete
links, story-conditioned/ambiguous map lists or absent descriptors suspend.
This binds the existing ordinary, stable resource-loading hypothesis; it does
not prove that an arbitrary runtime allocation has loaded successfully. Templates,
material/component bindings, pool/serial state and dynamic terrain remain explicit.
An explicitly null model allocation or empty AI head stays absent and reaches the
existing native creator-failure path; it is never populated from ROM as success.

The reduced file removes the four imported model entries and all four static AI
records' numeric values. Replaying it produces exactly the same429 event records
and three actor outputs as the previous full packet:343 calls, seed560534860.


Trajectory v1 has schema `dq9-pre-spawn-trajectory-v1`, phase
`pre-spawn-effective`, `mapId` and1..2000 dense ordered steps. Each step contains
`index`, optional `sourceFrame` (null or unsigned integer), scheduler `delta`
0..50, `timeValue`, and `hero` with native signed32 `xyz`, signed16 actual
`angle`, current `nodeIndex` and explicit `graphEnabled:true`.

For continuation, the same files use v2 schemas. Runtime
`dq9-first-spawn-runtime-v2` adds `continuation` with phaseOrder
`spawn-hero-body-lifetime-walking`, `environmentStable:true`, and the existing
guarded walking environment: controller/hero flags, map, anchors, script and
call parameters. Its terrain is the same ROM-bound creator terrain.
Trajectory `dq9-pre-spawn-trajectory-v2` uses phase
`pre-spawn-and-post-hero-effective`; each step additionally supplies `postHero`
with the same pose fields and `actorClock` with `phase` and `scaledDelta`0..50.

Pre-spawn and post-hero are separate inputs. Neither a prior rendered marker
nor a pre-spawn pose is silently used as post-hero. XYZ remains the sole native
coordinate source; chunk/local values can be derived losslessly. Camera L/R,
diagonal/touch motion, facing and held keys are not inferred from screen motion.
`sourceFrame` is provenance only; frame gaps do not imply AT calls. Trajectory
JSON is limited to1MiB.

## Seed, state and incomplete phases

The initial seed/timer are carried. Geometry and creator refinements rerun the
original scheduler invocation, preventing duplicate time or draws. Every actor
starts from creator output, reset constants and its initial pool object's known
byte-sized e0. Component-family support is bound to that creation's validated
structure. No animation-class pointer or future state is supplied as truth.

A known draw before an unresolved boundary remains in the displayed prefix.
It does not turn an incomplete phase into a completed native frame or current
video state. Each actor retains its last completed phase. Cancellation retains
completed work; ROM/import/seed/scope changes invalidate it, and stale async
work cannot restore it. Initial seed means the start of the supplied experiment,
not necessarily the game's initial boot state.

## Retained comparisons

The first-birth mode still reaches90 steps/63 calls, species83/slot112/serial1,
seed4044910212 and timer0. Continued execution derives births at90/279/370:
species83/31/83, slots112/113/114, serials1/2/3. The429 complete controller
inputs through native return1812 give343 calls, seed560534860, field timer1947
and actor timers3036/3960/957.

All429 native timer/seed/call triples agree.551 actor and551 walking projections
agree with the earlier source compositor.179 native XZ snapshots agree. A
separate65-snapshot check covers all three slots against adjacent completed
predicted boundaries; it retains per-actor phase uncertainty and timer
differences. These snapshots are not exact body-return PC measurements.
The separate newborn leaf regression has417 PC comparisons,155 labeled
snapshot comparisons and12 e0 comparisons. Historical expectations were already
known; these are reproducibility checks, not blind real-video identification.

The next recorded post-hero event is native completed-frame1813 within rendered
capture boundary1814, with no controller return in that packet. That partial
interval is not advanced. No ROM, save, runtime packet, trajectory, native
expectation or raw capture is bundled publicly.

Portable checks run from scripts/build.sh. Optional retained local inputs:

```
node scripts/test-first-spawn.mjs ROM.nds runtime.json trajectory.json
node scripts/test-multi-actor-replay.mjs ROM.nds runtime-v2.json trajectory-v2.json
node scripts/replay-first-spawn.mjs ROM.nds runtime-v2.json trajectory-v2.json 2663044269 --newborn
```

A separate synthetic held-pose extension checks that actor113's route-choice
AT draw reaches actor114. It is not native/video continuation evidence.

The map+trajectory+seed goal still needs source-backed initialization for the
remaining runtime facts. Pool/serial state, active object bindings/transforms,
phase clocks and consumer reachability are dynamic. Model/AI/template resource
content may be mined from ROM, but its loader/selection mapping is not closed
by this change. Unknown values are not replaced with success or zero draws.
