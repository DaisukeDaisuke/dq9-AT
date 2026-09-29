# Field spawn selection: correction and AT obligations
2026-09-29 / dq9_new2.nds. User protocol's ATRandInt LR02075150/020751a0 resolved with get_function_by_address, then batch_decompile(FUN_02075050,FUN_02075168). Static evidence, followed by ROM observer validation.
## Important correction
FUN_0209db40 is used by battle encounter setup, not the field spawn selector. Its sole caller found here is FUN_overlay_d_17__021b7834. On a null match that caller reuses the already-spawned monster's table ID at object+168. Therefore the earlier snapshot's selectedTable:null is a correct result for that helper alone, NOT evidence that field spawning cannot select a table. Historical snapshots remain unchanged; newer observer output separates field candidates and battle lookup.
## FUN_02075050: field table selector
- Get dynamic context; loop FUN_0209dab0(tableContext) rows through FUN_0209daf8.
- flags=u32(row+4), timeMode=flags&7, rowAreaMask=(flags>>13)&255.
- Accept time iff (timeMode!=0 || FUN_020101b8(context)!=0) && (timeMode!=1 || FUN_020101b8(context)==0).
- Record every time-eligible table ID. Record preferred IDs when rowAreaMask==0 (WILDCARD) OR (rowAreaMask & inputAreaMask)!=0.
- If preferred empty, use all time-eligible IDs as fallback. If both empty, return0 without AT.
- Otherwise call ATRandInt(candidateCount), including candidateCount=1, then lookup chosen ID through FUN_0209db0c.
Thus table selection consumes exactly1 AT conditional on a nonempty candidate set. Area-mask0 does not imply no table. The selected ID cannot be invented when multiple candidates remain.
## FUN_02075168: weighted monster selector
count=u16(encounterRow+2). Each item occupies4bytes starting+8. weight=(u16(item)>>12)&7,monsterId=u16(item)&0xfff. Sum weights, call ATRandInt(totalWeight), find first cumulative weight greater than returned integer. Exactly1 AT is consumed in this function. No new encounter weights are mined: production uses existing enc.json intervals.
## User supplied log
Protocol records table count1 at LR02075150 and monster totalWeight16 at LR020751a0, repeating with other UpdateAT calls between. This supports the identified path but does not prove all extra calls or origin-seed continuity.
## Next callers
Both selectors have callers FUN_02074568 and FUN_overlay_d_17__021a2e74. Inspect the relevant spawn/position branches, not unrelated game subsystems.
## Existing trace reuse
LocalAI/scripts/dq9/pickup_spawn_at_probe.js supplies register and little-endian byte-read helpers plus UpdateAT entry02003c30/return02003c54 exec observers. LocalAI/DESMUME_WEB_DEBUGGER_BUGS.md says write triggers may not auto-resume; use entry/return exec hooks. Reuse methodology, NOT pickup consumption counts.
