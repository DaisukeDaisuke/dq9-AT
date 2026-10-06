# Observation snapshot ownership candidate

Task: 274baea8-e2e9-4943-bb4a-b2eb1a8af933
Baseline: integrate-startup-prime-4273d135, published e70181a8858cf761411f3ffd19b56fc665066941.

## Result and scope

The supplied warm capture ledger measured observation-bundle-clone at up to 148.7 ms and observation-consumer-prologue at up to 276.2 ms. The saved timeline is 17,666,215 compact JSON bytes. Its standalone native clone and unchanged production-policy traversal reproduced material costs in Node. The candidate removes the second whole-graph copy only for an explicitly detached, immutable internal bundle. It does not change recognition, AT predicates, thresholds, input guards, unknown alternatives, captured pixels or timing instrumentation.

The benchmark uses the actual downloaded timeline and latest retained sightings, the production residual envelope producer and comparison metadata. The original callback envelope was not saved, so it is a reconstructed 32,874,060-byte envelope, not a claim to replay the original browser heap. Its background hash comes from the saved sighting ID; no runtime/DST/RAM input is used. Full private input data is excluded from this deliverable.

Final alternating Node v24.19.0 profile:

- Producer clone + unchanged input guard + consumer copy, median of 10 measured runs per variant after two warmups: 670.931 ms before, 510.960 ms after.
- Producer-only median: 227.701 ms before, 399.113 ms after. Freezing increases this substage.
- Consumer copy median: 255.332 ms before, 0.030 ms after.
- Actual paired snapshotBundle → observe synchronous span, median of five measured runs per variant after one warmup: 664.156 ms before, 502.104 ms after, a 24.4% reduction. Maximum among those samples: 709.461 ms before, 586.077 ms after.
- Real preparation runs produced identical full controller outputs, prepared request, complete observation identity, checkpoint key, gate, automatic event fields and native/replay companions. The actual fixture exercises two legacy conditional singletons. A separate synthetic focused case exercises camera validation and appended camera singleton production.
- Real prepareTrackingJob used the same checked-in enc.json.main as preview. AT search workers were deliberately not launched. No browser measurement or continuous-recognition completion is claimed.

These spans remain long. This result neither identifies nor claims to fix the initial 0.516-second callback gap.

## Why moving cost earlier does not add a new blocking task

All four existing map-video-comparison.mjs call sites (baseline lines 81, 86, 217 and 222) call snapshotBundle immediately followed by timing.sync(onObservationBundle), with no await or task scheduling between them. preview.mjs line 39 directly maps that callback to trackingAT.observe(bundle). observe performs production validation and snapshot copying before its first await of searchAutomaticReplayInputs. The replaced producer and consumer operations are therefore in the same preexisting uninterrupted synchronous span. No scheduling boundary was added or removed. A resolved promise/microtask also does not guarantee a browser capture opportunity; later event derivation/preparation work still exists.

## Ownership contract

The existing opt-in unaliasedResidualEnvelope path already clones the producer graph. The new helper keeps that native structuredClone, inspects its detached result, freezes every node only if the entire graph is plain objects/arrays, and records its identity in a module-private WeakSet. No data property, serialized field or hash marker is added. AT can then create a writable root while sharing immutable nested evidence. Its three newly generated top-level companion fields remain writable.

Generic callers and unfreezable graphs keep the old complete native clone. The preflight returns before any freezing for ArrayBuffer, typed views, Map, Set, Date, RegExp and other non-plain objects. Root back-references also fall back so the new AT root cannot break cycle identity. Internal cycles and aliases in plain nested graphs are preserved. Metadata and Object.isFrozen alone never authorize sharing. Source objects are detached before freezing; production guards still run at the exact observe and prepare boundaries. A retry of the privately augmented AT snapshot takes the generic native-copy path.

The explicit internal callback's plain completed bundle is now immutable, so a new future consumer must not mutate its nested data. The existing inspected consumers already satisfy that contract.

## Downstream read/write review

- video-replay-factor-search: mines new frame/position/entry records; cloned outputs own later search mutations.
- map-hypothesis-provenance: constructs fresh Maps, arrays and provenance records; does not mutate frame inputs.
- tracking-at-event-evidence: collectTrackingSightings clones sighting/plan/map rows before grouping; automatic event outputs are newly allocated.
- conditional-body-map-compatibility and encounter-model-candidates: read source/plan inputs; return cloned/new records.
- video-tracking-at validatedCameraComparisons and monster-camera-body-alternative: input rankings and claims are only read; sort operations use filtered/copied arrays and comparison rows are fresh.
- tracking-camera-body-alternative: collects cloned sighting rows; appendCameraBodySingletonAlternatives clones existing/new events.
- tracking-native-body-support and tracking-native-motion: emit fresh summaries, clone owned graph/bundle subset before retaining an index.
- tracking-at-observation-adapter / at-observation-compiler: clone sightings/branches and construct requests; nested original observation data is not written.
- tracking-at-session prepareTrackingJob: guards, reads, compiles and fingerprints input; generated job companions own their copies.
- tracking-at-runner fingerprint: builds a normalized copy and sorts new key arrays; startTrackingSession posts generated request/identity rather than mutating the observation.
- Controller retry, supersession and cancellation retain epoch checks. Focused tests cover cancellation from synchronous notification, concurrent replacement, pending session cancellation on retry and final companion isolation.

## Verification

Passed: eight focused ownership cases (shared aliases/internal cycles/NaN/undefined/negative zero/BigInt/holes, built-in fallback and typed-buffer aliasing, unsupported input rejection and getter semantics, timeline detachment/generic aliases, prohibited production provenance, cancellation/replacement, pending session retry and camera singleton path).

Passed existing checks: test-video-pipeline-timing.mjs, test-at-session.mjs, and check-video-panel-capture.mjs (Node fake DOM/Worker capture control-flow harness). These do not claim real browser/decoder parity. The standard aggregate build is intentionally reserved for the parent's combined integration because its compiler outputs are shared.

Run the focused test:

    node --test scripts/test-observation-bundle-ownership.mjs

Reproduce the private-input profile from the candidate source directory:

    node --expose-gc scripts/profile-observation-bundle-ownership.mjs BASELINE_SOURCE TIMELINE_JSON COMPARISON_JSON OUTPUT_JSON

## Integration

Five source files are in source/ with a source-only patch and SHA-256 manifest. No browser, map-video-comparison or video-pipeline-timing file was edited. Update cache versions for consumers of video-observation-timeline and video-tracking-at during combined deployment; both changed modules import the same versioned ownership-helper URL. Add the focused ownership test to the combined standard suite if desired.

Separate measured-next-step candidate, not implemented: compileTrackingObservations always returns bundleSnapshot:copy(bundle), but prepareTrackingJob never reads that field. A separately profiled opt-out preserving the default compiler API could remove another copy; this patch does not change it.
