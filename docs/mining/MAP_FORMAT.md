# Map mining format notes
2026-09-29 / Japanese ROM YDQJ / source paths and function anchors retained below.
## Reused metadata vs newly decoded structure
Map names: existing map-id-names.csv, 510 entries (not regenerated). Encounter selection tables: existing enc.json (not regenerated). Map structure: data/map/maplist9.bin, 1010 opcode0x67 records decoded with the existing LocalAI/work/dq9-pickup-static-loader/probe-maplist.mjs parser. Do NOT interpret secondaryId as encounter area; raw typed arguments and call offsets are retained.
Same visible name is not a unique map key: 7401/0x1CE9 and 7402/0x1CEA both name ふういんのほこら１Ｆ; respective field codes D04M01/D04M02. Keep both.
## Archives
- data/pack_lv5/minimap.gp2: 283 .bmmp descriptors, 268 .obg images plus auxiliary assets.
- data/pack_lv5/minimapt.gp2: 150 .pac special map packages. Do not silently omit them or claim a procedurally assembled dungeon floor is a static OBG map.
The existing GP2 parser performs decompression and member lookup. No new GP2 decoder was invented.
## OBG image format
Static anchor FUN_0203b594. Actual ROM: all 268 files have depth=0 and exact expected byte length; no tile index exceeds the declared count.
|offset|field|
|---|---|
|0|u8 width in 8-pixel tiles|
|1|u8 height in 8-pixel tiles|
|2|u8 depth:0=4bpp,1=8bpp|
|3|uninterpreted byte|
|4|u32 LE unique tile count|
|8|BGR555 palette:32 bytes for 4bpp,512 for 8bpp|
|after palette|8x8 tile data:32 or64 bytes per tile|
|after tiles|row-major u16 LE tilemap, widthTiles*heightTiles entries|
Tilemap entry: bits0..9 tile index,bit10 flipX,bit11 flipY. Palette zero can be transparent. OBG owns one palette; upper bank bits concern VRAM relocation, not multiple palettes embedded in OBG.
FUN_0203b3d4 copies row-major source tilemap into hardware BG block order; do not apply BG swizzle to the OBG source itself.
## BMMP call stream and opcode ABI
Reused typed call parser: u32 instructionCount@0, stringPoolOffset@4, poolSize@8, instructions@16. Header u16 opcode/u8 argumentCount, packed2bit types, alignedu32 args. Type0 pool-relative SJIS string,type1 signedinteger,type2 float32.
Handler table020ef3f4, names resolved before batch_decompile:
|opcode|handler|meaning relevant to mining|
|---|---|---|
|64|FUN_0201f258|origin tile X/Y|
|65|FUN_0201f28c -> FUN_02027030|allocate layer capacity; not image dimensions|
|66|FUN_0201f2b4 -> FUN_02027060|layer ID/string image base name|
|67|FUN_0201f30c -> FUN_02027150|allocate placement capacity|
|68|FUN_0201f334 -> FUN_0202717c|placement ID,layer ID,tile X,tile Y|
|69|FUN_0201f38c|world-to-map scale (float converted to fixed point)|
|6a|FUN_0201f3c0|background base name|
|6b|FUN_0201f3ec|map-ID group|
|6c|FUN_0201f4b4|coordinate pair plus map-ID group|
|6d|FUN_0201f5d0|integer flag; not given invented semantics|
|6e|FUN_0201f5f0|misc typed call retained raw|
|6f|FUN_0201f620|misc typed call retained raw|
|70|FUN_0201f65c|paired map ID/resource names|
Hex opcodes above. Unknown or unused calls remain present in exported metadata.
## Placement units and image preview boundary
FUN_02023eec calls FUN_0203b710 with (originTileX+placementX-scrollTileX)+0x20 and (originTileY+placementY-scrollTileY)+0x10. Therefore placement values are tiles, not pixels. Web compositor uses *8, returns crop origin separately.
The preview is the map artwork composite, not a fake live DS screenshot. UI frame/background layer, moving camera, hero marker, NPC/exit overlays, exploration fog and special generated floor topology are not claimed reproduced. This phase supplies imagery and coordinates for later position recognition.
## Exact sample metadata
D04M0101.obg=64x64,64tiles,2216bytes; D04M0201.obg=224x256,739tiles,25480bytes. D04M01.bmmp origin[-4,-4],scale4,layer0 D04M0101,placement[0,0,0,0],map binding7401.
## Proof levels
Archive/member counts and header consistency are real-ROM mining observations. Handler semantics are Ghidra static evidence. Area selection and live screen-coordinate alignment require additional harness observations; map->encounter is not hardcoded.
