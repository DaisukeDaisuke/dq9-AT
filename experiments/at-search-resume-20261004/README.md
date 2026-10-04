# Isolated durable single-branch AT search
Uses the unchanged streaming index engine and frozen WASM. Explicit request, inclusive computational domain, and shard size are required. Each complete shard result is saved before its hash is committed into checkpoint.json. Only committed results count as searched; partial/orphan data remains unsearched. This does not restore WASM memory.

Measured 2026-10-04 UTC: one process saved the first 134217728-index segment and exited. A separate process verified that checkpoint and completed 15 remaining segments through 2147483648. No gaps/overlaps. All materialized candidates matched the existing unsharded privileged two-output reference, exactly one candidate at local index2. The first segment took535.77ms; resumed15segments10142.13ms, real clock, separate process timings, not a performance guarantee.

This is one low31 output-equivalence cycle under supplied native origin, not full32 unique absolute index or video AT recovery. Existing opposite-bit31 ambiguity remains. No production ledger changes. Current runner explicitly rejects multiple association branches. It retains candidate-export incompleteness; complete search does not imply complete export.

A mid-shard process kill and environment-loss recovery have not been measured. Local atomic save is not cloud backup. Request/kernel/domain binding and each saved result hash are verified before reuse. Input/result files may contain private experimental observations; do not publish them.

Usage:
node experiments/at-search-resume-20261004/run-sharded-search.mjs REQUEST_JSON PRIVATE_OUTPUT FIRST LAST SHARD_SIZE [MAX_NEW_SHARDS]
Set MAX_NEW_SHARDS=1 to save one completed shard and exit; omit to continue. Use the same request/domain/shardSize/output for resume. The request is the existing engine format and does not synthesize missing observations.
