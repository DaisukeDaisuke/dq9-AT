# Field AT control flow — direct Ghidra + actual 128-update trace

2026-09-30, Ghidra dq9_new2.nds (display alias dq9_new - コピー.nds). Evidence: direct decompile of 02074568, 02075050, 02079d54; actual metaru_nasi.dst exec trace in docs/observations/metaru-nasi-at128.json. No frame schedule or boot lower bound is inferred from a paused-state trace.

## 02074568 spawn attempt
Field timer advances using 0201006c. Processing requires active field and timer>999 and a free group slot. Up to four distinct eligible party members are considered, based on nearby monster count, not uniform random choice. Anchor-node neighbors are screened for occupancy. Preferred spawn direction maximizes positive fixed-point dot product; only the no-positive-score fallback draws UpdateAT%count. Candidate position can be interpolated; reproducing this requires fixed-point geometry, collision and current orientation, not a straight line on the enemy graph.

After candidate-position checks, table selection 02075050 consumes ATRandInt even when the delay gate is not yet satisfied. Delay threshold is `(7 - ((row.flags >> 21) & 15))*1000`. The four-attempt loop can return early when no party member is eligible; do not simplify this into unconditional weighted selection after four iterations. Weighted selection 02075168 and creation 021a2bb8 are separate, later events. A creation-function entry is not proof of successful visible creation.

## 02079d54 monster movement
With missing graph/current node/no neighbors, no AT draw. Before object+0x17d bit0x40 is armed, the function returns the current node without drawing; occupancy determines flag updates. Once armed, traverse adjacency in stored order. A neighbor is area-eligible only when neighbor.areaMask==0 or it overlaps the monster's table area mask. **A table area mask of zero does not allow every nonzero neighbor mask.** Occupied candidates are excluded. Only a nonempty candidate list causes one direct UpdateAT draw and `random % count`; this is not ATRandInt's scaled mapping. Unknown occupancy must remain unresolved, not false.

## 02075050 table selection
Time mode0 is eligible iff timeValue!=0; mode1 iff timeValue==0; other modes always. Among time-eligible rows, area mask0 is common and otherwise overlap is required. If no preferred rows exist, fallback to all time-eligible rows. A one-entry candidate list still consumes one ATRandInt draw. No time-eligible rows means no draw.

## Fresh trace
128 actual updates from metaru_nasi.dst, initial observed seed2484401184, no applied input. 81 completed ATRandInt returns, 9 creation-function entries, 71 table-selection entries and 10 weighted-selection entries. The last weighted entry has not consumed its draw when the128 limit pauses. Before first creation at#90, #28..#89 are62 completed table-selection draws; #90 is weighted draw. Therefore the first61 table selections have no intervening weighted selection or creation entry. This observation does NOT independently prove the exact reason for each failed attempt; inspect timer/writer data before assigning delay causality.

The first creation's requested monsterId3 is followed by83,83,83,108,83,108,108,108. All use existing table30. New field_at.c exposes only proven leaf filtering and modulo decisions. field-at.mjs carries explicit unresolved states and conditional two-draw tail forecasts, not a fabricated full field simulator.
