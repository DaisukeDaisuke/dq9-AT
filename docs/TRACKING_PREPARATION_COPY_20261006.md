# Skip an unused compiler observation snapshot

Task: a28dee18-eeca-460a-b254-3b76e896eca5
Baseline: integrate-gap-ownership-ca4c5f5f, published 8d01161af62d770c9c6edb43c6230929cf7b6364.

## Measured result

Direct profiling of the actual prepareTrackingJob path confirms that compileTrackingObservations creates one full bundleSnapshot that prepareTrackingJob never reads. On the reconstructed warm observation snapshot, this clone costs a median 271.351 ms (measured range 261.209–308.629 ms).

Seven alternating before/after preparation runs used the same controller-produced 33,109,419-byte observation snapshot and encounter tables. After one warmup per variant:

- Synchronous prepare span: median 1559.016 ms before, 1300.546 ms after, down 16.6%.
- Total prepare elapsed: median 1809.365 ms before, 1597.689 ms after, down 11.7%.
- Whole-bundle snapshot copies: exactly one before and zero after, every run.
- Maximum sampled synchronous span: 1645.594 ms before, 1658.858 ms after. Maximum elapsed: 1930.191 ms before, 2024.108 ms after. Removing known copy work did not establish a worst-case latency improvement.

This is a Node v24.19.0 measurement. No browser performance, initial callback-gap causation or uninterrupted recognition improvement is claimed. Substantial other main-thread work remains.

The input uses the supplied warm timeline and comparison, plus the production residual producer and latest retained sightings. The original callback object was not saved, so the envelope is reconstructed rather than an original heap snapshot. The current controller derives its actual automatic event evidence/options before profiling. The measured fixture contains two legacy conditional singletons; no camera singleton is present. No source footage, pixels, ROM, game assets, DST or RAM data is included here.

## Exact parity

Every full returned preparation job is deep-equal between variants. The snapshot and options remain unchanged after each call. In particular:

- Full job JSON SHA-256: e011cc6113361f43275fb43f302420569900b316e0279700422f90932aa6e73b
- Request SHA-256: c970063b000b9e884cb6371a012f867c611a91df282a9f4e6adc2902c2d7baf1
- Complete observation fingerprint: fe60f14311cd3bdd83a5caf4eecb5ae407c7149d1a624587cb158f0c159edfef
- Checkpoint key: 3517a4092cf731ddc89daaf03e22d173417afc358251d7d6342b0c7f21face0a

Request, gate, identity, native body/motion companions and replay-input return fields all match. No AT search worker is launched by this profiler.

## Minimal internal path

The compiler gains a third internal option, includeBundleSnapshot, defaulting to true. Its normal return still includes an independent native structuredClone snapshot with exactly the existing alias/type semantics. prepareTrackingJob also defaults its includeCompilerBundleSnapshot context option to true and passes it through. Only createVideoTrackingAT supplies false, because that controller already owns the native-cloned observation and preparation never consumes this duplicate.

Both production-input guards, all epoch/current checks, request construction, complete fingerprinting and checkpoint calculations remain unchanged. The new context flag never enters observation evidence, request options or serialized/hash data.

Keeping generic defaults is important: a clone previously rejected unsupported values even in unused input fields. Generic compiler and generic preparation calls still perform the clone and retain their DataCloneError behavior for functions, symbols and proxies. The production controller continues rejecting those values at its earlier native-clone boundary before opting out of the unused later copy. Typed arrays and ArrayBuffer aliasing remain native-copy compatible. No new clone replacement algorithm was introduced.

## Profiler module identity repair

The historical ownership profiler hard-coded the ownership helper query. After deployment cache tokens changed, that URL created a different private WeakSet and could falsely measure the slow fallback. It now reads the production timeline's import and resolves that exact module URL, including the query. Its ownership regression test resolves the same URL as well. This is robust to future cache-token changes, without changing production behavior.

## Verification

Passed five focused preparation regressions: default native snapshot semantics and alias independence, real preparation field/fingerprint parity with default/opt-out, unsupported generic input rejection, unchanged production guards/cancellation, and actual controller-only opt-out through real preparation.

Passed the eight existing ownership regressions with the dynamically resolved production helper. Passed existing test-at-observation-compiler, test-video-pipeline-timing and test-at-session checks. No unrelated new fixture counts were added.

The standard aggregate build is reserved for parent integration; no shared compiler was run.

Reproduce the targeted measurement from candidate source:

    node --expose-gc scripts/profile-tracking-preparation-copy.mjs BASELINE_SOURCE TIMELINE_JSON COMPARISON_JSON OUTPUT_JSON

Run focused contracts:

    node --test scripts/test-tracking-preparation-copy.mjs scripts/test-observation-bundle-ownership.mjs

## Integration

Seven source files are supplied with a patch and SHA-256 manifest. Three production files change only the optional unused-copy path; four script files provide focused checks/profiling and the module-identity repair. No map-video-comparison, video-pipeline-timing, browser or root-stage file was edited. Refresh cache-query closure for the adapter, session and controller when publishing. Existing ownership-helper content is unchanged, and the test/profiler now follow its actual production URL.

The repaired standalone ownership profiler was also rerun against its original e701 source baseline and the current candidate using the same private warm inputs. It passed exact bundle/controller parity; its candidate consumer-copy median was 0.030496 ms, confirming that the intended private ownership brand was resolved instead of a duplicate-module fallback. Those additional results are labeled OWNERSHIP_PROFILER_REPRODUCTION.json and are not the targeted preparation-only before/after measurement.
