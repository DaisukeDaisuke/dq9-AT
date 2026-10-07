# Source-camera-relative reference heading, with original outcomes retained

Baseline: d2ef869c3a5acc144fb73ae14496de1ea576a064. Task UUID: 76ffd455-bb86-462d-bcf0-e91498a8e836.

## Result and limit

The first unchanged queued emitted-envelope alternatives were examined for original component 292 across all four admitted models and both backgrounds. All eight remain worse than background-only in both the original-component and full-pixel objectives. This disproves neither model presence nor untested poses; it establishes that this particular source placement change does not fix the body miss.

The actual image and both old/new source render panels were inspected privately. The native emitted placement removes a small center discrepancy, but leaves the pose/limb arrangement different from the video. For z021a, decoded root [-148287,656,-402451] becomes [-148188,656,-402476]. Its projected center changes from [101.711254835,61.701458282] to [101.995780390,61.504263727], near the assumed component center [102,61.5]. The first changed source vertex is polygon 0, SBC offset 1022, shape 0, command 2, before raster pixel (96,43). Topology, source material, UVs, pose, scale and heading are unchanged. This is not evidence of a native world-transform defect.

## Proven coordinate mismatch

The appearance renderer records view.yaw as bestPose.yaw. Both GPU templateMatrix and CPU rasterTile use the same canonical camera orientation:

- Template orientation is Rx(templatePitch) Ry(templateYaw), apart from centering, common scale and orthographic depth.
- The native renderer applies branchCamera Ry(actorYaw), using its existing ROM trig table and FX matrix multiplication.
- For an admitted upright source look-at camera, branchCamera = Rx(cameraPitch) Ry(cameraYaw), so the relative horizontal heading is cameraYaw + actorYaw.
- The prior bridge copied templateYaw directly into actorYaw. A branch-camera-relative hint is actorYaw = wrap(templateYaw - cameraYaw).

Both current branches have cameraYaw = pi/4 and cameraPitch approximately 0.574051595 radians. The template pitch is pi/4. The old direct hint therefore differs by 45 degrees horizontally in all 256 current region/model/branch combinations. Sixteen known-camera controls and the actual SDK angle-conversion/table signatures confirm this coordinate statement. It does not prove the current actor heading, animation phase or the cause of all image differences.

Source locations: monster-webgpu.mjs previewMatrix/templateMatrix and createTemplateAtlas; monster-cpu-template.mjs rasterTile; monster-recognition-engine.mjs bestPose construction; monster-native-reference-pose.mjs; monster-native-body.mjs projectNativeBodyPolygons; native-camera-fx.mjs lookAtFx.

## Minimal change

- Keep readNativeReferencePose and the former direct heading unchanged.
- Derive an additional priority heading only for an exact admitted source upright lookAtFx basis. Recompute x = normalize(up cross z), y = z cross x using the existing source FX operations, and require exact equality. No fitted camera tolerance. Rolled, sheared, inverted-up, degenerate or missing cameras fall back to the former direct hint.
- Convert the derived angle using the existing 25736-unit native cycle and normalizeNativeAngle. Actual native trig quantization remains in the renderer. The helper admits the same bounded reference yaw interval; no general normalization claim is made outside the derived hint range.
- Schedule the camera-relative reference first, then retain the former direct reference and the original stored pose/yaw/scale/floor domain. Both decoded and source-emitted placements use their existing machinery.
- Preserve each reference-heading alternative's scene and isolated outcomes, ordered failures and decoded/emitted bests separately. Transport these additive records without changing appearance rankings, prior scaled body fits, identity guards or AT constraints.
- Never substitute template pitch for the branch camera. No model label, root, heading or threshold is chosen by fit gain.

## Actual finite controls

All four admitted models and both backgrounds were evaluated with the same stored clip/frame/source scale in three separate controls: original decoded root with angle only changed, source-recentered decoded envelope, and first source-recentered native emitted envelope. All 24 full/component gains remain negative.

For z021a, component gains in branch 8 / branch 9 are:

- Old direct emitted: -2286984 / -1635467
- Relative angle at old root: -2818756 / -1891072
- Relative decoded placement: -3042970 / -1813693
- Relative emitted placement: -2661468 / -1568400

Relative emitted full gains are -6486348 / -4496808. Its raster overlaps 363 of the original 500 component pixels, compared with 245 for old direct emitted. Increased overlap is not correct body reproduction: color/limb differences remain, some component scores worsen, and all gains are still negative. Complete body-contribution, identity and AT guards remain unchanged.

## Whole-input qualification

The original unchanged job preserved all 32 region positions, four models and two branches, using 1500 ms / 128 per slice. It reached first-sweep 256/256 and the requested eight emitted outcomes at slice 5, cursor 80. All 165 available live scene bests and 171 isolated bests were exactly reproduced, including original-component and compared-buffer bindings.

The corrected job again used the entire input/order and unchanged slice bounds, reaching both heading alternatives' decoded and emitted outcomes for the target eight lanes at slice 12, cursor 78. All 16 former target scene/isolated outcomes remain exact; all 16 relative decoded/emitted outcomes match the separate finite control. No action, broad integer-yaw or fractional-phase domain was opened. Per-slice elapsed time can exceed 1500 ms at existing indivisible source segments; no hard-wall guarantee is claimed.

Focused checks cover source camera/wrap controls and fallback, independent failed-hint retention, original no-hint ordinary/action/yaw behavior, portable bounded phase scheduling, cancellation/stale/mutation, request branches, pixel identity, original-component ownership, unchanged UI objective and native support transport. A phase regression initially received an unsuitable historical baseline that itself included the fractional domain; that invocation was interrupted and preserved, then the documented portable integer-only fixture passed. No full build, browser qualification, Git or publication was performed here.

## Frozen recipe and ownership

Private evidence retains the freshly source-reconstructed current-live request, original and corrected per-job cursor snapshots, all events and failed outputs, projected geometry and original render buffers. The v8 cursor is a semantic checkpoint with branch/job/plane/pending-placement state; it is not a portable production continuation token. Production exposes no persisted checkpoint restore API. Exact replay uses the retained bound request with the appropriate frozen source version and the existing continuation protocol; a new service must not reuse an old opaque token. Neither raw/private inputs nor cursor planes, images, models or source plans are included in the source-only archive.

Integration changes are limited to three production modules, the focused camera test and the phase test's dependency fixture. Cache/import closure and browser qualification belong to the integrating task. All old negative results remain available and no general input coverage or automation-completion claim is made.
