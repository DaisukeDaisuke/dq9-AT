# Targeted map-input timing for the first retained frame gap

The private 8d011 GPU-entry replay retains an exact 1200.017 → 1200.567 frame gap. Its decoded callback interval is 551.4 ms (presented-frame delta 33). The pinned retention clock window is 60517.8 → 61038.4 ms, after pixel hashes. These are different boundaries.

A page long task runs 60476.2 → 61019.2 ms (543 ms). It overlaps 541.7 ms of the callback interval and 501.4 ms of the retention window. A subsequently delivered 138 ms task (61028.5 → 61166.5) overlaps the retention endpoint. The first exact gap caused five tentative tracks to be dropped; matching replay loss was evaluated twice. The first 17 ms pair remains a measured candidate correspondence, without certified identity.

The existing ledger ends its known synchronous work at a timeline update at 60542.9 ms, then has no source-level attribution until replay resumes at 61019.7 ms. It establishes main-thread blocking but does not identify that remaining source function. The GPU entry did not connect the AT consumer, so its timings cannot validate AT-consumer copy savings. Earlier main-entry warm data has a 530 ms callback interval with relevant long-task attribution evicted; cross-entry timing differences are not an optimization result.

## Additional source spans

Reuse the existing `VideoPipelineTiming` ledger, its unchanged 64-recent / 16-longest-per-kind / 32-stage limits, and its already-pinned first-gap export. One fixed `map-input-synchronous` stage adds scalar phase / ROM record key / descriptor labels:

- `render-from-name-prologue`: clearView and immediate status update before the existing animation-frame await
- `continuity-call-prologue`: only the initial synchronous execution of the async probe call, until its first await; this is not total async elapsed
- `continuity-eligibility`, `continuity-scene`: each candidate's gate and source-scene access
- `descriptor-decode`: compose/cache lookup for each actual source minimap
- `upper-marker-preparation`: existing upper-screen sample, HUD-marker calibration and half-resolution conversion
- `minimap-registration`: reference upload and the unchanged bounded coarse/dense matching policy
- `marker-world-floor-queries`: all existing marker/registration-peak world-coordinate and floor queries for that descriptor
- `map-name-display`: existing candidate JSON serialization and DOM update

Nested prologue and descriptor spans must not be summed. Browser layout/paint and other uninstrumented source work may still be outside these spans. The collector returns exact values and Promise identities and rethrows original source errors. Optional clock/record failures are ignored. Reset/disconnect generation guards prevent stale frame hooks entering a new session.

Both main and GPU entry paths use the same transient measurement hook, preserving each path's current clearView behavior. Hooks are not added to frame evidence, hashes, map evidence or observation payloads. No await, timer, yield, cache policy, threshold, radius, capture scheduling, source output, or recognition decision is changed.

Focused tests check descriptor output and call/microtask-order parity, preserved errors/cancellation, diagnostic failure isolation, bounds and both entry-point wiring. Final combined standard build and actual replay are owned by the integrating task.
