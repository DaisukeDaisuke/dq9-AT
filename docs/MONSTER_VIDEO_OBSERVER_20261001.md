# Bounded opt-in video observations

This is an observation/debugging flow, not reliable enemy acceptance or AT-ready recognition. The fixed/manual controls remain available. Nothing starts automatically.

## Evidence first

The final prerecorded check submitted 84 video frames across four short replays and completed 30 selected-crop observations. A post-result visual audit found **5 clear body-containing crops, 23 background/UI crops and 2 ambiguous edge crops**. Some bodies are partial; the same recording/window is replayed twice. These counts are developmental workload evidence, not independent precision/recall, native entity counts or calibrated identity accuracy.

Background crops can rank one of the four models first. Every observation therefore retains unknown, all species candidates associated with a model, its exact crop and original video timestamp. No rank is attached to a newer box. Missing proposals are unobserved, not proof of absence or despawn. No birth, native identity, world position, RNG state, AT draw or hard pruning is certified.

## How the opt-in flow works

The page requires an explicitly selected shrine-blue-v1 field/gameplay region, central exclusion, DINOv2, quick/_f and the four initial models. Start explicitly plays the selected video. The source is capped at 2,097,152 pixels (1920×1080 fits); the gameplay region must be exact 4:3 with each side at most 1024 pixels.

- CPU proposals sample new decoded frames at most every250ms. Repeated frames and missed ticks are not queued
- The existing tracker supplies tentative screen-space associations only. Static candidates are eligible; camera registration failures reset associations
- There is one active inference cycle and one replaceable latest snapshot, with no pending crop queue
- The existing genuine64-pose preparation runs before query classification. CPU positions can update during it, but only the newest snapshot is queried afterward; there is no dummy query
- One crop is classified per cycle, at most every500ms. The same tentative current track has a5-second refresh cooldown. Fair selection and a global rate cap survive tracker churn
- Optional DINO supplementation has a3-second minimum interval, skips a full8-CPU-candidate budget, and requires a completed CPU crop after each dense cycle before another dense cycle. Its same-frame crop is scored only while that dense snapshot is no more than1.5seconds old; otherwise it is discarded and CPU classification gets the next opportunity

These numbers schedule workload. They are not learned/tuned accuracy thresholds and do not reject background.

The live canvas contains only unverified current CPU positions. A separate list retains at most four historical crop/rank records with original coordinates, timestamps and ages. Thumbnails are reduced to at most96×96; full-frame history is not retained. A500ms display-only timer advances age during buffering; position boxes older than1second hide. This timer performs no inference.

## Ownership and interruptions

The observer reuses the current proposal code, tracker, Worker, classifier, ROM renderer and cache identities. Engine/backend/default classification code is unchanged. The Worker exposes preparation metadata, never sends the64-vector bank to the page, and retains its normal loaded runtime between ordinary ticks.

Snapshots and crop stamps are immutable across asynchronous work. Result authenticity is checked against its dispatched capture, not the newest CPU frame. Since rankings are historical records rather than labels on current boxes, an association gap cannot transfer a species claim to another box.

Seek, source/ROM/configuration changes, Stop/Cancel, pause/end, hidden tab and page lifecycle events invalidate work. Deferred video.play() has a separate cancelable start intent. Late success, rejection, progress or finally callbacks cannot restart a stopped loop or clear a newer job. Returning to a visible tab enables an explicit Start; it does not restart automatically. Manual actions stop the observer before using the shared worker.

## Known HUD mismatch

The profile masks the native256×192 rectangle x212,y0,w44,h39, equivalent to x795,y0,w165,h147 in a960×720 gameplay crop. In an older reviewed recording, command text is actually around crop x720–863,y262–315, with its pointer above it. Full-frame inspection confirms that the gameplay panel itself is correctly selected; this is an in-game HUD placement mismatch. Some other frames also contain lower-screen dialogue/text not covered by that command mask.

Current controls can correct a wrong gameplay panel selection. They expose gameplay bounds and the central exclusion, but no independent editable HUD rectangle. Moving/reducing the gameplay crop merely to move the HUD mask would discard or misdescribe game content, alter the center mask and change the dense grid. It is not an honest correction for this example. Evaluation masks were not changed. A separately declared per-video HUD exclusion could be a future configuration feature, but is not implemented here.

## Verification and cost

-24 controller tests: slow inference/latest-only, stationary fairness, global budget under tracker churn, source/crop ownership, stale requests, dense bounds, and combined slow dense/crop behavior
-152 page/lifecycle checks, retaining the128 prior fixed-frame checks, with deferred-play interrupts, visibility return, stale startup failures and buffering ages
-Independent reviewer reproduced three defects (dense starvation, hidden-return controls, deferred-play seek race), verified their fixes, and additionally exercised stale successful play and the timer fallback
-Actual current Worker/ROM/ORT-Web WASM runs on a separate Node thread; current source-frame crop bytes were checked before every transfer. Live snapshot/history bounds and maximum concurrent Worker requests of1 were asserted

The final replay sampled80 of84 supplied frames and completed30 classifications plus2 dense passes. Warm median classifier time was726ms; median completed observation age was904ms, maximum1.79s. Initial genuine pose preparation took30.9seconds before replay. Input frames were already decoded and supplied every270ms; this is a Node DOM/canvas acceptance harness, not actual-browser video decode or WebGPU timing. Scheduling and shared CPU load change which transient bodies are sampled between runs.

Actual cloud browser/GPU QA and the parent aggregate build remain separate release gates. No new model, training, external inference, frame persistence or publication of ROM/video/model assets is part of this source change. The rejected temporal propagation experiment remains separate and stopped.
