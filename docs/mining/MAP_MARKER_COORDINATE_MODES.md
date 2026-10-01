# Physical coordinates and fixed minimap anchors

JP minimap groups distinguish the source of party-marker coordinates. Under the ordinary group-selection path, BMMP opcode `0x6b` identifies maps whose marker uses physical actor X/Z. Opcode `0x6c` identifies maps represented by a fixed display anchor. The latter does not encode an interior actor's physical position.

The parser retains source group order. Native allocation prepends each group; the first matching runtime group wins, so the last matching source group is selected. Invalid, incomplete, unknown-kind or missing map membership produces an unknown coordinate interpretation. A field-code or shared-image association alone is insufficient.

For example, `C01.bmmp` has a physical branch for map100 and a fixed-display branch for house map103. If both identities remain possible, the output retains both: map100 may have provisional physical X/Z intervals; map103 has a display-anchor result with no physical X/Z or chunk bounds. Shared imagery does not merge these meanings or discard the outside branch.

The automatic candidate path stores `markerCoordinateBindings` per reference and `mapCoordinateAlternatives` per map identity. Manual reference matching carries its selected map's binding. Missing binding metadata stays unknown. The UI labels fixed points and keeps physical chunk ranges exclusive to conditional physical branches.

Source basis: JP `0201f3ec` constructs ordinary physical groups, `0201f4b4` constructs fixed groups, `02026540` applies group selection, `020552c4` stores display X/Z at actor `+0x19c/+0x1a0`, and `020230a4` uses actor `+0x180` mask `0x10` to choose those fields through `020552d0` instead of physical XYZ at `+0x44/+0x48/+0x4c`. The mask is a value, not bit index10. Other party/world/current-map modes and marker visibility are still conditional.

These static source branches do not prove the observed map, party identity, execution mode, height Y, control input, AT calls or current seed. Physical pixel-to-world intervals remain heuristic and uncalibrated. No new descriptor associations or runtime capture are introduced by this guard.

Portable checks: `node scripts/test-map-marker-coordinate.mjs` and `node scripts/test-coordinate-range-ui.mjs`. The first optionally accepts a local Japanese NDS path for seven additional ROM metadata checks; no ROM or capture is bundled.
