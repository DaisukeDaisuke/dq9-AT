# Restrict immutable observation ownership to the AT entry

Task: 5d2d66f2-03d7-405d-872b-746d01cbb6ec
Base: pending integrate-preparation-copy-ddb1e06e, after published 8d01161af62d770c9c6edb43c6230929cf7b6364 and the preparation-copy patch. This is an additional patch, not a stage replacement.

## Corrected regression

The shared panel is mounted by both preview.mjs (connected to createVideoTrackingAT) and gpu-file-preview.mjs (no AT observation consumer). Freezing every fast-path bundle charged the non-AT entry for immutable ownership without eliminating a downstream AT copy.

The correction adds an explicit immutableObservationBundles option, default false, to mountMapVideoComparison and VideoObservationTimeline. Only preview.mjs's actual AT-connected mount supplies true. The non-AT GPU entry is unchanged and inherits the default. The timeline freezes only when both that explicit option is exactly true and the existing unaliased residual contract is satisfied. Data fields and producer labels never establish the opt-in.

Default bundles again use one native structuredClone, are mutable and independently owned, and make zero freeze calls. The explicit main/AT path keeps its private immutable ownership optimization. Generic fallback, built-in types, production guards, cancellation, request/checkpoint fields and unknown alternatives are unchanged.

## Measurement

The revised profiler separates the non-AT producer cost from the AT-connected producer/consumer cost. It also resolves both the candidate and baseline helper URLs from their respective production timelines, preventing a mismatched private WeakSet in newer baselines. The preparation-only profiler explicitly selects the AT-connected timeline configuration.

Using the supplied warm timeline/comparison and the reconstructed production envelope, seven measured default-producer samples after one warmup per variant show:

- Previous implicit-freeze default median: 406.863 ms, range 394.812–463.353 ms.
- Corrected native-copy default median: 242.765 ms, range 231.078–313.642 ms.
- Saved producer time: 164.098 ms median, 40.3%.
- Previous default output was frozen; every corrected default output was mutable. All JSON hashes matched.

For the explicitly AT-connected path, consumer ownership-copy medians remain effectively unchanged at 0.013580 ms before and 0.013410 ms after. It intentionally uses the same optimization. Full real preparation/controller outputs, observation hashes and request/checkpoint results match. Any measured variation in its unchanged producer/consumer path is not attributed to this wiring correction.

This is Node v24.19.0 profiling, not browser/decoder verification, an initial-gap causal claim or a continuous-recognition completion claim. Private input video, pixels, ROM and game assets are excluded.

## Verification and scope

Passed ten focused ownership cases, including new checks for default/false/non-boolean options, zero default freezing, mutable independent snapshots, source alias preservation, main explicit opt-in and GPU default wiring. Existing positive camera, guard, retry and cancellation cases remain passing.

Passed existing timing checks, preparation-copy checks and the capture-control-flow fake DOM/Worker harness. No shared standard build was run.

Production changes are only:

1. Timeline constructor option and choice of the existing clone function.
2. Panel mount option passed to the timeline constructor.
3. Main preview explicitly opting in alongside its AT callback.

No GPU entry file changes; no renderCurrent/renderFromName or timing-instrumentation edits. The tracking worker confirmed those spans are disjoint. Apply ownership-opt-in.patch to the pending stage alongside its instrumentation patch; do not replace complete files from an older stage.
