# Map display-coordinate index

The existing map browser and map-recognition reference view now expose each selected map ID's explicit BMMP display contexts. The **配置** selector preserves original image candidates and adds fixed-display contexts separately. A checked **固定表示点** control draws the selected map's representative point on that composed image. It never places a physical actor without an observed coordinate. Unchecking it restores the unannotated image; PNG saves the currently displayed view.

**座標対応 JSON / CSV** exports the locally generated index. Nothing is uploaded or fetched as a ROM-derived dataset. The original `records[].candidates` used by image recognition is unchanged. If optional coordinate indexing fails on malformed metadata, its exports are disabled and ordinary map browsing retains its original candidates. Thus a contextual town/regional display is not silently nominated as the current interior's recognition image.

## Reusable API and command

`web/map-coordinate-index.mjs` exports `buildMapCoordinateIndex(metadata)`, `descriptorPixelFrame`, `projectDisplayAnchor`, `coordinateDisplayOptions`, and `mapCoordinateIndexCSV`. Supply fresh `MapProject.metadata()` output; old snapshots without group-order evidence retain unknown bindings.

```
node scripts/mine-map-coordinates.mjs --rom local-jp.nds --out local-index.json --csv local-index.csv
node scripts/test-map-coordinate-index.mjs [local-jp.nds]
node scripts/test-map-coordinate-panel.mjs
```

The CLI requires explicit output paths, includes the input ROM hash/revision, and does not export image/ROM byte payloads. JSON includes unrepresented map IDs with an explicit reason. CSV contains one row per observed display relationship; it is not a complete list of all maplist records.

## Coordinate contract

- Keep a row per map ID and descriptor; town, region and interior displays can coexist.
- `fixed-display-anchor` contains the BMMP display X/Z in signed 20.12 fixed point, source group offset and ordinary runtime selection conditions. It is a representative point, not the actor's physical position or a door trigger.
- `physical-xz` supplies a descriptor transform but has no point until coordinates are separately observed. A floor name does not give height Y.
- `unknown` preserves incomplete or invalid group-order evidence. Maps without an explicit group stay in `unresolved`.
- Source group order uses the existing verified last-source-group/first-runtime-match rule.
- Image crop dimensions and origin reproduce `MapRenderer.compose`: placement values are tiles, min placement is the crop offset, and `originPixel = originTile * 8 + minPlacementPixel`.
- The provisional projection is `pixelX = displayX * scale - originPixelX`, `pixelY = displayZ * scale - originPixelY`. This is the inverse of the existing candidate transform. Its pixel calibration is **not independently verified**; export flags remain `transformVerified:false` and `runtimeContextVerified:false`.
- Out-of-image points retain their numbers and are marked outside; the overlay does not clip them into a false visible location. Missing image geometry keeps the raw fixed anchor without inventing pixels.

## Local revision-0 validation

A caller-owned Japanese revision-0 ROM produced 1,267 explicit relationships: 888 fixed and 379 physical, spanning 493 map IDs. The 380 distinct map IDs with no explicit group remain unresolved. These are display-context counts, not counts of interiors or navigable locations. There are 1,010 maplist records, including repeated IDs.

All 283 ordinary descriptor pixel frames matched the actual existing WASM compositor's width, height and crop origin. Example map103 on `C01.bmmp`: raw display X/Z `(20889,81592)`, frame `200×248`, origin `(-96,-128)`, scale `4`, provisional image pixel `(116.3994140625,207.6796875)`. The synthetic suite covers multiple displays, group precedence, negative/cropped placements, unknown metadata, missing geometry and no image-recognition candidate mutation. Panel tests cover drawing, toggling, physical-coordinate non-drawing, mismatched images, release/reload and both existing pages.

No live game/capture calibration or inference of an interior-to-exterior actor transform is claimed. Static exit resources are not needed to compute the explicit BMMP anchors and no reverse travel edges are invented.
