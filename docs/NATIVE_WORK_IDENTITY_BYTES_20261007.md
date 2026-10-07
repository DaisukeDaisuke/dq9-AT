# Bind retained native views without per-index JSON expansion

Baseline:544bb7ac0ba5115ee400cdb7fbfed94449a81004. Task UUID:0e92f8b9-c2b6-4a01-bf8d-903bd605889d.

## Demonstrated cost

The mode1 destination handoff removed repeated source raster work, but nativeWorkIdentity JSON-stringified the complete backgroundEvidence. Every retained typed plane became a decimal-keyed JSON object. That work occurs after the1500ms native slice timer starts, before source setup and any proposal attempt.

The same125.846 source request was reconstructed from the formal ROM, fixed replay, and the new browser run's own appearance hints/frame binding. Without handoff planes its background JSON is547553 characters; with planes it is23037763 characters. Original full request bytes/planes remain private.

Initial Node measurements preserved separately:

- Fingerprint first observation:12.9ms without planes,280.6ms with planes
- Fingerprint repeats:4.8/7.2ms without planes,185.2/193.8ms with planes
- Request cloning:about1ms without planes and2–3ms with planes
- Instrumented service cold setup:239.2ms without planes,208.2ms with planes
- Instrumented service with planes reached43 first outcomes on its cold Node slice and115 cumulatively after its second slice

These observations demonstrate avoidable fingerprint serialization work. They do not reproduce or exclusively explain the browser's matched first-frame zero-attempt slice. Cold setup, scheduling and other elapsed costs remain distinct. The544 live qualification, including that zero-progress frame, is preserved separately.

## Minimal source change

Only monster-native-work-identity.mjs changes in production. The original JSON structure and all surrounding metadata remain serialized. Each typed view is replaced by null in that JSON and independently bound by:

- Its full structural property path
- Native view type, element length and byte length
- SHA256 of the actual view bytes, respecting its offset and extent

The final fingerprint hashes both the unchanged surrounding JSON and the ordered view bindings. A view moved between otherwise-null fields, a type/length change, or a plain object imitating a digest cannot reuse its identity. Supplied integritySHA256 values are still metadata and never replace byte hashing. Requests without typed views retain the exact previous fingerprint.

The service still clones its incoming request before fingerprinting and keeps its cancellation, current-frame and continuation-token guards. No cache, budget, proposal order, threshold, pose/model domain, source destination validation, or renderer changes.

## Validation

On three predetermined alternating old/new runs of the same full private request, fingerprint times were271.5/245.0/221.4ms old and14.5/6.4/6.7ms new. First observations and all repeats are retained. These are Node timings, not browser throughput guarantees.

Actual retained-plane, depth, known-mask, MSE stream, phase, draw-order, camera and encoded-background mutations change the fingerprint. The unit controls additionally cover type/length, source/frame/model/region/variant metadata, actual view offsets, moved views, marker-shaped plain objects, aliases, nested/empty/dotted keys and DataView bytes.

The old and new real services, using the same full request and unchanged1500ms/maxProposals1 bound, produce exactly equal complete region and continuation outputs for the first fixed proposal. Both use the two-step source handoff. Real-service stale frame, cancellation and a changed native plane with an unchanged declared integrity hash are rejected. Existing action/yaw/phase continuation and request/original-proposal regressions are retained in CONTINUATION_REGRESSIONS.log.

No body recognition, live phase, AT or all-input automation claim is made. No full build, browser action, Git operation or deployment was performed here. Root owns final integrated qualification and publication. Source-only artifacts exclude ROM, timelines, replay input, planes, masks, decoded plans and private serialized requests.
