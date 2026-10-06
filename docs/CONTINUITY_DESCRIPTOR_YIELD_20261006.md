# Yield at the existing continuity descriptor boundary

The actual main-entry c2ae8 replay keeps the initial PTS 1200 and 1200.017 full/gameplay hashes, complete raw-region arrays, observed tracking rows, selected background coordinates/alignment/statistics, and original region 58 background digest identical to b0b39. Its callback interval from 1200.017 to 1200.35 is 347.1 ms, versus 504.7 ms ending at 1200.517 previously. This is a single observed run, not a controlled benchmark. Early per-descriptor preparation/reuse rows were evicted, so their exact count/durations cannot be certified from the export.

Track-5-2 still has only the initial 17 ms candidate association. A retained reseed replay explicitly loses it at 1200.017→1200.35 through `patch-registration-outside-existing-gates`. Original batch 1 loss sequence 2 was evicted; it must not be presented as retained. The first >0.5-second gap at 1239.433→1240.467 has no matched track-loss record because tracks are already empty. No sustained identity or tracking success follows from that later first gap.

## Measured producer

At PTS 1239.433, four synchronous minimap registrations take 303.7,275.3,287.6 and 273.2 ms, totaling 1139.8 ms inside a 1204 ms browser main-thread task. The surviving upper preparation reuse spans take 0.2–0.3 ms. Failed revalidation details were not saved into the timeline after no candidate survived, so the precise internal coarse/dense outcome is unavailable; the synchronous durations are directly recorded.

`VideoMapContinuity.probe` awaited `resolveVideoMinimapCandidates` with its default already-resolved async candidate callback. Those awaits permit microtasks, not another capture/input task. Four independent registrations therefore ran in one browser task.

## Minimal scheduling change

The probe now supplies a real `setTimeout(...,0)` Promise at the existing `onCandidate` boundary. No descriptor is skipped, reordered, merged or accepted differently. Each existing matcher invocation still starts its own unchanged 1500 ms  deadline; no inner registration loop, radius, threshold or gap gate changes. The generic resolver retains its existing default callback behavior.

The resolver checks `isCurrent` before each next descriptor and after the final candidate callback. Cancellation/source replacement during the task yield therefore prevents stale continuation and completed reuse results. A probe continues to hold only its own frozen source and private upper preparation while awaiting, with no cross-request or source retention.

Five focused tests verify a real queued capture task runs between descriptor calls, unchanged candidate outputs and independent 1500 ms  call budgets, cancellation after the first or last descriptor, source epoch replacement, and unchanged standalone resolver scheduling. Relevant timing/reuse/startup/replay checks are also rerun. Root owns the final combined standard build and actual browser replay; no browser capture-continuity improvement is claimed yet.
