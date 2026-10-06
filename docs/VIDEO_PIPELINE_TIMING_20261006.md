# Bounded video/background timing diagnostics

Baseline: `a0bf408712e9a4288fb7080a46a30430340bf992`.

The latest actual moving-video observation retained 73 pixel frames and replayed
69 measured steps, from a background at PTS 1215.817 through PTS 1233.9. Its
recorded missing-observation gaps still stopped continuity. The earlier lazy
display change reduced the completed summary to 18 DOM nodes, but did not fix
those gaps. No source function is yet established as their browser-time cause.

## Where measurements appear

Use the existing automatic playback workflow and existing comparison/timeline
download buttons. Both JSON downloads now contain `videoPipelineTiming`.
No additional files, parameters, or manual timing controls are required.
Pausing the video preserves measurements. The existing stop/source-reset
semantics are unchanged; replacing/seeking the source resets the diagnostic run.

The ledger retains:

- The most recent 64 spans.
- The longest 16 spans for each of four timing kinds, at most 64 total.
- Count, total, and maximum span for at most 32 named stages.
- One last callback and one callback-boundary record.

Stored fields are scalar timings and source/frame identity only. No pixel buffers,
classification graphs, or additional frame history are retained by the ledger.
The observations, full classification exports, and ordinary timeline snapshots
do not contain copies of this ledger. It is added at comparison/timeline download.

## Interpreting the clock

`startedAtMs` and `endedAtMs` use this page's performance clock. `timeOrigin`
identifies that clock. Original `sourcePTS` and callback PTS deltas are retained
without retiming or imputing any missing frame.

- `synchronous-span`: time spent inside an instrumented synchronous call. Nested
  spans overlap; summing their totals double-counts work. A consumer/prologue
  span ends when the call returns its original Promise, without awaiting it.
- `async-elapsed-not-CPU-time`: time across an existing async operation. Includes
  waits and unrelated work; it is not CPU usage or a blocking duration.
- `callback-interval-not-CPU-time`: time between delivered decoded callbacks,
  including original PTS and presented-frame deltas. Pause and source/clock
  boundaries break this comparison. This does not identify the reason for a gap.
- `browser-main-thread-long-task`: page-wide browser Long Tasks API evidence,
  when supported. It has no inferred source PTS or source-function attribution.
  Its availability is explicit in `observerStatus`.

The existing background renderer also records at most four phase intervals in
`automaticBackgroundPipeline.performanceSpans`: adapter wait, source preparation,
GPU render/readback/decode, and CPU fallback. They are elapsed intervals, not CPU
durations. Their performance clock matches the ledger when using the default
browser clock.

Correlate callback gaps with overlapping synchronous spans and browser long
tasks. Async background phase overlap can narrow an investigation but cannot by
itself prove that phase blocked the main thread.

## Covered stages and unchanged behavior

Synchronous measurements cover fast/slow capture draw and readback, gameplay
sampling, slow source copy/layout inference, residual comparison/annotation,
replay patch correspondence and existing tracker calls, classification job and
completed-frame copies, timeline/observation ownership clones, classification
display, and the initial observation-consumer call. Hash/background waits are
separately labeled elapsed intervals.

There are no new timers, worker lanes, queues, yields, or await boundaries.
Timing wrappers return the original value or Promise and rethrow original errors.
The existing cooperative replay budget, 0.5-second gap gate, scores, thresholds,
frame identities, cancellation rules, and missing-observation handling remain.
Timing itself has a small bounded execution cost and is diagnostic evidence,
not a claim that capture latency or continuous tracking has been fixed.

Ten focused regressions cover bounds, lifecycle and stale records, unavailable
browser timing support, exact timeline/bundle preservation, identical fast
capture pixels/evidence, preserved replay results/gap rejection, background phase
labels, and absence of new scheduling boundaries.
