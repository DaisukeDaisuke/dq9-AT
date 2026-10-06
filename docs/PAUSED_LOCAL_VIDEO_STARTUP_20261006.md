# Paused local-file startup readiness

Baseline: `760a42c68b805635224eda59a136ceb5cf55c281`.

## Exact prior failure

The retained actual first-failure pair reproduced the browser registration
exactly: PTS 1200 to 1200.267, dx −16, dy −2, residual
9.318706697459584, texture 5.811418685121107. The only failed global gate was the
existing horizontal search boundary. Two of the 32 local patches passed
bidirectional correspondence; they cannot bypass the global camera gate.

The existing Start path called `video.play()` before fixed-frame/background
preparation. Fast capture obtained layout only from the asynchronously prepared
frozen record. The first offer lacked layout; the first retained later frame was
PTS 1200.267. The trace does not prove every intervening task's source function,
and these missing frames cannot be reconstructed by changing initialization.

## Bounded change

For an already-decoded, paused local file with its ROM ready, the automatic Start
button now holds the existing paused playback state while running the existing
fixed-frame/background preparation. It does not seek, change playback rate, or
create intermediate frames. The supported layout comes from the existing
`inferPairedVideoLayout` decoded-dimension contract, without waiting for a frozen
record and without adding a new layout guess.

The existing real fast capture/readback gate is primed at that paused frame.
Before requesting playback, startup checks that the frozen frame has a bound
pixel timestamp and its exact tracking frame key remains retained and
unconflicted. The source ID, source epoch, timeline segment, activation epoch,
paused playback clock, and frozen-frame identity must remain current.

The wait ends after the existing initial frame/background attempt. It does not
wait for a positive enemy classification, map identity, native identity, or
completed ongoing recognition. Unknown-map and no-enemy outcomes can proceed
when the real frame is retained. An unavailable/unbound frame cannot satisfy
readiness. A browser rejection of the later play request is reported; no new
permissions or autoplay policy exceptions are assumed.

Already-playing, not-yet-decoded, and ROM-not-ready entry paths retain their
existing immediate playback behavior. Native video Play retains its existing
workflow. Stop, pause, source replacement, seeking, media error/abort/unload, and
page exit invalidate pending automatic resume. A second Start supersedes the old
resume and can reuse the same valid in-flight preparation. Only the latest
current request may play, once.

Only scalar readiness identity is retained after preparation; this is not an
extra frame/pixel queue. Existing capture identity guards, 0.1-second capture
budget, 0.5-second gap acceptance limit, translation radius, scores, thresholds,
and missing-observation rules remain unchanged.

## Verification and limits

Twelve startup-coordinator tests and eleven production-panel VM tests cover
paused preparation, exact retained-frame gating, no-enemy/unknown-map progress,
latest-Start behavior, lifecycle invalidation, play errors, and unchanged other
entry paths. The VM uses synthetic pixels/capture binding and a fake video/DOM;
it does not measure real decoder timing or prove native/browser correspondence.

This change targets exposure to cold startup work before the first measured
pair. It is startup readiness, not continuous-recognition completion. Actual
browser playback must still measure the new first retained pair and subsequent
gaps. No radius relaxation or camera-continuity assumption is introduced.
