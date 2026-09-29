# Area-dependent encounter selection / static evidence
Program dq9_new2.nds,2026-09-29. Read existing enc_jp.lua before mining. Resolved actual names by address then batch_decompile(FUN_0209b79c,FUN_0209db40,read_data_limit_e9_2). This document is static evidence, not all-map live validation.
## FUN_0209b79c
Input pair points to {rowsPointer,count}. Walk i<count, stride0x10, compare u16 row ID with location code. Read flagsbyte+0x0e, index=(flags>>2)&15. Return0 if index==8, otherwise1<<index. Return0 for no matching row. The Lua loop uses <=count, but ROM pseudocode exits at i>=count; do not carry the Lua off-by-one into production observations.
## FUN_0209db40
At table context, count is u32+0xc0, candidate rows stride0x20. flags=u32(row+4). First match satisfies:
  ((timeArgument==0?1:0)==(flags&7) || (flags&7)==2)
  && (areaMask & ((flags>>13)&255))!=0
Return row pointer or0. Therefore map ID alone is not enough; packed player location selects area mask and time state filters the table rows.
## Existing Lua addresses to observe (not assumed universally validated)
object registry020F33D8; active indexbyte+371c; object pointers+8+4*index. Player packed locationu16+114. Region rows pointer/count registry+468/+46c. Encounter context020FDB08; time argument0210790C. Monster slots112..159; active markeru16object+16a; tableu16+168; monsterIdu16+2; coordinates at+44/+4c/+54.
read_data_limit_e9_2@0200fc38 reads active index and tailcalls its lookup function; its imported name's e9 limit was not independently proven here.
## AT literal
UpdateAT@02003c30 literals read02003c58..63:
90 ee 0e 02 / 6d 4e c6 41 / ff 7f 00 00
AT state address020EEE90, multiplier41c64e6d,increment3039,return(seed>>16)&7fff. Existing rand.js remains authoritative implementation. ATRandInt's raw decompiler output is in02-at-raw.c; its floating-point scaling is not replaced with guessed modulo.
## Next evidence
Snapshot both requested states at a known paused frame; preserve map/area/table/AT/monster list. A saved-state observation is NOT boot-origin lower-bound proof. Do not claim equipment caused an AT difference between states saved at different moments.
