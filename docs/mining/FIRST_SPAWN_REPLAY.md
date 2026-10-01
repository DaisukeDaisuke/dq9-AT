# Conditional first natural spawn replay

The existing `monster-explorer.html` has a second, explicit local experiment.
It composes the guarded preferred-node, geometry, scheduler and creator models
and ends at the first creator call. It does not simulate the later monster,
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
rejection. Successful creation also stops; its later actor updates are absent.
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
