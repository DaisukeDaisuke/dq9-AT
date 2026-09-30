# Video/ROM-font pipeline — 2026-09-30

Actual dictionary construction now records434 templates for99 distinct names (277792 coordinate bytes,10416 metadata bytes). This is not all-map name coverage. Video candidate changes and input gaps are connected to ATSession persistence as `video-observation` events with minimumProvenCalls0. Their arrival does not advance the proven or conditional bound. The UI displays the latest40 events while session export retains the full history.

## Sources actually reused
- `vendor/nds-font-converter/nds-font-converter/js/constants.js`, `font-parser.js`, `ttf-writer.js` copied into `web/vendor/font/`. GP2_TARGETS.romPath/outputPrefix are retained. NDS source is already loaded by MapProject; no second upload, server upload, bundled glyph bitmap or font binary.
- `font_akinator_webgpu.html`: getGPU, WGSL prefix-sum raster scorer, makeBuffer, maskInfo, buildPrefix extracted by `scripts/vendor-font-kernel.mjs`; source SHA256 recorded in the output. Pixel-square scoring is unchanged. Map-name dictionary composes actual ROM glyph rows into whole-name templates and preserves multiple map IDs sharing a name. Character spacing0/1 are explicit candidate hypotheses; native DS pixel scale1 is the current normalized-preview assumption.
- `BattleArrow/BattleEmulator/public/vision.js`: camera enumeration/OBS preference, getUserMedia, requestVideoFrameCallback with RAF fallback, non-overlapping async frame processing adapted into `camera-input.mjs`. Battle-only UI/pre-extracted vision packs are not reused.

## Product path
NDS drop -> map/graph metadata -> NDSフォント生成 -> ROM-local font/glyph generation in existing Worker -> FontFace memory + GPU dictionary. Camera selection -> source-region drag -> native256x192 upper preview -> name-region drag -> thresholded white glyph matcher -> top5 named map candidates. Unknown content/uncalibrated confidence remains explicit. Clicking a single-ID candidate changes only the manual map browser, never a proven gameplay state or AT lower bound. Map/area position are separate fields and remain unresolved by name alone.

Camera processing defaults to500ms, bounds interval250..10000ms, no concurrent frame jobs. Camera stop/end preserves the AT session and records an observation gap. Last1000 recognition metadata changes can be exported as JSON; no captured frames or generated fonts are automatically saved. ROI configuration only is persisted in localStorage.

## Actual confirmation and remaining evidence
`scripts/run-font-mining.mjs` executes the same converter on the actual approved ROM and stores metadata only in `docs/observations/actual-font-mining.json`:503 parsed font sources,10x10=905,12x12=1441,8x7=80,8x8=162, four in-memory TTF files. No generated font files were retained. GPU/browser camera recognition accuracy has NOT been measured in this task; the UI calls them candidates, not recognized truth. No new synthetic tests or browser test suite were created.

Next concrete gaps: actual video ROI/threshold/font spacing calibration, map scrolling/self-position estimator, 3D model extraction and low-rate monster matcher, and qualified evidence rules connecting visual events to proven AT minimum increments. Do not substitute the RAM research graph for actual video position. Do not draw an optimized human route on the enemy graph without player-walkability and field-scheduler evidence.
