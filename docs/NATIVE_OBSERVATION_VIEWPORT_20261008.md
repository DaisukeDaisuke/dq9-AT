# Exact observation-viewport clipping for native body composition

This removes a false unsupported destination case. It does not fix monster identity or complete-body placement.

## Observed current-source cause

The relevant old 2332cf and current 3a5f653a placement, runner, native body and composition modules are identical except import cache tags; perspective placement and scene composition are byte-identical. A diagnostic replay against 3a5f653a reproduced the failure from the earlier frozen frame. This is a selected historical diagnostic, not a fresh blind accuracy trial.

For automatic component 129 at 173.729 s, the first retained background hypothesis has integer alignment dx=-5, dy=+2. Its first z019b proposal has source root [201819,-3760,-28384], stored stand frame 6, yawFx9651, scale266. The unchanged native raster produced 833 alpha-positive source footprint cells. Exactly 45 destination-unknown cells are in native y190–191. There are zero RGB mismatches, zero unknown-order cells and zero opaque depth ties. All 45 cells translate outside the 192-row observation.

Call chain: createNativeBodySupportRunner evaluates the unchanged native proposal through projectNativeBodyPolygons and rasterNativeBody; scene composition uses the frozen destination produced by bindNativeBodyDestination. Binding deliberately marks source cells outside the aligned observation unknown. Previously composeNativeBodyOverSourceDestination rejected those cells before its final output loop discarded them for being outside the observation.

## Exact domain

The existing final projection is x'=x+dx, y'=y+dy, with output 0<=x'<256 and 0<=y'<192. Intersected with the source viewport, the admitted source rectangle is:

- max(0,-dx) <= x < min(256,256-dx)
- max(0,-dy) <= y < min(192,192-dy)

For this diagnostic it is x in [5,256), y in [0,190). No learned boundary, model-specific constant, fit threshold, ROI change or inferred pixel is used.

The patch applies that same existing output predicate before destination admission and pixel-local composition. Source opaque depth, translucent blending, polygon-ID state and fog already operate independently per cell in this admitted renderer. Omitting an out-of-observation cell cannot change an in-view cell. It does not skip unknown in-view cells. Any in-view unknown destination, unknown ordering or opaque depth tie still rejects the entire visible proposal. No known subset is selected by favorable score.

The full original source footprint is retained as sourceCoverage. Extent evidence therefore still reports the true aligned clipping count rather than describing the body as complete. An observationViewport record reports excluded and admitted counts, with completeBodyCertified=false. A completely off-observation proposal has zero visible pixels and zero gain, so background-only remains preferred.

## Verification and limits

- New regression covers all four viewport borders, the observed integer translation, opaque and translucent fragments, in-view unknown/order/depth-tie rejection, retained source extent and empty zero-support output.
- Against the unmodified source, supported clipped synthetic cases preserve every visible RGBA byte, full original source coverage and complete comparison-fit object.
- Existing color-dependency diagnostic preserves all 21 original composition outputs exactly; its exhaustive quantized blending/fog checks also pass.
- Existing mode1/MSE order and ownership tests pass. Existing 100 non-build build-script commands pass. Full native compilation was not run locally.
- Targeted eight-background/four-model historical replay admits z019b and z064a first proposals previously refused solely for off-observation cells. z019b total pixel gain remains negative (about -10.21M to -10.66M). Other candidates remain alternatives, and no species, observed presence or current AT certification is granted.
- Complete-envelope center placement, poses, scales, floor selection, ordinary domain exhaustion and unseen accuracy are not solved by this patch. Fresh unseen evaluation is still required after integration.
