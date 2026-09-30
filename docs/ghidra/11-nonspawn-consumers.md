# Non-spawn AT consumers and all-map tracking — C3

User protocol requires continuity through Stornway and other towns, including NPC movement and pots/barrels. Neither spawn-only replay nor an always-zero unknown interval is full reproduction.

## Existing research reused, not re-mined
Read fountain/dq9/README.md and LocalAI/work/dq9-respawn-timer-standalone/analysis/ANALYSIS_LOG.md lines1–84. Prior dq9_new.nds work distinguishes pickup dispatcher0208f320 selector!=8 normal-load0208f514 (zero AT) from selector8 initialization (one AT). Timer words alone do not prove a draw. Existing readonly probes pickup_spawn_at_probe.js and fountain_initial_pop_probe.js hook exact AT callers. These results are prior-ROM research, NOT newly verified dq9_new2 runtime facts. Pots/barrels are not automatically pickup respawn timers.

## Static candidates from dq9_new2 Ghidra this continuation
- 0203cccc: actor initialization contains UpdateAT%200 at an internal timer field.
- 020409bc: movement-controller initialization contains UpdateAT%2000+2000.
- 02041128: movement update gates by global mode, actor flags, descriptor mode and elapsed timer. Modes7/8 call02041444, modes9/10 call02041678. A separate reset draw%2000+2000 occurs only when the relevant actor flag8 is clear.
- 02041444: choose one of eligible bound-direction vectors with UpdateAT%count, then02040eac. Candidate count/geometry need actual inputs.
- 02041678: waypoint reuse can consume0; mode9 can choose a random ordinal, mode10 follows existing order. Decompiled null/list flow is suspicious and must be checked against instructions before exact implementation.
- 02092f34: inclusive random range helper. Equal endpoints consume0, unequal endpoints consume1.
- 02090f2c: recursive partition/random split-order routine. Role not yet established; not labeled a pot/NPC path merely because it draws.
- 020798b4 and02079d54 concern actor/monster movement, with conditional flag/mode/neighbor behavior; do not count every entity once per frame.

These are candidates identified from code, not confirmed NPC identities or proven per-map draw counts. Exact branch and preceding writer must be observed before attributing a discrepancy.

## Direct UpdateAT caller inventory
Ghidra returned46 direct callers, including ATRandInt; non-direct integer wrappers add callers beyond this list:
0201e7e0,0201e85c,0202dc14,02031e64,02031ea8,02031efc,0203cccc,020409bc,02041128,02041444,02041678,0204874c,020572d4,02059d30,02059eb4,0205a0b8,02074568,020798b4,02079d54,02090f2c,02092f34,0209d1c0,020a5bfc,020a5df0,020a63b0,020a64d0,020a682c,020a78c0,020a7a5c,020a7c20,020b0600,020dfa68,overlay00__02176fac,overlay03__021708b4,overlay03__02170ba0,overlay04__021582bc,overlay04__0215c964,overlay04__0216f43c,overlay09__0218b850,overlay17__0218c2a8,overlay23__021db984,overlay23__021f54ac,overlay31__022452fc,dispatchItemPickupTimerInitialization0208f320,materializeItemPickupChain0208fa7c,updateItemPickupRespawnTimers0208f588.

## Runtime representation now implemented
ATSession keeps the known-seed chain and proven lower bound through map changes. Map entry records unresolved map-load/NPC-init/container/pickup consumers explicitly. Current position is an interval from max(proven lower bound, conditional lower bound) with an open upper end, distinct from the previous weighted-draw positions. Additional unresolved consumer intervals are serialized and replayed without adding guessed minimum calls. This retains sound uncertainty; it does not claim exact town simulation or a finite search horizon when evidence is missing.

## Next actual observation
Restarted the supplied erahulita.dst and read map bytes35,78 => map20003. Armed a64-call all-consumer trace with startSeed299291569, independent of the shrine-state trace. No continuity across loaded states is claimed.
