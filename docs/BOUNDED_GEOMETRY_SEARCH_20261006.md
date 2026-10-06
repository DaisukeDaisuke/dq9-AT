# Bounded geometry line-search safeguard

The same-frame source-depth registration loss can have several local minima. A golden-section line search across the entire source marker interval can discard a better basin because it assumes a unimodal function.

Each line now samples eight equal subdivisions of its existing source-bound interval, retains the current point, and refines the best sampled bracket. All probes remain within the original marker XZ bounds. At most 48 objective evaluations are made per line, compared with the old ceiling of 52. The existing three image scales, 12 outer iterations, direction update, convergence criterion, native re-render, floor branching, photometric solve and forward acceptance gates are unchanged. Realized iteration counts and runtime can differ on individual inputs; the fixed worst-case objective-call ceiling is lower.

This is a bounded proposal search, not a global-minimum proof. Narrow unsampled minima, coupled directions, occlusion, an incorrect source camera model and out-of-bound source geometry can remain unresolved. Non-finite results remain unsupported. A boundary optimum remains an unresolved source-interval case and is rejected by the existing callers. No native identity, map/camera certification, body ownership, monster identity, birth or AT proof is added.

The private fixed five-frame replay used exact browser-matched YUV and canonical analysis RGB. The former final-frame alignment failure becomes a conditional result under the unchanged comparator; a vertical residual translation remains. The browser-exported exact Canvas gameplay pixels reproduce the previous failed comparison exactly and give the same conditional result with the revised source background. End-to-end candidate execution in the browser remains a separate verification. This observation does not establish all-input support or completed automatic tracking.

`node scripts/test-geometry-position-refinement.mjs` checks multi-minimum sampling, source bounds, starting-point retention, endpoint reporting, non-finite outcomes, cancellation and synthetic same-image/disjoint-camera cases. Procedural controls are not a source of acceptance thresholds.
