# Experimental shrine position proposals

This module supplies up to8 class-agnostic-in-species ROI suggestions to the existing monster classifier. It does not replace DINO, its pose bank, cache, backend selection, capture identity or ranked/unknown result semantics. The existing `monster-recognize.html` page exposes it through an unchecked, opt-in shrine experiment control; publication and actual browser verification are separate release steps.

`proposeEnemyROIs(image,captureStamp,{profile:'shrine-blue-v1'})` requires a declared4:3 field region. It uses deterministic256×192 sampling, a scene-specific chroma cue, connected components and local-edge ranking. Camera background pixels can move; no fixed background frame or object-motion requirement is used. A rough y-dependent size floor is not a calibrated world projection.

Hero and command-HUD exclusions remain unobserved. Morphological dilation cannot enter exclusions; only synthetic padding is trimmed when the measured foreground core stays outside. A component or body overlapping an exclusion is never evidence of enemy absence. Still-image captures use the existing `local-image` stamp and do not receive invented video time.

`proposalRecognitionRequest` crops original frozen pixels into the current recognition request schema. Pass through the selected ROM epoch, candidate models and explicit inference backend, then use the existing recognition client and stale-result gate. No filled mask image is classified. Proposed regions are unverified; classifier scores still retain unknown and species aliases.

Development evidence:the four fixed metal/spirit/knight/mummy target ROIs satisfy at least75%body-box coverage with bounded crop area, and the unchanged current classifier ranks all4 expected families first. The five frames, including one negative, produce2/2/7/1/4 ROIs. A distinct recording is weaker:11/18 target boxes covered (11/17 outside the center mask), including only2/7 knights and2/4 metals. Warm wall/torch merges and low-contrast bodies remain failures. Neither set establishes universal detection or calibrated background rejection.

Proposal CPU time and classification time must be reported separately. In one Node test, warm CPU proposals take median3.71ms, while all16 DINO/WASM crop jobs take43.33s including cold pose generation;15 warm jobs total13.79s. These are not browser/WebGPU measurements. The backend code and pose caches are unchanged; actual WebGPU batch timing is a separate verification.

Tentative image-space tracks reset on source/time changes and uncertain camera registration. A missed observation is unobserved, not a despawn; a first sighting is not a birth. ROI bottom-center is not a measured foot or world coordinate. No AT draw, native entity identity or safe AT pruning is certified. Private ROM/video/images/features/models are not included with this source.

## Opt-in frozen-frame flow

1. Load the owned NDS and a local video/image; freeze the desired frame
2. Explicitly select field scene, the4:3 gameplay region and central exclusion
3. Enable the shrine-blue-v1 experiment, then request candidates for this frozen image
4. Select one of at most8 numbered candidate buttons, review its crop, and use the existing compare button. Keep the chosen DINO/WebGPU backend and existing pose cache

No generation or classification runs automatically during playback. Manual ROI editing remains available. New captures, source/ROM replacement and scene/layout/mask edits clear old candidate sets; backend changes retain geometry but still invalidate old classifier work. An obsolete candidate button cannot change a newer capture. Oversized source-space candidates stay visibly unprocessed and cannot allocate a crop beyond the existing1024×1024 classifier limit. Source snapshots and internal tracker rectangles are owned copies.

The new UI has110 Node DOM/lifecycle checks; the core has25 checks. An actual-RGB mounted-UI harness generated candidates, selected the four target crops, verified their byte hashes and ran the unchanged WASM classifier:4/4 expected first ranks, with unknown retained. That harness is not an actual browser or WebGPU test.
