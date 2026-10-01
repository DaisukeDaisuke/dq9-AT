# Optional frozen-frame DINO ROI supplement

The existing monster-recognize page has a second, explicit action after CPU ROI proposal generation: **DINOで候補を補う（任意）**. CPU generation alone never loads DINO or prepares poses. This is a shrine-blue-v1 position aid, not an acceptance test.

## Flow and bounds

1. Load the user's local ROM and freeze a video frame or open an image.
2. Explicitly choose a field scene, the gameplay rectangle and central exclusion; generate the CPU candidates.
3. Optionally choose DINOv2, quick, field `_f`, and the four initial shrine models. The supplement requires exact 4:3 gameplay geometry with each side at most 1024 pixels.
4. Click the supplement button. The existing worker prepares or restores the usual four-model, 64-pose bank, then runs one whole-gameplay patch pass. CPU candidates keep their order and rectangles. Only spare slots are filled, to eight total; a full CPU budget skips preparation and inference.
5. Select a candidate and use the ordinary selected-crop classification button. It classifies the original frozen pixels with the selected backend. Nothing is automatically accepted or continuously scanned.

All added candidates remain unverified. Background candidates and additional per-crop classification cost are explicitly displayed. Zero candidates do not prove absence; rankings do not establish an enemy's identity, birth, AT consumption or current AT state.

## Shared preparation and cache safety

`prepareDinoPoseBank` enters the same renderer, pose order and persistent per-model cache loop used by `recognizeROI`, without encoding a fabricated query crop. It requires the complete four-model quick/_f bank and returns owned copies of the exact 64 vectors it actually used. It does not sweep unrelated runtime cache entries. The ordinary cache keys still bind ROM SHA, model/provider/precision, renderer revision, model/variant, pose policy and view settings.

`encodePatchGrid` is additive; the ordinary `encode` implementation is unchanged. WASM and WebGPU remain explicit choices, with no silent fallback or cross-provider vector reuse. Missing/unsupported poses fail visibly instead of producing an incomplete-bank supplement. Persistent cache read/write errors retain the existing regenerate/warning behavior.

The worker job owns copied current pixels and a cloned CPU proposal set. The page binds it to the full frozen-capture stamp and the original proposal-set object. Cancel, new capture, source/ROM/configuration changes, overlay clearing, and page lifecycle invalidation prevent late results from appearing. CPU suggestions remain usable after a failed or canceled supplement. The source image is never sampled from advancing video or from annotated display pixels.

## Measured scope

Frozen, previously research-exposed examples with the unchanged rule:

- Other recording: CPU 11/18 labeled bodies; CPU plus patch supplement 14/18
- Six selected bodies in a 24-frame sequence from that recording: 2/6 to 4/6
- No CPU losses; maximum eight suggestions
- The repeated knight view across those groups is not an independent success
- Every reviewed negative reaches eight suggestions after fusion; background rejection is unsolved
- Central exclusions, wall merges and small low-contrast metal still cause misses

The integrated Node DOM/canvas flow used actual frozen video pixels and ONNX Runtime Web WASM/int8. Both selected added knight crops ranked the expected model through the existing classifier. All 64 template pixel hashes, vector bytes and cache keys matched the current base implementation. Selected-crop rankings, thumbnails, coverage and unknown outputs matched before and after the engine factoring.

In that run, cold pose-bank preparation plus the coarse pass took about 32.4 seconds; subsequent supplement jobs took about 0.92 and 1.22 seconds. The backend and ROM were already loaded, and public asset download is excluded. These are cloud Node/WASM measurements, not actual-browser or WebGPU timings. Follow-up selected-crop classification is additional. The UI reports preparation reuse, patch-pass timing and total action time separately.

## Verification

Focused tests cover ordinary recognition/cache behavior, additive patch contracts, preparation without query jobs, incomplete/incorrect bank scope, provider/ROM mismatch, cancellation, stale results, ownership, full-budget skips, oversized inputs, and the existing CPU-only flow. Actual browser/GPU QA and the aggregate build are separate review steps.

No ROM, video frames, model weights, pose vectors or diagnostic images are included with these source changes. The rejected temporal propagation experiment is unrelated to this frozen-frame control.
