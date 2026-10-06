# Same-ROM source reuse for bounded native body comparison

The recognition worker now passes its already-loaded NitroFS to the optional native body source service. Previously that service copied the complete ROM and extracted filesystem again while opening its source project. For the verified private ROM, this duplicated a 268,435,456-byte ROM buffer and 237,708,101 file bytes across 7,542 files.

`openMapRom(rom)` keeps its original isolated-filesystem behavior. The new optional filesystem argument is a caller-owned dependency. It does not independently hash that filesystem against the ROM. In the production worker, both arguments come from the same private `runState`: the request cannot supply or replace the reused filesystem. The worker first requires the request ROM SHA256 to match the digest computed at load. ROM reload disposes the old source service/state; cancellation retains only the existing loaded state. The source project still validates the original ARM9 revision and parses source data normally.

No time budget, proposal limit, candidate/background branch, score threshold, renderer policy, cancellation path or frozen-frame continuation binding was changed. The optional request still waits at most 2,000 ms, requests targeted cancellation on expiry, and leaves unfinished support unknown. Its error text now reflects that expiry does not schedule a later attachment. A continuation starts only after a successful first result.

## Verification scope

- The actual client and worker were reproduced using a frozen video-1200 frame, its existing appearance hints, all ten candidate models and all eight requested residual regions.
- Baseline and patched first-sweep region evidence matched across five runs: 80 pairs received their first outcome; 79 native proposals rendered. Untested pose/scale/heading/floor alternatives, unknown identities and AT lower bound zero remained unchanged.
- Shared and independent filesystems had identical file contents, complete map catalogs and the tested source floor plan. Input ROM and file bytes remained unchanged.
- Cancellation, changed-ROM rejection, changed-pixel continuation rejection, recovery with a new request, release, and late-result isolation were checked using the actual worker.
- A later unpatched browser export at video time 1200 returned a successful native slice with 220 region/model pairs but zero attempts and zero preparation-progress counters. That snapshot does not schedule a continuation under the existing progress gate. The earlier timeout is therefore not universal; this change does not alter the gate or certify a browser improvement.
- The saved export lacks the ephemeral source-destination handoff, so replay used the existing same-frame reconstruction fallback. End-to-end timings overlap; no browser timeout resolution or dependable total-latency improvement is claimed.

A private-ROM regression is available:

```sh
node --expose-gc scripts/test-native-source-reuse.mjs ORIGINAL_ROM [RECORD_KEY]
```

This is a source allocation improvement. First-sweep success is not exhaustive pose coverage, body identification, or complete automatic recognition.
