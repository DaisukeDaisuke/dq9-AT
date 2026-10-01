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

## Reached shrine map transitions

The same replay now accepts a bounded trajectory-v3 suffix for the ordinary7402→7401→7400 path. It uses the existing ROM, runtime, trajectory and seed controls. The initial106 controlled world phases derive one monster and119 calls; the two reached destination loaders add0 and2 calls. One carried candidate therefore reaches121 calls since the supplied950 state. This is conditional replay, not current-video seed identification or a universal map-transition fee.

The suffix records six reached phases per edge: exit request, field cleanup, manager map change, destination placement, pool initialization and destination load. Source frames label those measured phases; elapsed frames never generate an assumed draw count. The request carries measured effective hero XYZ. Destination XYZ comes from the ROM exit record. Successful pool allocation is explicitly bound to the same known contiguous initial12-object pool; arbitrary pointer changes and aliases suspend. The runtime declares the ordinary single-party branch, stable story/quest/flag conditions, completed loads, successful NPC allocations, no additional field species and no intervening external AT or seed setter.

D04M01 has no accepted NPC descriptors and no treasure member under this context. D04 has one kind1 descriptor, whose controller and actor-phase initializers each draw once. The descriptor membership comes from the ROM placement/NPC resources and the declared primitive conditions. Constructor outputs and later native seeds are not trajectory inputs.

Field cleanup closes the old registered actor generation and clears field timer/resources while retaining the global seed and serial counter. The destination pool is reset and registered with only its proved free/inactive fields; residual bytes such as e0 remain unknown. The destination loader's own RNG calls are carried from the earlier world result.

The view changes the ROM background per map. It does not reinterpret old coordinates under the new map ID. A pending transition shows current coordinates as unknown; the ROM entry point is separately marked as a requested placement, with settled height unresolved. The replay stops after the second destination loader because later NPC/world updates are outside this slice.

Tests cover missing conditions, malformed/reordered phases, invalid allocation bindings, failure after cleanup, and failure after the first constructor draw. An unresolved phase retains its known consumed seed prefix and cannot revive the old actor pool. Private paired observer-on/off evidence covers the unchanged save route; raw ROM, save, RAM, screenshots and controlled runtime/trajectory packets are not bundled with this source release.


## Optional third exit and source-derived pickup initialization

The same trajectory-v3 format can include a third six-phase edge from 7400 to
20006 (F06). Its final phase is `pickup-materialization`, rather than
`destination-load`. The first twelve phases keep their existing behavior.
There is no assumed frame delay, map cost, or seed reset.

The optional transition context adds `pickup.stateWords`, keyed by the group
IDs selected from the local ROM, and `pickup.phaseRange` with `lower` and
`upper`. These are origin-state primitives. The extra conditions
`stablePickupWords`, `pickupDescriptorBound`, and `successfulPickupAllocations`
must be explicitly established. The original ordinary-party, resource-load,
no-external-AT and no-seed-setter conditions still apply. The reached final
phase specifically establishes arrival at the materializer's record loop.
Neither a later seed nor an observed draw count is accepted in the trajectory.

The local ROM supplies the third exit, F06 pickup records and their source
order. F06 has no treasure member. The shared F scenario's complete placement
stream contains no possible placement for map 20006; conditions on other maps
cannot add an F06 actor. This is a narrow negative membership proof, not an
implementation of arbitrary quest or event-flag expressions.

The pickup materializer skips inactive records, derives each active record's
slot count and enabled bitmap from its state word, and draws once per enabled
slot after successful allocation. A failed allocation returns before that
slot's draw. Unknown state preserves only the already consumed prefix. The
existing AT WASM and exclusive-upper-bound pickup phase function are reused.
The original phase words and live resource binding remain distinct from a
source-derived call count.

The retained controlled extension reaches 124 phases and 132 conditional AT
calls, with one carried initial candidate. The last eleven draws come from
three ROM records and their enabled slots; eleven is a measured regression
result, not a hardcoded transition rule. Different input state words or
allocation outcomes can change this count.

F06 loads new field templates before this endpoint. Their dynamic bindings,
field timer, actor state and terrain are not reconstructed by this slice.
The replay explicitly marks destination field flags, active state, resources,
tables and timer unknown and stops after pickup initialization. The view keeps
current coordinates unknown, and labels the ROM destination only as requested
placement. It does not claim a settled position or a usable destination-world
simulator. This change does not implement later pickup updates, pot/barrel
loot, or video-based AT identification.

Portable tests include source-row validation, sparse masks, the group-98
forced-eight rule, missing and failed allocations, prefix preservation after a
phase-write failure, and unknown destination state. Native RAM, source inputs,
ROM-derived record tables, saves and screenshots remain private.

## First F06 timer interval and recurring pickup updates

Optional trajectory schema `dq9-pre-spawn-trajectory-v4` keeps the same v3
world steps and reached transition phases, and adds `destinationContinuation`.
The same runtime-v2 packet adds a matching `destinationContinuation` object.
The existing inputs, seed controls and continuation checkbox are reused.

The additional initial runtime consists of `initialSourceFrame`, pickup updater
`cursor`, float32 `accumulatorBits`, and all 100 `groupWords` keyed 0..99. These
are original-state inputs, not a later cursor or accumulator snapshot. Conditions
must explicitly assert ordinary offline updates, no other pickup-word writers,
no preceding motion writes that affect AT inputs, successful ordinary F06 loader
completion, no other destination AT, complete ordered updater and destination
tick streams, and no other destination field or natural-pool writes. Exact condition keys are
validated by `prepareF06Continuation`.

The trajectory supplies `pickupUpdates`, each with reached `sourceFrame` and
`scaledDelta` 0..50, and `schedulerTicks`, each with reached `sourceFrame` and
unscaled scheduler `delta` 0..50. They are distinct clocks. The packet contains no
future seed, expected timer, cursor output, actor state, or hero pose. Clock and
callback production remain explicit inputs; the model does not infer them from
frame gaps. Updater events end strictly before the final supplied scheduler
phase, and cannot share the materialization frame because that ordering would
be ambiguous in this bounded packet.

The recurring updater follows `0x0208f588`: float32 delta/1000 accumulation,
60-second gate/reset, cursor-selected group, enabled-bit population and positive
countdown behavior. Groups 98 and 99 decrement even when their enabled count
matches capacity. Unknown group/type conditions and any zero-countdown refill
branch suspend before a possible AT draw. The preceding pickup motion is not
projected by this component. Its writes must remain disjoint from these inputs.

The updater is independently projected over the declared ordered stream and
must prove zero AT before it can compose with the existing replay. Its writes
are disjoint from the existing actor/spawn state; no random state is reordered.
The three source-selected F06 materialization words must equal their carried
values before that load. A mismatch is rejected, rather than silently replacing
an initial word with a future observation. This conservative contract does not
implement general pickup regeneration.

Successful graph load derives `field.active=1`; field-loader completion derives
flag 8, and the fresh-field reset derives timer 0. F06 is outside the story-gated
map range 400..409. The existing `FieldScheduler` then advances the explicit
unscaled deltas. Before timer 1000 it needs neither a hero pose nor terrain or
model allocations. Once due, the known reset pool can supply a free slot, but
missing current hero XYZ, heading and node stop before geometry and any table
selection. The final partial scheduler's updated timer is retained exactly once.
The destination field's resources/tables and current coordinates remain unknown;
`destinationWorld.resolved` stays false.

The retained original 950 route projects 665 recurring updater calls before the
stop: one scan of groups 0..99, 36 countdown changes and zero AT. All first 124
replay events remain unchanged. Twenty-nine complete F06 timer-gated calls end
at timer 986; the thirtieth reaches 1019 and stops before geometry. The displayed
result is 154 phases, 132 conditional calls and prefix seed 0x16e2ca29, not the
native seed after that unfinished invocation. Later native comparison calls
at table selection and weighted selection are deliberately excluded, along
with the subsequent 666th updater invocation. No later hero/actor state or
settled position is imported.

Portable checks: `test-pickup-updater.mjs` and `test-f06-continuation.mjs`.
The latter optionally accepts a local ROM, runtime-v2 packet and trajectory-v4
packet. Native captures and private fixtures are not public assets.
