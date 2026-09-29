# Monster movement contributes AT
2026-09-29. Actual32-update trace:18 calls returned to02079ed8; get_function_by_address resolves FUN_02079d54, then batch_decompile.
## Static behavior
FUN_02079d54 operates on a field monster object and its graphnode(object+0xb8). Looks up current field using getCurrentFieldDataAddr(), field slot by map through FUN_02028420. Graph at field+0x14; node lookup FUN_02027c9c. Node+2 is neighbor count, node+0xc points to neighbor pointers.
Builds eligible unoccupied neighbor list using encounter row's area mask, node area byte, and FUN_02074ee4 occupancy. If candidates exist, consumes direct UpdateAT and chooses by remainder modulo candidate count. Writes next graph index to object+0xb8. This is NOT ATRandInt's floating-point scaling.
Actual trace records18 such AT calls intermixed with7 field-table calls and7 weighted-monster calls. Therefore tracking only new appearances misses ongoing monster-movement randomness. Do not replace this with a fixed spawn cadence or a fixed number of calls per appearance.
## Graph memory layout (live map7402)
getCurrentFieldDataAddr returns020FDAAC. FUN_02028420 scans4 slots,stride0x314,matching mapu16slot+0.
Graph atslot+0x14: countu8+2, nodesPointeru32+4. FUN_02027c9c uses16-byte nodes: byte0 ID,byte1area mask,byte2neighbor count,byte3flags, signedshortXYZ+4/+6/+8,unknownu16+a,pointer+c.
Live26nodes from022f2178, map7402. Positions spanX[-50,50],Z[-98,4],Y1. Every observed area mask0. Graph nodes/edges are enemy navigation and spawn candidates, not proven player collision geometry; do not claim graph edges are guaranteed walkable routes.
## Read-only observation boundary
State and graph snapshots do not establish boot-origin lower bound. Game map entry may consume AT in pots/barrels/bluechests and map-specific logic, as user protocol explicitly notes. These are additional obligations, not permission to add arbitrary estimated consumption.
