# Preserve the first real-frame gap's timing

Baseline: `e70181a8858cf761411f3ffd19b56fc665066941`.

The actual warm run played from PTS 1200 to about 1223.55. It was not a two-second
sample. Its first surviving five image tracks, including the conditional
モーモン candidate, were dropped between retained frames 1200.017 and 1200.533:
0.516 seconds, exceeding the unchanged 0.5-second gate. The decoded callback
interval survived as 530 ms, but later post-pause tasks displaced the relevant
early browser long tasks and most synchronous spans. Surviving individual maxima
and asynchronous background elapsed times do not identify the blocker.

## One gap-specific saved record

At the first advancing gap between currently retained real frames that exceeds
the existing limit, replay now owns one copy of the existing bounded timing
ledger. Exact source ID, source epoch, timeline segment, source PTS, sampled-RGBA
hashes and frame keys bind its two frames. No intermediate frame is invented.

The performance window uses actual frame-retention events after pixel hashing.
It is explicitly distinct from decoded-callback delivery timestamps. A late
real frame may fill a provisional retention gap. The saved record therefore
does not claim a replay loss until the exact same pair causes an existing
gap-rejection loss; its first matching loss and match count are separate fields.

Completed browser long tasks are drained with `PerformanceObserver.takeRecords`
when the snapshot is captured and when it is downloaded. Delayed observer
deliveries may append only tasks overlapping the original performance window.
At most 16 are retained. Monotonic timing-record sequences deduplicate entries;
overflow is counted without an unbounded set. Tasks outside the window are not
appended. The saved ledger itself never changes.

Attribution distinguishes observed overlapping long tasks, no overlapping task
recorded (which is not proof of absence), and unavailable observer/snapshot
evidence. Long Tasks API records do not identify a source function. A currently
unfinished task may be unavailable at export.

## Storage and lifecycle

- One saved ledger, with the existing 64 recent / 16-per-kind longest / 32-stage
  limits, plus at most 16 overlapping long-task records.
- No additional pixels or frame history; only scalar timing/frame identity.
- The large record appears only as `firstRetainedFrameGapTiming` in the existing
  explicit comparison download. Live preview and observation ownership clones
  do not receive it.
- Source/reset clears the saved record and its single delayed-delivery receiver.
- Clock, snapshot, watch, flush and disposal failures cannot interrupt frame
  retention, scheduling, reset or the existing tracking rejection.

Ten new tests cover exact binding, completed and delayed delivery, bounded
dedup/drop counts, immutable owned snapshots, exact replay linkage, a later real
frame filling a provisional gap, reset, unavailable attribution and diagnostic
failures. Existing timing and camera-evidence tests also pass.

This change preserves a missing measurement. It changes no recognition output,
threshold, radius, frame-gap limit, capture cadence, queue, timer or yield policy.
It does not establish the synchronous cause or fix continuous tracking.
