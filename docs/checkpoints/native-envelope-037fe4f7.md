# Additional native-envelope hook

Exports:
- prepareNativeBodyEnvelope(program, {camera, actorScaleFx, yawFx, animation=null, frame=null, alignment, billboardProfile=null})
- placeNativeBodyEnvelopeOnFloors(envelope, region, floorPlan, {maxIterations=16})
- nativeProjectedBodyEnvelope(projected, alignment)

Reuse the existing native runner's prepared program and parsed stored animation. Pass null animation/frame for bind. For billboard programs, pass the existing explicit conditional-ordinary-ROM-initial-templates profile with globalFlags, contextFlags, callbackOverride.

Do not replace current placeCompleteBodyOnFloors results. Append returned additional placements, retaining source assumptions, exact native reprojection error, and distinct IDs. The helper reads no video pixels and makes no classification decision. Both true-body fixtures demonstrate why first-pose negatives and worse alternative placements cannot justify body rejection.

Each preparation performs four source GX projections; each successfully solved floor adds one native reprojection. Bound or resume this extra work inside the existing worker budget. Cache only within the same verified source/camera/pose/scale/yaw/billboard binding. Do not bind it to a model/region allowlist.

Run the synthetic contract with:
node derive-visible-body-037fe4f7/tests/native-body-placement.test.mjs

Private full measurements are scripts/inspect-envelopes.mjs, scripts/measure-placement.mjs, and scripts/measure-opaque.mjs. They intentionally refer to fixed previously saved user inputs for measurement, not runtime model/region rules. Do not publish their input assets.

## Minimal cache/budget hook suggestion

Add an internal runner method such as proposeNativeEnvelope(candidate, {camera, alignment, pose, billboardProfile, region, floorPlan}). It should use the runner's existing prepared(candidate) cache and the same lazily parsed animation map as evaluate; it returns the helper's additional placements/unsupported reasons only. No new model selection or source program cache is needed.

To avoid slowing or changing the first sweep, do not generate these four extra projections before the existing first proposal. Retain a source-pose descriptor for a second placement phase; on a subsequent fair visit after its decoded-envelope pending placements drain, generate the emitted-envelope alternatives, store them in job.pending with distinct IDs/provenance, and evaluate them under the same one-proposal budget/continuation. Advance to the next pose only after both phases. No known model/region is prioritized. A native-envelope error must preserve the existing decoded phase and continue to other poses.

Check the remaining wall-time and frozen-work guard before preparation and after it. Reuse the same prepared source/animation cache, and retain already generated pending placements if the render slot cannot fit; do not recompute them after resume. For stricter latency bounds, let the existing continuation own a floor-plane cursor and pass a bounded plane subset to the helper. Plane order and provenance remain unchanged.

This hook intentionally leaves the current old-first first-sweep evidence unchanged. The added full-domain positive metal candidate requires later work and is not promised by the first-sweep UI response.
