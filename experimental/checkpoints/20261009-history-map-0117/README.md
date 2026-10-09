# Conditional AT segments across a video map change

The producer binds retained before/after video entry witnesses to an original-ROM ordinary exit and reuses the existing destination NPC interpreter. It reads ROM resources without a fabricated first-spawn runtime, source frame clock, heap pointer, seed, DST or SAV. The old replay path still requires its original runtime/phase inputs.

NPC initialization remains the existing source sequence: controller initialization then ordinary actor initialization, two draws per selected NPC. The shared helper is used by the old replay loop and the new segment reader. Unknown story/network/quest/event values remain unresolved primitive packets. No false or zero values are supplied to make the loader run. The closed destination interpreter scope remains the existing D04 destinations and F06; other destinations/exit shapes remain unknown.

F06 pickup count projection uses each distinct group word as one unknown variable, shared across repeated source records. One uint32 word can enable zero through eight mask bits; runtime slot count is not the ROM point count. Distinct group words are unspecified source inputs, not measured save state. The returned count domain is source-local and may include states forbidden by unknown earlier game history. Complete loop, stable words, successful allocation and valid phase-range conditions remain explicit; failure/other-consumer alternatives remain unknown.

The compiler receives extra disjunctive map-load branches only when source-bound singleton alternatives exist on both sides of the entry. Existing singleton masks, unknown branches and native route rules remain. It never treats the two observed bodies as certified independent births. Input events are hypothesized to straddle the selected loader segment; false detection and other event timing remain possible.

## The +1 contract

The AT engine's edge measures from immediately after the earlier draw to immediately after the later draw. The gap is:

`prefix calls + selected loader calls + suffix calls + later event's own draw`.

That last draw accounts for +1. It is not an inferred loader draw. If no later event exists, no edge is created. Prefix and suffix default to unbounded source consumption; `max:null` remains unresolved. A finite source-local loader domain is not a finite whole-transition gap. Count domains with holes are retained explicitly; the generic min/max edge uses their interval hull and may retain extra possibilities.

## Actual saved 36-frame result

Input raw SHA256 `db68fcdcca5a4bd759c7742f79a41a193fcd3eda3d7ad10af8b9bd0743c50ca4`, original source epoch1/segment0. The retained entry witnesses are frame35/23.450s and frame36/28.517s. Those times do not become source clock/update counts.

Five map alternatives remain. F05/20005→F06/20006 matches the original-ROM ordinary exit. The other four do not satisfy this bounded ordinary edge contract; they are unresolved, not globally rejected. F06 has zero selected NPCs and pickup groups15/16/17, giving a conditional local NPC+pickup draw set0..24. Zero NPC draws does not mean the map transition consumes zero draws.

The saved destination frame36 is pending and has no later source-bound event. The existing compiler accepts 28 original branches and creates zero map-load branches for this input. Current AT remains unknown. `REAL36_NPC_ONLY.json` preserves the earlier NPC-only result; `REAL36_FAILED_PROJECT_SHAPE.json` preserves the initially unadapted project.nfs/nitro interface failure. No video was rendered or replayed during this measurement.

Production integration must keep the new helper's import identity identical between controller and compiler because freshly source-prepared immutable segments are tracked by ownership. The route-resume path does not resubmit original singletons or their map-load pairings; those jobs have their own existing ACK/work records.
