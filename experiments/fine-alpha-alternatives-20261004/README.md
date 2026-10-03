# Fine alpha alternatives: isolated diagnostic

The original chroma-alpha fine crop can remove body support; opaque-only crops lose different true bodies. This helper merges two independently verified, same-capture result sets using the existing priority order, IoU > .35 duplicate rule and eight-box budget. It does not alter body-support gates or choose a mode from annotations.

Known fixed temporal30frames/22enemy boxes atIoU.5: originalV2 9TP0FP; coherent-first chroma10TP0FP; opaque-only8TP0FP; merged11TP0FP. Separate original33fixedframes/15enemy boxes: chroma8TP2FP; opaque-only7TP0FP; merged8TP2FP. Unknown and non-target enemy annotations remain in denominators. The old false positives remain unresolved. These are known-case diagnostics, not an unseen holdout or calibration.

Both crop modes were actually encoded with the same pinned NodeWASM provider and original64 ROM references. The merge is replay of those actual outputs; it is not an independent live video benchmark. No game-derived feature vectors/images belong in this repository. No production import is enabled.

Using verified intermediate camera steps in an isolated copy of the existing tracker, the merged result gave7tentative continuing associations matching the original manual visible-body track labels post-hoc. A camera failure still resets the last interval, missing detections are not bridged, and nativeIdentity/birth/AT remain false/false/0. Live observer250ms scheduling is unverified.
