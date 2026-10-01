# Conditional first natural spawn replay

The existing `monster-explorer.html` has a second, explicit local experiment.
It composes the guarded preferred-node, geometry, scheduler and creator models
and normally ends at the first creator call. An explicit option chains its
derived newborn through supported idle and movement states. It does not simulate all AI,
the hero's controls, hidden actors, map transitions or the whole world.

Load your Japanese revision-0 ROM, a runtime JSON, and a trajectory JSON. Enter
the seed at the **start of those inputs**, confirm the conditions, initialize,
then advance one/ten stages or run until the first creation/unknown boundary.
The displayed hero path comes from the supplied trajectory; the birth comes
from model output. No recorded future actor or seed is accepted as a step.

## Input phase and limits

This first slice supports map7402, one selected eligible hero, the other three
party registry pointers absent, and twelve registered inactive free natural
objects. A null registry pointer is not an allocatable pool object.
The runtime packet explicitly declares activity/story gates, sole eligible
member/no next member, stable context and no additional AT consumers.
Those conditions are not inferred from pixels or the loaded map.

The runtime schema is `dq9-first-spawn-runtime-v1`. Its keys are `schema`,
`mapId`, `fieldIndex`, `initialTimer`, `selectedHeroSlot`, `conditions`,
`parties`, `runtimeNodeFlags` and `creatorContext`. The creator context is the
existing `projectMonsterCreation` primitive contract: four fields, resources,
model/AI/template descriptions, serial state,48-slot inventory, protected
memory ranges and terrain object bindings. It contains no graph or decoded
terrain bytes; both are obtained from the supplied ROM. Runtime conditions
and binding declarations remain caller hypotheses. The maximum JSON file is8MiB.

The selected field's `tables` can now be omitted. They are mined from the ROM:
for the supported7402 resource, opcode103 integer scale1 is shifted left12 by
native0209d7e8, producing4096. All four measured native preinput items match.
Other scale conversions remain unsupported. Legacy table inputs are checked
if supplied; conflicting values cannot override ROM.

The trajectory schema is `dq9-pre-spawn-trajectory-v1` with `phase` equal to
`pre-spawn-effective`, `mapId` and1..2000 dense ordered `steps`:

```json
{"schema":"dq9-pre-spawn-trajectory-v1","phase":"pre-spawn-effective","mapId":7402,"steps":[{"index":0,"sourceFrame":null,"delta":33,"timeValue":0,"hero":{"xyz":[0,0,0],"angle":0,"nodeIndex":0,"graphEnabled":true}}]}
```

XYZ is signed20.12 native fixed point; actual angle is signed16. Delta is an
explicit native scheduler clock input0..50. `sourceFrame` is optional provenance,
not an AT-call count or an automatic video→phase association. The maximum file
is1MiB. No D-pad, facing or height is reconstructed from a marker.

## State and unknowns

The initial seed and timer are carried. Fallback-node, geometry and creator
refinements rerun the **original** invocation, so neither time nor AT is counted
twice. ROM opcode103 supplies numerical species/weights; legacy encounter names
are not used. Unsupported conditional groups/traps remain unresolved.

At an unknown boundary the display contains only the computed prefix, including
draws already required before that boundary. It is not a completed native
invocation or the current video's state. A derived creator return0 stops as a
rejection. Successful creation stops unless newborn continuation is selected.
Cancellation retains the last computed stage. New ROM/import/seed invalidates
the prior experiment; pending file reads and old async runs cannot restore it.

The eventual map+trajectory+seed experience still needs a source-backed runtime
initializer for pool/resource/serial/object state, member/story/activity/clock
conditions and other consumers. Input-phase and hidden-state uncertainty cannot
be replaced with default success, zero calls or synthetic actors.

## Verification

Portable checks: `node scripts/test-first-spawn.mjs` and
`node scripts/test-first-spawn-page.mjs`. Optional local-input regression:

```
node scripts/test-first-spawn.mjs ROM.nds runtime.json trajectory.json
node scripts/replay-first-spawn.mjs ROM.nds runtime.json trajectory.json 2663044269
```

No ROM, runtime packet, trajectory or native output is bundled. The retained
controlled SAV comparison reaches the first creator at step90/sourceFrame1133:
63 calls, species83, slot112, serial1, seed4044910212, timer0. All90 native
timer/seed/call-count triples agree. BirthXYZ[-53169,-3356,-2253] agrees with the
previous source compositor; that fixture does not provide an independent exact
creator-return XYZ capture. The historical expected result was already known,
so this is a reproducibility check, not a blind prediction or real-video AT
identification.

## Optional derived newborn continuation

The same two JSON inputs can include phase/environment data; there is no added
import. Select the continuation checkbox explicitly.
Runtime schema `dq9-first-spawn-runtime-v2` adds `continuation` with
`phaseOrder:"spawn-hero-body-lifetime-walking"`, `environmentStable:true` and
`environment`: the existing guarded walkingPass controller, hero flags,
anchors, script and map context. Terrain remains the ROM-bound creator terrain.
The complete natural registry must contain no other active actor or duplicate
non-null object pointers.

Trajectory schema `dq9-pre-spawn-trajectory-v2` uses phase
`pre-spawn-and-post-hero-effective`. Each stage adds `postHero` with the same
XYZ/actual-angle/node/graphEnabled fields as `hero`, plus `actorClock` containing
`phase` and `scaledDelta`. These are separate explicit inputs. The replay never
substitutes pre-spawn or rendered-marker coordinates for the post-hero pose.
Native signed32 XYZ remains the sole coordinate source; chunk/local components
can be derived losslessly. Camera rotation, diagonal/touch movement and held
keys are not inferred from those coordinates.

The actor starts from creator output, source reset constants, and the initial
pool object's known byte-sized e0. Body, lifetime and walking results are then
carried. Walking derives the normal exclusion for every collected triangle;
unknown horizontal response suspends. No observed future actor, animation
class pointer or seed is injected. A second creation, reset, unknown input or
a second creation ends this single-generation slice. Unsupported alert/collision
branches remain stopped.

The retained controlled case reaches120 scheduler stages,31 newborn updates,
first state1 at return1194, field timer990 and total63 calls. All120 native
scheduler timer/seed/call triples match;31 actor projections match the accepted
source compositor. The separate exact newborn leaf regression still passes417
PC comparisons,155 labeled snapshot comparisons and12 e0 comparisons.
The first31 body updates remain stationary. Continuing the same actor reaches
state2 at pass242 and36 movement updates before pass279 tries the second
creation. The last complete actor position at pass278 is[-67164,-3356,-739].
All278 complete native timer/seed/call triples agree.179 native XZ snapshots
agree, including26 moving snapshots at frames1440–1490; these are not exact
body-PC captures. Pass279 retains only its3-draw scheduler prefix: total224,
seed303624909, pre-creator timer6237. Native subsequently resets the timer to0,
which this stopped replay does not apply. No second actor is invented.
Later navigation, alert/chase, additional actors, map transitions and real-video
current-state identification remain unresolved.

Portable checks: `node scripts/test-monster-newborn.mjs` and
`node scripts/test-newborn-replay.mjs`. Optional retained local inputs:

```
node scripts/test-newborn-replay.mjs ROM.nds runtime-v2.json trajectory-v2.json
node scripts/replay-first-spawn.mjs ROM.nds runtime-v2.json trajectory-v2.json 2663044269 --newborn
```
