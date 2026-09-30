# Field graph loader and script dispatch (2026-09-30)

Final actual-ROM result:151/151 graphs,3934nodes,6044edges,zero errors. Two members D03P05/F55P00 are uncompressed streams with16commands; leading0x10 is ambiguous with LZ10. The production loader first validates the existing typed-call stream and only on failure attempts LZ10. See actual-field-mining.json and ISSUES_20260930.md for the correction. All raw glyph/model/texture assets remain outside persisted graph metadata.

Program dq9_new2.nds, currently displayed as `dq9_new - コピー.nds` by Ghidra. Source addresses were checked by direct decompilation / dispatch memory / instruction listing. Initial stale-looking batch output for 02027a80 was discarded because it contradicted disassembly. The parser is NOT a guessed packed-u16 format.

`overlay_d_17::021b507c` obtains a member of a NARC archive with 0207663c (substring file-name selection), initializes field+0x14 and calls 02027970(graph,allocator,member,size), then 02027a80. 020278b4 uses the existing generic typed call-stream interpreter; dispatch table at 020ef5e8.

|Opcode|Handler|Effect|
|---|---|---|
|100|02027550|Append node: arg0 u8 ID, arg1 u8 areaMask, arg2..4 floats converted `signed16(trunc(f32(v*4096)) >> 12)`. flags initialized 0 by 02027600.|
|101|0202761c|Append edge by node IDs, skip equal IDs/missing endpoints.|
|102|020276b0|Append a chain through provided node IDs; missing nodes do not replace previous valid node.|
|103|02027758|Append chain over inclusive ID range.|
|104|020277fc|Allocate nodes; capacity stored as byte (02027f68).|
|105|02027820|No-op, return1.|
|106|02027828|Allocate edges; capacity stored as byte (02027fc0).|
|107|0202784c|No-op, return1.|
|108|02027854|Allocate pair list at graph+0x28; count+0x25, capacity+0x24.|
|109|02027878|Append two u16 values to pair list. Interpretation not assumed.|

02027988 sets graph+0x20 iff every recorded u16 pair has equal endpoints. 02027a80 constructs per-node adjacency by traversing edges in ORIGINAL append order, compares endpoint IDs, and sets graph+0x1c. Do not sort/deduplicate edges or reinterpret node IDs as array indices; F03 ID order is visibly non-sequential.

Node ABI: 16 bytes: id+0, areaMask+1, neighborCount+2, flags+3, signed16 XYZ+4/+6/+8, neighbors pointer+0xc. Raw unknown word+0xa is not copied by 020279dc. Graph nodes and edges counts are bytes.

The actual archives inspected so far are NARC with LZ10-compressed script members. Reuse BattleArrow/narc.js, NitroFS Compression, and existing call-stream.mjs. No new archive/decompression/parser implementation is needed.

Actual F03 observation is saved as docs/observations/map20003-field-graph.json: 47 nodes, IDs distinct from indices, area masks1/2. The user describes three encounter areas in the named region; the current northern loaded graph is not proof that other areas are absent. Paused map20003 encounter rows: table4 flags14690368; table6 flags14690377; table7 flags10504266. Field time2 selects table4 for mask1 and table7 for mask2; this must remain different from battle lookup and from player-position-only selection.
