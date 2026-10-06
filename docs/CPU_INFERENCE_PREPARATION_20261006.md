# Explicit CPU inference asset preparation

Baseline: `current-at-published-6abc3897`. Integration scope: encounter-context workflow gate plus explicit CPU asset preparation only.

The map-preview preparation panel now offers a CPU button beside the existing GPU button. The CPU button calls the unchanged `ensureInferenceAssets({backend:'wasm'})` path, covering exactly four fixed-manifest files totaling 36,427,661 bytes (34.7 MiB). The GPU button still covers its separate four files totaling 70,045,098 bytes (66.8 MiB), and retains the WebGPU/shader-f16 probe. CPU preparation never probes GPU. Sources remain the pinned Hugging Face DINOv2 revision and jsDelivr ONNX Runtime 1.23.2.

Both buttons share one cancellable operation. Repeated clicks cannot overlap profiles. ROM, local video, layout, backend changes, pagehide and explicit cancellation abort preparation and suppress stale progress/results. Verified completed files remain reusable; current failures expose retry. Preparation does not change inference backend, choose any recognition parameters, or start recognition. Ordinary playback and backend selection remain cached-only. CPU and GPU completion/error messages identify the selected profile.

## Verification

- New mounted-DOM tests: 663 checks for CPU/GPU button routing, no mount-time or selection-time download, accurate sizes/sources, missing GPU support, pending probe cancellation, overlapping requests, all existing cancellation events, stale success/rejection, dispose/remount and retries.
- The retry test runs the actual recognition worker's control flow and actual DINO initializer against the real asset-cache implementation, with synthetic manifest bytes and a synthetic ORT session. Initial cached-only recognition fails with the existing preparation-required error. Explicit CPU preparation fetches only four CPU fixtures. The next recognition reinitializes and succeeds; the subsequent recognition reuses the session. No worker or DINO production change was needed.
- Existing asset-cache tests: 154 checks, including fixed allowlist, size/SHA-256 validation on cache reads and writes, controlled-service-worker setup, cancellation and profile separation.
- Existing DINO tests: 100 checks.
- Encounter gate regression: 101 checks.
- Integrated standard build: exit 0 using the restored LLVM19 toolchain. Both new regressions are wired into `scripts/build.sh`.
- Browser cache closure: all 10 incoming edges to modified modules use `monster-map-cpu-20261006-1005`.

These are source, synthetic-DOM, worker-control and build checks. No browser click, network model download, actual-model inference, classification accuracy, full-input coverage or complete automation is claimed. Browser validation remains with the parent task. No model, ROM, state, video or extracted game asset is included in this source change.
