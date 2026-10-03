# Same-place dual-background mask, isolated experiment

This callable CPU component is not enabled in the production detector. It accepts a native256×192 query, a raw three-pass RGB median background, an affine-aligned median background, and the existing blocked-pixel mask. It independently applies the unchanged Otsu residual rule to each background and returns the intersection. Disagreement is unsupported evidence, never enemy absence or an AT constraint.

The caller must establish input identity, exclude the target from background references, retain original images and failures, and preserve upper-map registration/marker uncertainty. Reference passages in this experiment were selected by upper-screen map coordinate estimates across the existing five-video scan, before inspecting their lower gameplay images. Three independently timed passages do not by themselves prove a clean static background or matching camera. The existing phase/30-iteration robust affine registration and original semantic thresholds were unchanged.

Measured with the same pinned Node WASM feature provider and the separate coverage12 reference experiment, on four already-known fixed Work7 H4 cases:
-430s: small enemy still missed.
-570s: box(196,64,42,37), fixed GT-box IoU0.97619 and GT-box coverage1.0; this is not silhouette verification.
-710s: no proposed box; the affine-only player false positive is suppressed. No absence certification follows.
-780s: box(70,27,28,54), IoU0.89629 and GT-box coverage0.96552. It remains detected but its box is less tight than the original baseline.

At IoU0.5, original frozen V2 produced1/3 enemy matches and0 false positives on these four cases; repaired references alone produced1 match and1 false positive; the conditional dual-background path produces2 matches and0 false positives. These are known-case diagnostics with additional background inputs, not an unbiased benchmark or proof of generalization. No detector thresholds were fitted to these cases. Extracting this module preserved all four result records exactly.

The coarse private map tracker initially missed780's alignment. The already-existing bounded dense fallback recovered it with the same score/margin gates; this is not a new map-matching algorithm. Coordinate bounds and marker identity remain unresolved. A separate D1-only local-negative-bank experiment preserved true enemies but did not independently reject the partial-player case; it is not a required dependency of this module.

Raw videos, ROM/State, extracted images and feature tensors are not distributed here. Reproducibility tools and private inputs are kept separately. All-map recognition, the small430s enemy, automatic clean-background availability and video AT identification remain unfinished.
