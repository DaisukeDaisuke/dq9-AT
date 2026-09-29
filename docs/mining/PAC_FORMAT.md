# minimapt PAC upper-screen assets
2026-09-29 / dq9_new2.nds Japanese YDQJ. Actual production WASM run: all150 packages decoded successfully; result docs/observations/actual-map-wasm.json.
## Container
Source data/pack_lv5/minimapt.gp2, extracted with existing GP2 parser. PAC is not NARC. Each member has an80-byte record header. Read filename until NUL within64bytes; bytes after terminator are producer residue and must not enter names or parsing decisions.
|relative offset|field|
|---|---|
|0..63|ASCII member filename, NUL-terminated|
|64|u32LE payload offset relative to this record (observed80)|
|68|u32LE payload size|
|72|u32LE record span including header/padding; next record=current+span|
|76|unknown/residual producer value; ignored|
Zero-filled80-byte final record ends the package. Member order varies: do not assume palette first.
Example mapt_001.pac: BNCL record0/PALT payload80,size524,span608; BNSC record608/SCRN payload688,size1552,span1632; BNCG record2240/CHAR payload2320,size24592,span24672; final sentinel26912..26991.
## Image members
PALT: magic@0,palette byte lengthu32@8,BGR555 palette@12.
SCRN: magic@0,widthTilesu16@4,heightTilesu16@6,tilemap byte lengthu32@12,tilemapu16LE@16. Value@8 is not a file offset and is ignored.
CHAR: magic@0,tile countu16@4,tile byte lengthu32@12,tile data@16. Infer4/8bpp from tile bytes/count=32/64. Ordinary DS8x8 tile order; SCRN tile entries have tile indexbits0..9,flips10/11,palettebank12..15 for4bpp.
Observed first3packages:32x24tiles=256x192pixels,768tiles,4bpp,512palettebytes. The complete production run decodes all150packages with this structure, not only the examples.
## Scope
The output is each static upper-screen map artwork/template. It does not prove a PAC's association with a current map ID, nor reproduce dynamic treasure-dungeon floor topology or exploration state. Expose all150 separately; do not invent map->PAC bindings.
Source code: web/minimap-pac.mjs; pixel conversion reuses wasm/map_render.c tiles_decode. Game-derived PNG observations stay outside the repository in ../dq9-at-observations and are not deployed.
