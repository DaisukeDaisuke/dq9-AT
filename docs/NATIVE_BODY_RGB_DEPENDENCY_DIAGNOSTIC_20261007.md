# Opt-in fixed-trace body RGB dependency diagnostic

Baseline: 135ae94b7412a39334e8f172cdbc066a00a19eca. Task 622a17e8-9218-44b2-80ed-8b78f78fdbe9.

## Necessary distinction

The accepted partial-alpha map/MSE branch retains a nonzero part of its previous destination RGB when blending is enabled and prior alpha is nonzero. It then records the map/MSE polygon as the final color writer. The existing final-writer mask is correct for its declared meaning, but cannot bound all earlier body color retained through later blending. It is not evidence that all other body pixels were occluded.

This patch supplies an explicitly opt-in diagnostic for that gap. `rasterNativeBody(..., {collectBodyColorDependency:true})` forwards the flag to its existing source compositor. No production caller enables it. Default rendering allocates no dependency planes or diagnostic summary. Accepted fragments, rejection, ordering, RGB, depth, fog, IDs, unsupported outputs, exceptions and asynchronous scheduling remain unchanged. The existing `bodyColorOwnership` object and every camera/identity/AT gate remain unchanged.

## Exact scope and arithmetic

The diagnostic fixes the accepted source trace: alpha, depth, IDs, facing, order, fog flags, and non-body RGB. Independently vary each already-shaded accepted body RGB6 input over 0..63. It does not vary ROM texture resources, pose, geometry, alpha or the actual observed actor state.

Two temporary RGB endpoint planes follow the existing accepted writes. A body replacement has endpoints 0 and63; a non-body replacement has equal endpoints at its actual RGB. Partial-alpha blending propagates each endpoint with the same integer recurrence as the source compositor:

    floor(((alpha5 + 1) * incoming + (31 - alpha5) * previous) / 32)

Alpha31, disabled blending and zero prior alpha replace; alpha-zero/depth/duplicate-ID rejects never call the tracker. Fog is applied by the unchanged source `applyFogPixel` to both endpoints. Unsupported fog weights above128 remain unknown. Final support compares each channel after RGB6-to-RGB555 truncation. The subsequent8-bit expansion is injective. Because these operations are monotone, the two attainable endpoints give exact support for this explicitly independent RGB-input domain.

The retained diagnostic has a pre-fog RGB6 dependency mask and a displayed RGB555 dependency mask. This is a computation of potential color dependence in one fixed trace, not the effect of deleting geometry, actual ROM/background color contrast, complete body visibility, observed pixel membership, species identity or current-state evidence. Counterfactual changes due only to depth/occlusion are excluded. No generic provenance registry, full-frame byte snapshots, ownership upgrade or consumer is introduced.

The extent reader exposes a separate `bodyColorDependency` only when requested. It labels this `diagnosticOnly:true`, `completeBodyCertified:false`, `observedBodyCertified:false`, `identityCertified:false`, and minimum AT0. The old mixed-body ownership field still says `allVisibleContributionsCapturedWithinComposition:false`. Unknown and empty support remain distinct. The diagnostic is not an authenticated capability and must not be used as a gate merely because it has a complete fixed-trace support mask.

## Current bounded measurements

Ten exact stored draws were replayed using the current source baseline, unchanged retained projections and freshly reconstructed source destinations. The actual input and output pixels were inspected. Every pre-existing output field, pixel, native state, fit and extent was identical with the diagnostic off and on.

- The important small-fragment control retains557 raster pixels but only7 displayed dependency pixels on each of its two branches. Final body writers are7 and0 respectively. Positive full gains106637 and92971 remain unchanged. Adding the diagnostic to these actual candidate records leaves the camera decision exactly unchanged: no supported model, no certified body or identity, minimum AT0.
- On the current region125 emitted proposals, writer/dependency/raster counts are z000c5/72/72, z019b59/226/226, z021a95/247/345, and z064a211/739/739. Thus many source body RGB operands remain through later MSE blending even when their polygons are no longer final writers. These are conditional computed proposals, not observed-body matches. In particular, the larger z064a proposal still has negative fit gain; retaining its color support cannot correct its placement or identify the observed body.
- z021a retains247 of345 emitted footprint pixels and242 of346 decoded footprint pixels. Support lost before fog is not relabeled as a missing observed limb. The input/pose/geometry/order assumptions remain conditional.

A complete raster+full-fit+original-component-fit+extent benchmark used the same10 recipes, one warmup and12 alternating-order rounds per variant:360 evaluations. Median10-draw batch times were baseline82.98ms, default75.39ms and opt-in80.40ms (opt-in/default1.066; opt-in/baseline0.969). These noisy bounded timings are not a speedup claim or a general overhead bound. Source preparation is excluded. The earlier timing omitted the optional original-component SSE partition and is superseded by this complete-fit timing. The older isolated producer's4.736× complete-evaluation result concerned its separate full-frame capability snapshot/readback design; this does not erase that measurement or activate its consumer.

## Validation and use

Focused source tests cover21 exact original-output cases, later map and MSE blending/replacement, blend-disabled/zero-alpha/depth/duplicate handling, opaque depth ties, unknown order, full/partial/alpha-only fog, RGB555-only dependency loss, and unsupported fog. A separate scalar oracle exhaustively enumerates64 body channel values for4096 layered sequences, and64×64 independent body input pairs for all129 fog weights. No external native C++ oracle, whole-native-frame equivalence, full build, browser execution or all-input recognition claim is made.

To compare with the unchanged source checkout:

    DQ9_BASELINE_ROOT=/path/to/unchanged/dq9-AT node scripts/test-native-color-dependency-diagnostic.mjs

Existing mode1-MSE composition, MSE ownership, original-proposal, request-branch and isolated-support tests also pass. Root owns full build, integration and publication. Private ROM, video pixels, source geometry and replay objects are not application assets and are excluded from this source-only change.
