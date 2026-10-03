# DQ9 map renderer integration checkpoint

2026-10-03 10:43 UTC. Work in progress. This is an emergency source backup, not a completed all-map viewer. Existing production pages are not replaced.

## Files and resumption
All local browser modules and their source dependencies are included under web/. No ROM, save state, RAM, video, extracted model/texture, captured image, or private communication is included. ARM9 tables and game assets are obtained at runtime from the user's original ROM.
- web/static-scene.mjs: source placement and static geometry assembly.
- web/texture-binding.mjs and web/draw-packets.mjs: exact authored texture/palette names and explicit material context.
- web/map-click-camera.mjs: requested map-image X/Z to player camera. Height Y/current camera conditions must be supplied.
- web/fog-frame.mjs: strict post-raster RGBA6665/depth24/fog-mask input, ordinary mode1 only. Do not substitute WebGL normalized depth.
- web/index.html: vertex-color diagnostic plus an optional explicit ROM texture resource/native material context. web/texture-preview.mjs consumes prepared mode0 packets with nearest sampling. Native raster, translucency, winding, depth and fog parity remain unverified. Browser rendering is not yet accepted.

Run Node22+ source CLIs with private inputs/outputs:
```sh
node replay-static-geometry.mjs ORIGINAL_ROM PRIVATE_REPORT
node replay-static-scenes.mjs ORIGINAL_ROM PRIVATE_REPORT
node replay-texture-binding.mjs ORIGINAL_ROM PRIVATE_REPORT
node replay-draw-packets.mjs ORIGINAL_ROM NATIVE_MATERIAL_CAPTURE PRIVATE_REPORT
node replay-map-click.mjs ORIGINAL_ROM EXISTING_MAP_METADATA PLAYER_CAMERA_REPLAY NATIVE_CAMERA_PREFIXES PRIVATE_REPORT
```
Inputs are the unchanged YDQJ revision0 ROM and, where relevant, the existing metaru_soubi native captures. The full ROM identity is checked by CLIs. Do not replace missing native state with invented defaults. Original source and private evidence remain separately preserved.

## Verified scope
39 shrine NSBMD parse through the geometry adapter;44 placements give39 static instances and5 unsupported col2 branches. Across669 AMDJ/755 placement streams,5651 source placements give3691 static instances and1960 unsupported instances:1297 col2,444 BBY,107 BB,112 flag0x10. These are adapter coverage counts, not rendered map counts. Texture binding on the shrine yields325 exact matches and2 unresolved references.
Native camera replay uses retained root captures:96 targets/eyes and48 perspective matrices match. Map-click arithmetic roundtrips the original shrine position when original Y/camera state are supplied. No browser click or ground-height proof is claimed.
The submitted fog component was independently rerun against original ROM/state and pinned-core formula references:392B records match39 native samples,12frame off/off/on comparisons match,12events/drop0,14,417,920 LUT bytes and36,896 blend cases match. These do not establish full-scene pixel parity.

## Next work
BB/BBY native matrix behavior is being connected; those branches remain rejected. Runtime visibility/culling, animated/special resources, floor height, native material shader acceptance, native raster depth/masks, fog, and full pixel acceptance remain. All maps remain the goal; shrine is only the first dynamic comparison.

## Licenses
Preserve the adjacent notices. rom-arm9.mjs adapts NTRGhidra CRT0 under Apache2.0. native/fog-raster.mjs adapts DeSmuME under GPL2-or-later, and fog-frame.mjs retains that distribution condition. Existing dq9-AT vendor/coordinate source retains its MIT license. No claim is made that the root MIT license overrides component licenses.

## 10:43 UTC source checkpoint
Limited BB/BBY packet construction is saved in web/native-billboard.mjs. Ordinary branches only, explicit native model-view and previous template required; dynamic native comparison and renderer connection pending. Existing static-geometry rejection remains. The post-recovery8query helper batch completed on the freshly imported original ROM. The texture consumer is diagnostic and requires explicitly selected source resource/global state; no invented camera, palette or floor defaults.

## 11:01 UTC collision-resource inventory
Native loader0204cd64 and candidate collector0204ce50 identify the version3 COL2 header offsets,28-byte records and cell-index references. replay-col2.mjs scans all1350 AMDJ/AMBL archives:1178 COL2 files pass the structural bounds/reference checks. This does not establish ground height, face semantics, collision parity, walkability, or rendered coverage. Four copied signed-short triplets are retained without assuming all four are polygon vertices.
