# Call-local upper-screen preparation reuse

## Actual source evidence

The main-entry b 0b 39 replay ran from PTS 1200 to 1275.234831. Its first retained gap above the unchanged 0.5-second limit is 1203.417→1204.067 (0.65 seconds), not the initial playing pair. A 654 ms browser main-thread task at 96937.1→97591.1 overlaps the exact 656 ms decoded-callback interval. Within that task, four upper-marker preparations for one frozen frame take 60.7,79.5,82.2 and 72.5 ms, totaling 294.9 ms. Registration takes 61.6 ms and floor queries 51.5 ms. The 96.3 ms continuity prologue nests the first descriptor and must not be added. Other work remains unattributed; this change does not explain the entire task.

The original region 58 at(217,54,14,24), whose classification includes the モーモン model candidate, retains tentative track-5-2 at 1200.017. It is lost at 1200.017→1200.517 by `patch-registration-outside-existing-gates`, at exactly the existing 0.5-second accepted time limit. That is earlier than the pinned 0.65-second gap. The surviving ledger also retains its 504.7 ms decoded-callback interval and all four same-frame upper-preparation spans (67.1, 55.3, 62.9 and 56.6 ms, totaling 241.9 ms) inside it. This attributes part of that earlier interval to the same repeated work without claiming the complete cause of the local patch rejection. The subsequent 1200.517→1200.667 camera registration rejects the horizontal search boundary and drops the remaining two tracks. Later reseeds do not establish continuity back to track-5-2. Identity, birth and AT remain uncertified.

## Narrow correction

`upperVideoROI`, `sampleGameplayFrame`, `calibratedPartyMarkerCandidates` and `halfFrame` depend on the same frozen source image and layout, not the candidate map, descriptor, registration or floor. `VideoMapContinuity.probe` now creates one opaque preparation handle local to that probe. It is shared across that probe's descriptor/eligible-record calls, then becomes unreachable. There is no persistent or cross-frame pixel cache.

The private WeakMap entry binds exact source-image object, RGBA object, dimensions, layout, frame-evidence object, source ID, epoch, segment, serial, timestamp basis, PTS and full pixel hash. A forged or JSON-copied handle, replaced input or changed binding receives the ordinary fresh calculation. These are fixed captured pixels; the pipeline does not mutate their contents during a probe. Compatibility with generic callers that mutate RGBA contents in place without a corresponding stamp update is not established and is outside this frozen-input reuse contract.

Canonical prepared pixels and marker evidence remain private. Every descriptor gets a deep owned copy, preserving prior mutation boundaries, including matcher input. Registration, world-coordinate/floor queries, candidate order, aliases, thresholds, budgets, errors and cancellation checks all still run. No new await, timer or yield is added. Standalone callers without a valid handle retain their original preparation path. The handle does not enter outputs, hashed evidence, timeline exports or prevalidated map records.

The existing timing ledger distinguishes actual `upper-marker-preparation` from `upper-marker-preparation-reuse` (the owned copy). This remains one bounded timing stage and uses existing frame/descriptor identity.

## Checks and limits

Six focused tests cover exact output parity across four map/descriptor consumers, independent output ownership and matcher mutations, forged/serialized handles, replaced pixels and changed frame bindings, negative registration/error paths and one-probe lifetime. Existing timing, replay, startup and minimap checks are rerun.

A private Node microbenchmark uses video-derived FFmpeg RGBA and actual ROM minimaps/floors/WASM. All non-timing output fields match the baseline across 12 four-descriptor runs; only registration's measured elapsed time is excluded from equality. After the first pair of warmup runs, mean total time is 126.1 ms baseline and 82.9 ms reused; upper preparation/copies are 61.9 ms and 19.6 ms. FFmpeg output is not certified identical to retained browser Canvas pixels or source PTS. This is source-level performance evidence, not proof of improved browser capture continuity. The next actual main-entry replay is required.
