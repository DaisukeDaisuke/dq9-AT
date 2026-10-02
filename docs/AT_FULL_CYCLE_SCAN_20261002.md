日本語要約: 合成の2イベント・消費間隔1の条件で、21億4748万3648クラスを実際に全件走査した。low31方式は8.475秒、既知seedのindex方式は9.651秒で、どちらも1億5973万9990候補となった。映像からのAT特定や、別の条件での速度を保証する結果ではない。詳細と再現手順は以下。

# Complete synthetic AT output-class cycle scan

## Result

Both unchanged search engines completed genuine scans of **2,147,483,648** domain values and found exactly **159,739,990** matches for the same synthetic `sparse2-fixed` workload. No unsearched tail remained. These are measured complete-run results, not extrapolations from bounded samples.

| Measurement | Low31 state-class engine | Known-origin index engine |
|---|---:|---:|
| Inclusive domain | 0–2,147,483,647 | 2–2,147,483,649 |
| Inspected values | 2,147,483,648 | 2,147,483,648 |
| Found count | 159,739,990 classes | 159,739,990 indices |
| Actual adapter elapsed time | 8.474524 s | 9.650933 s |
| Inspections per second | 253,404,644 | 222,515,661 |
| Completed kernel chunks | 2,148 | 2,148 |
| Emitted progress checkpoints | 2,151 | 96 |
| Checkpoints advancing coverage | 2,148 | 95 |
| OS process peak RSS | 50,692 KiB | 49,536 KiB |
| WASM linear-memory size | 262,144 bytes | 524,288 bytes |

Each scan used 2,147 chunks of 1,000,000 and a final chunk of 483,648. The index adapter batches progress emission on its existing roughly 100 ms cadence; fewer checkpoints do not mean fewer inspected chunks. Its unchanged internal counters check processed indices and matches after every chunk.

## Methods

- Imported the existing `experiment()` and `WORKLOADS` generator from the frozen bounded benchmark. The bounded runner was neither changed nor bypassed by increasing its accepted input; this is a separate complete-domain runner.
- Two events, gap exactly one draw. Event `i` accepts output `r` when `((r*17+i*13)%11)<3`. Masks cover all 32,768 output values. No ROM, video, save-state, or native observations are inputs.
- Seed is the benchmark's synthetic `0x12345678`. Index mode starts at 2, so the previous event for its first terminal index is index 1. One predecessor draw is warmed up and tracked separately from the 2,147,483,648 terminal inspections.
- Inspection budget equals the complete domain; wall budget is 3,600,000 ms. Both finished normally, far below that limit.
- Index materialization cap is 7. It retains seven records and its normal 16 preview samples; its export is correctly marked incomplete/truncated even though search coverage is complete. Low31 uses the unchanged built-in limit of 16 preview classes and their two lifts; it has no configurable materialization cap.
- Engine runs were serial, each in an isolated Node process. Timings include the full adapter call, mask packing/hash/instantiation, progress JSONL writes, yields, and bounded retention. No warm-up full scan, repeated-trial median, raw-kernel-only timing, or browser benchmark is claimed.
- RSS is isolated process lifetime peak, including Node/JS and a preliminary small WASM instance used to inspect linear-memory size. It is not WASM-only memory or a browser peak. Shared-machine load was uncontrolled; environment details and exact timestamps are in `full-scan-results.json`.

## What the equal counts mean

The low31 domain consists of all **2^31 output-equivalence classes**. Each class has **two 32-bit lifts**, separated by 2^31, which produce the same output sequence. Thus its 159,739,990 accepted classes correspond to 319,479,980 compatible 32-bit states for this synthetic event predicate.

The known-origin index domain instead supplies one particular 32-bit state at each absolute terminal index under the declared seed. Its length covers one complete low31 cycle, not the full 2^32-state cycle. For the full-period low31 LCG, every class is visited once in that interval. With the same two masks and one-call gap, exact count equality is therefore expected even though traversal order, preview samples, and index interpretation differ.

This does **not** recover current AT from video, validate a game origin, prove an unknown absolute draw index, or establish native/video identification performance. It does not measure or extrapolate performance for other gap widths, event counts, or workloads.

## Verification and integrity

Before the complete scans:

- Frozen benchmark tests passed: 37 validation cases and 14 bounded engine/workload comparisons, including independent BigInt oracles
- Existing low31 tests passed: 47 assertions
- Existing index tests passed: 634 assertions

After the complete scans:

- Both exact coverage intervals, no unsearched tail, status, checkpoint monotonicity, chunk boundaries, and equal found counts verified
- Retained class lifts and index records verified against the imported independent BigInt oracle/state mapper
- Source and WASM hashes matched the original benchmark baseline before and after; the original frozen four-file benchmark patch also remained byte-for-byte unchanged
- Index WASM: `fe39118a209b516d55456ded498a2dfc627cf473d248c29dd176e5316a9ca955`
- Low31 WASM: `a0279c9bd1c810af75640d3c7bba8ab5a65993c55c3dad53df9dc52cc23edb99`

These measurements come from an actual run of the exact portable `scripts/benchmark-at-full-cycle.mjs` recorded by SHA-256 in `docs/benchmarks/full-cycle-20261002/full-scan-results.json`; they are not timings relabeled from an earlier runner. Full source hashes, mask hashes, result flags, isolated memory data, and coverage are preserved there. Individual result files and checkpoint JSONL logs preserve the engine outputs and emitted coverage history. 

## Reproduction

Run from the repository root (the final argument is an explicit output directory):

```sh
node scripts/test-at-search-benchmark.mjs
node scripts/test-at-identify.mjs
node scripts/test-at-identify-index.mjs
node scripts/benchmark-at-full-cycle.mjs ./full-cycle-results
node scripts/test-at-full-cycle.mjs ./full-cycle-results
```

The independent runner checks built-in frozen baseline hashes and refuses to continue on any mismatch. Re-running replaces generated measurements/checkpoint logs in the supplied output directory only. The original bounded benchmark runner retains its original bounded input limits.
