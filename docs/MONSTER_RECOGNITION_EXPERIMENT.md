# Experimental ROM-derived monster ROI ranking

Open `monster-recognize.html`, choose a local Japanese DQ9 ROM, then a local image or video. Freeze a frame and draw a rectangle around one enemy. Select up to four candidate model families and an explicit variant assumption, then run the bounded CPU comparison. No table ID or AT seed is required. Files and generated imagery stay inside the browser; no ROM/image upload request is made.

The default candidate scope is orange spirit/z019b, white bandaged/z021a, ochre knight/z064a and silver slime/z000c. Other catalog models may be selected, but unsupported assets/clips remain explicitly reported. All species aliases of a selected model remain attached; z000c retains IDs3 and297. This does not identify an arbitrary enemy outside the selected candidate scope.

The page returns ranked model/pose candidates and an always-present unknown option. Distance is an experimental descriptor score, not a probability or calibrated acceptance boundary. Background/UI and other species can rank highly. No automatic detection, safe hard pruning, birth proof, AT consumption count or current AT recovery is performed.

## ROM-only pipeline

Existing NitroFS/monster asset extraction reads the explicitly selected model variants and animation files. The existing WASM geometry decoder accepts exact NSBCA local object matrices and replays its SBC stack/hierarchy. Supported animation curves are complete rate0 integer samples only. Unsupported encodings are not silently interpolated or substituted.

Quick mode uses bind pose and the middle stored frame of stand/run/appear, four azimuths and a45-degree hypothetical elevation. Standard uses bind plus frame0/middle for each clip, eight azimuths and the same elevation. These uniform defaults were set before the page smoke test; they do not select a privately fitted native phase. One common bounding volume is used across the chosen poses of each model variant.

The existing cancellable template bank now includes clip/frame/decoder identity and common bounds in its cache key. A CPU renderer reuses the existing canonical template projection and unlit materials. The manual crop is compared to generated templates using a24-component hue/saturation histogram, explicit bilinear48px normalization and a fixed, scene-specific blue/teal exclusion heuristic. This is a new ROM-only experimental scorer; prior video-exemplar accuracy numbers do not apply to it. No exemplar images or learned feature-bank bytes are shipped.

## Bounds and lifecycle

- Up to4 selected models and8 explicit model/variant requests
- At most256 rendered templates per job;64px tiles
- Up to8MiB retained pose geometry/material data per model and8MiB template cache
- ROI up to1024×1024; source dimensions at most4096×4096
-30-second cooperative processing budget; CPU rendering yields between views and triangle batches
- Cancel terminates the page's Worker; a later run reloads the selected local ROM
- Frozen pixel identity, ROM/source epochs and ROI are carried in one capture stamp; stale work cannot replace a newer result

The parser relies on the project's existing NitroFS extraction code. The page checks size/game code, but it is not a general hardened validator for adversarial NDS containers.

## Validation and limitations

Portable Node checks cover the exact-sample parser, malformed/truncated inputs, synthetic identity, crop bounds, template budgets, pose/session cache identity, aliases, CPU rendering and Worker error handling. Private actual-ROM checks additionally cover load→rank, cancellation after progress, restart parity and invalid ROI rejection. Existing static template/preview tests remain applicable.

The page is useful as an experimental manual-crop ranking tool. Its real-video accuracy and false-acceptance rate are not validated. A separate controlled rendering diagnostic established useful animated pose coverage, but that does not establish classifier generalization. CPU timings are per-job measurements, not30/60fps claims. WebGPU is not required for this slice; no actual GPU validation is claimed.

`web/monster-animation.mjs` adapts the vendored apicula format reader (scurest, Copyright2019,0BSD). The full license is published at `web/licenses/apicula-0BSD.txt`. No generated game assets are included in the publication.

## Browser smoke check

1. Open the page through the deployed site and select a local JapaneseDQ9 NDS
2. Select a local image or video; for video, pause/seek and press the frame-freeze control
3. Drag around one visible enemy or enter integerXYWH. The crop preview must match the frozen image
4. Leave the four default families, explicit `_f` assumption and quick mode, then start
5. Expect progress, up to four ranked model/pose thumbnails, every species alias, coverage and an unknown notice. No AT value changes
6. Cancel a run, restart, change the ROI/image/ROM, and verify prior rankings disappear and late results cannot return

Only relative, same-site catalog/WASM GETs are made by the recognition Worker. Media inputs use local object URLs and ROM/crop bytes go only to the local Worker through postMessage. No upload endpoint, telemetry, external model service or third-party image request is used.
