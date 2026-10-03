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

## Selection-order follow-up, 06:48 JST

The remaining430 region was not simply below the numerical threshold. The highest-mean reference failed the unchanged vertical-support gate, hiding lower-scoring references that passed every gate. The analogous coarse selector hid a qualifying570 reference behind a higher-scoring incoherent reference.

The isolated `coherent-reference-ranking.mjs` prefers references satisfying the existing gates before comparing the original mean/score. It retains the best failing evidence when no reference qualifies. The frozen detector module is not overwritten. With this selection-order change, the original64 reference bank and dual background mask produce all three H4 enemy boxes and no box on710. The repaired coverage12 bank and labelled D1 player bank are unnecessary for this latest path. The430 box is still partial:27/34 of its GT-box width, IoU0.79412. Other H4 boxes are unchanged; full-body and generalization claims remain unsupported.

On all33 fixed D1/D2/H4/H2/Lasdan frames using the original geometry, both banks retain the same boxes. With the original bank, full proposal records are unchanged. With the repaired bank, one D1 proposal changes its reference/evidence because a coherent coarse result avoids fine fallback; the box stays unchanged. Earlier fine-only results and this broader change are stored separately.

Downstream CLS ranks the fixed GT model first for the three automatic H4 body crops within the four selected models, with both opaque and image-derived alpha variants. These scores are uncalibrated. The body-part reference winner must not be interpreted as species identity:430's spatial winner differs from its downstream CLS winner. Diagnostic appearance-component unions were not adopted as box expansions or counted as detection improvements.

A separate fixed temporal block is being evaluated with the source/bank/rules frozen. No production integration or recognition completion is claimed.

## Temporal follow-up: background path rejected, 07:25 JST

The fixed30-frame temporal1190 block did not confirm the background method. With the same actual NodeWASM provider and original64 bank, originalV2 obtains9/22 enemy-box matches and0 false positives at IoU0.5; coherent-first ordering alone obtains10/22 and0 false positives. The10 unavailable background frames contain5 enemy boxes and were not scored as negatives.

On the identical20 available frames/17 enemy boxes, originalV2 obtains7 matches/0 false positives, coherent-first original geometry8/0, and the dual-background path3/6. The background path is therefore rejected for general use. The earlier H4 result remains a known-case result, not evidence that it generalizes. No thresholds were retuned after this failure. Visual review of the first two added false boxes places them on a torch/wall and tablet edge; a party-ID error was not established.

Offline input replay into the unchanged existing tracker keeps all identity/birth/AT flags uncertified. Both original/coherent paths reset on11 camera-registration failures and produce no tentative continuations on this sparse block. No live250ms scheduler, real-time speed or native actor identity claim follows from this replay.
