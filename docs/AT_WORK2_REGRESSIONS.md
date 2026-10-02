# Work2 audit findings applied to the production build

The accepted Work2 finite audit demonstrated no product defect. Its useful
outcome is enforced by runnable regressions of the shipping modules, rather than
an audit report that is disconnected from the build. No search, protection API,
reviewed WASM, ABI, reference implementation or production threshold is changed.

Run the same checks used by the production build:

```sh
node scripts/test-at-worker-regressions.mjs
node scripts/test-at-binary64-regressions.mjs
bash scripts/build.sh
```

The Pages build invokes both tests. Its path filters include the new tests,
transport helper and reference fixture, so editing those files also triggers CI.

## Real Worker coverage and cancellation

`test-at-worker-regressions.mjs` uses the real production hosts. Its small Node
transport imports the unchanged production Worker handlers; those execute the
reviewed kernels. It does not copy a search algorithm or fabricate progress.

The 22 real-clock cases cover both low31 and known-origin terminal-index modes:

- Immediate cancellation and cancellation after a positive acknowledgement
- Actual computed checkpoints withheld before **any** positive acknowledgement:
  cancellation must still return zero inspected coordinates and zero candidates
- Withheld computation after the first positive acknowledgement: cancel and
  native Worker error must retain the last acknowledgement's candidate counts,
  samples, full-state lifts, materialization buffers and coverage intervals
- Native error before a positive acknowledgement, damaged kernel bytes, invalid
  input reaching the Worker, fresh-worker restart, and inspection-budget tails
- A native termination Promise, exit event and final `threadId === -1` on every
  accepted case. Resolving the host's result Promise alone does not prove cleanup

Independent BigInt interval union/length checks reject gaps, overlap, out-of-prior
coverage and inspection overclaim. All-accept masks give a closed-form candidate
oracle. Index candidates begin at event count, not at index1: post-boot-only
predecessors must exist. Samples/materialized states use finite BigInt forward
recurrence independent of the product jump function. Sixteen deliberately
corrupted checkpoints must be rejected by these invariants.

Two additional cases are explicitly named `simulated-budget.*`. Only those
isolated Worker processes replace `performance.now`, in 20ms steps, to check
exact deterministic 80ms branch boundaries. They do not count as real-clock or
speed/latency evidence. Real cases never replace either clock. A 15s watchdog is
a harness failure, never a successful cancellation result.

## Binary64, conservative masks and bit31

`fixtures/at-ieee754-reference.mjs` is byte-identical to the accepted audit's
separate IEEE754 reference, SHA256
`2fbfa26c3e96a601622ff8c1457ccdc29cc093555f93ce75517360501ad56b4c`.
It derives nearest-even binary64 division followed by multiplication using
BigInt rationals. Hand-checkable midpoint ties self-test the oracle before any
comparison. Expected results never call production floating arithmetic or
search/LCG helpers. Signed zero is compared as the integer value zero.

The test checks every 15-bit output for maxima 93 and 151: 65,536 scalar comparisons
and 65,536 complete possible/unresolved mask output comparisons. Discriminating
fixtures include `(R,max)=(17970,93),(22198,93),(3256,151)`: exact-rational
multiplication gives 51/63/15 while the required division-then-multiplication gives
50/62/14. Three negative rational-arithmetic variants must be rejected.

Eighteen actual production Worker/kernel cases carry those predicates through
both search paths, check neighboring outputs, preserve an independently
constructed truth after adding an unknown-table disjunction, and selectively
reject stage 31 to catch unsigned bit31 packing errors. An all-accept 32-event
fixture alone cannot detect a silently ignored final predicate.

## Scope

All inputs are finite synthetic data and existing reviewed public code/kernels.
No ROM/state/image/audio asset bytes are added. These checks do not prove the
entire 2^31/2^32 space, arbitrary packets/tables/associations, browser timing,
native-game spawning, current video state, or natural-generation truth. The
new tests do not move any AT proof bound. Existing integration tests remain
necessary and are run by the same normal build.
