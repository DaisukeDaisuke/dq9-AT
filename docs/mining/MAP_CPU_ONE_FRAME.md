# One-frame CPU map-name fallback

The map-image Akinator already joins returned ROM-font alternatives to map names, then compares only those names' map descriptor images. The added fallback supplies that existing join when WebGPU is unavailable. It does not add a map-ID oracle or search unrelated maps.

Open `map-recognize.html` from the main page’s **マップ画像アキネイター** link. The separate page reuses the existing map browser and video/camera panel, without its AT/field/monster panels. Use a local NDS and video/camera input. After WebGPU text matching reports unavailable, choose **現在の1フレームをCPU照合（低速）**. Each click captures the current frame anew, then freezes the analysis frame and uses its separate **CPU一回の上限 ms** value, up to 10,000 ms. It does not change the continuous GPU loop's separately configured time limit (default 1,500 ms). A short limit may leave all or some text hypotheses unsearched. Increase the limit and explicitly retry when needed. **固定を解除** resumes observations; source, seek, ROM, reference, or text-setting changes also release/cancel the old capture. The local video is paused for this one-frame action; a camera's live preview can continue, while the analysis preview remains fixed.

One disposable Worker receives bounded ROM glyph rows and one cropped name image. The host snapshots inputs before initialization, validates the returned stamp, and terminates the Worker on cancellation, timeout, or completion. The same deeply frozen capture stamp and captured pixels feed text, candidate-map matching, and party-marker factors. Late results cannot replace a changed source, ROM, reference, or ROI.

The CPU score loop reuses the existing JavaScript-number reference calculation. It is explicitly identified as `cpu-reference`; it does not impersonate WebGPU or claim exhaustive f32 equivalence. High-level font/threshold hypotheses, tie handling, character alternatives, and map-name joins remain shared with the existing path. WebGPU remains the default scorer.

CPU caps are 256×192 name pixels, 4,096 glyphs, 1,048,576 glyph cells/coordinates, 32 characters, eight alternatives, six scales, two million candidate evaluations, and at most ten seconds per explicit job. Metadata is projected to bounded fields before transfer. The one-shot deadline covers layout waiting and Worker initialization; canceled layout waits detach immediately and discard late replies. The host also checks elapsed time when receiving a result, rather than trusting timer-task ordering; worker batches also check their remaining deadline. A watchdog stop returns an unresolved result with unknown evaluation coverage. No winner is selected from an unfinished candidate pass.

CPU text remains provisional. An unsearched-text/map alternative is retained through image matching, so an image can lead within the nominated set without setting `mapIdentityResolved`. Shared image descriptors keep all map IDs. Missing descriptors and skipped references stay unknown. Scores are not probabilities; this does not certify the current map, world coordinates, a birth event, or AT consumption.

Portable checks:

- `node scripts/test-font-akinator-cpu.mjs`
- `node scripts/test-font-akinator-cpu-client.mjs`
- `node --experimental-vm-modules scripts/check-video-panel-capture.mjs`

Optional local fixture check (never bundle the inputs):

`node scripts/test-map-cpu-fixtures.mjs user.nds glyphs-private.json sanmarou-fixture-directory`

The existing 75/80/255/265-second Sanmarou samples retain their original font-nominated sets and favor 7901/7902/7905/7906 respectively. They were rerun through actual Node CPU Workers and the existing WASM image matcher. All four keep the unsearched-text unknown and `mapIdentityResolved:false`. Total runtime in this environment was about 6.8–7.6 seconds at the explicit ten-second setting; this is a slow static check, not a frame-rate guarantee. These existing fixtures do not certify unseen house interiors or recognition accuracy generally. Same-name/shared-house alias handling also has a separate synthetic regression.
