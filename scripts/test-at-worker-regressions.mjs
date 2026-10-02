// Work2 regressions: real production hosts + real Worker handlers + frozen kernels.
// Transport faults are synthetic; clocks are real except the separately named
// simulated-budget cases. No latency, full-cycle, native-game or browser claims.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {Worker} from 'node:worker_threads';
import {startIdentification} from '../web/at-identify.mjs';
import {startIndexIdentification} from '../web/at-identify-index.mjs';

const bytes = {
  low: await readFile(new URL('../web/wasm/at_identify.wasm', import.meta.url)),
  index: await readFile(new URL('../web/wasm/at_identify_stream.wasm', import.meta.url)),
};
const bridge = new URL('./at-identify-regression-node-worker.mjs', import.meta.url);
const keys = kind => kind === 'low'
  ? {count: 'inspectedStates', found: 'candidateClassesFound', searched: 'searchedIntervals', rest: 'unsearchedIntervals'}
  : {count: 'inspectedIndices', found: 'candidateIndicesFound', searched: 'searchedIndexIntervals', rest: 'unsearchedIndexIntervals'};
const inspected = (c, kind) => BigInt(c[keys(kind).count]);
const rows = [];
let assertions = 0, mutationNegatives = 0;
function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
function ok(value, message) { assert(value, message); assertions++; }
function request(kind, {small = false, events = 8} = {}) {
  const experiment = {branches: [{id: 'all-draws', events: Array.from({length: events}, (_, i) => ({
    id: `e${i}`, stateBoundary: 'immediately-after-draw', exactPredicate: true,
    possibleMask: new Uint8Array(32768).fill(1),
  })), edges: Array.from({length: events - 1}, (_, i) => ({
    from: `e${i}`, to: `e${i + 1}`, callsBetweenPostStates: {min: '1', max: '8'},
    provenance: 'synthetic independently bounded gap',
  }))}], associationAlternatives: []};
  if (kind === 'low') return {experiment,
    domain: {kind: 'intervals', intervals: small
      ? [{first: 65520, last: 65540}, {first: 131060, last: 131084}]
      : [{first: 65520, last: 327664}], provenance: 'synthetic finite low31 prior'},
    budget: {maxInspectedStates: 262145, maxWallTimeMs: 10000, chunkStates: 17}};
  return {experiment,
    domain: {kind: 'known-origin-terminal-indices',
      origin: {kind: 'initial-state-before-draw-1', initialSeed: 0x3927fe18, provenance: 'synthetic supplied origin'},
      first: '1', last: small ? '129' : '4194304', predecessorPolicy: 'post-boot-events-only',
      provenance: 'synthetic finite terminal-index prior'},
    budget: {maxInspectedIndices: 4194304, maxWallTimeMs: 10000, chunkIndices: small ? 17 : 1},
    materialization: {maxCandidatesTotal: 7}};
}
function ranges(xs) { return xs.map(x => ({first: BigInt(x.first), last: BigInt(x.last)})); }
function size(xs) { return xs.reduce((n, x) => n + x.last - x.first + 1n, 0n); }
function normalized(xs) {
  const out = [];
  for (const x of [...xs].sort((a, b) => a.first < b.first ? -1 : a.first > b.first ? 1 : 0)) {
    ok(x.first <= x.last, 'interval cannot be reversed');
    const tail = out.at(-1);
    ok(!tail || tail.last < x.first, 'searched/unsearched coverage cannot overlap');
    if (tail && tail.last + 1n === x.first) tail.last = x.last;
    else out.push({...x});
  }
  return out;
}
function stateAfter(seed, index) {
  // Independent finite forward recurrence, no product jump/LCG helper.
  let s = BigInt(seed);
  for (let i = 0n; i < index; i++) s = (1103515245n * s + 12345n) & 0xffffffffn;
  return Number(s);
}
function validate(checkpoint, q, kind) {
  const k = keys(kind), b = checkpoint.branches[0];
  const searched = ranges(b[k.searched]), rest = ranges(b[k.rest]);
  const domain = ranges(kind === 'low' ? q.domain.intervals : [{first: q.domain.first, last: q.domain.last}]);
  eq(normalized([...searched, ...rest]), normalized(domain), 'no gaps or coverage outside declared domain');
  eq(size(searched), inspected(checkpoint, kind), 'only acknowledged inspected coordinates count');
  const prefix = [];
  let remaining = inspected(checkpoint, kind);
  for (const interval of domain) {
    const n = remaining < interval.last - interval.first + 1n ? remaining : interval.last - interval.first + 1n;
    if (n > 0n) prefix.push({first: interval.first, last: interval.first + n - 1n});
    remaining -= n;
  }
  eq(normalized(searched), normalized(prefix), 'finite searches cover exactly a prefix of the declared intervals');
  const early = kind === 'index' ? BigInt(q.experiment.branches[0].events.length - 1) : 0n;
  const found = inspected(checkpoint, kind) > early ? inspected(checkpoint, kind) - early : 0n;
  eq(b[k.found], String(found), 'independent all-mask count, including post-boot predecessor exclusion');
  eq(checkpoint.currentVideoStateRecovered, false);
  eq(checkpoint.globallyUnique, false);
  eq(checkpoint.branchCountsSummed, false);
  eq(checkpoint.coverageVerified, false);
  eq(checkpoint.unexcludedAlternativeBranchIds, ['all-draws']);
  eq(b.searchCompleteWithinDomain, b.status === 'complete');
  eq(b.eventStateOnly, true);
  eq(b.eventToObservationPropagationPerformed, false);
  eq(b.samplesTruncated, found > 16n);
  const expectedSampleCount = Number(found < 16n ? found : 16n);
  if (kind === 'low') {
    const samples = [];
    for (const interval of searched) for (let s = interval.first; s <= interval.last && samples.length < 16; s++) samples.push(Number(s));
    eq(b.sampleClasses, samples);
    eq(b.sampleFullStateLifts, samples.map(s => [s, s + 2147483648]));
    eq(b.oneEventClassWithinDomain, b.status === 'complete' && found === 1n);
  } else {
    eq(checkpoint.absoluteIndexProven, false);
    eq(b.absoluteIndexProven, false);
    eq(b.sampleCandidates.length, expectedSampleCount);
    for (let i = 0; i < expectedSampleCount; i++) {
      const index = early + 1n + BigInt(i), state32 = stateAfter(q.domain.origin.initialSeed, index);
      eq(b.sampleCandidates[i], {terminalIndex: String(index), state32, low31Class: state32 & 0x7fffffff,
        outputEquivalentState32: Number(BigInt(state32) ^ 0x80000000n),
        outputEquivalentIndexModuloFullCycle: String((index + 2147483648n) % 4294967296n),
        sameIndexHasOneStateUnderSuppliedSeed: true, absoluteIndexProven: false});
    }
    const m = b.candidateMaterialization, cap = BigInt(q.materialization.maxCandidatesTotal);
    const saved = Number(found < cap ? found : cap);
    eq(m.materializedCount, saved);
    eq(checkpoint.materializedCandidateRecordsTotal, saved);
    eq(Array.from(m.indexOffsets), Array.from({length: saved}, (_, i) => Number(early) + i));
    eq(Array.from(m.states32), Array.from({length: saved}, (_, i) => stateAfter(q.domain.origin.initialSeed, early + 1n + BigInt(i))));
    eq(m.truncated, found > BigInt(saved));
    eq(m.allFoundCandidatesMaterialized, found === BigInt(saved));
    eq(m.candidateExportCompleteWithinDeclaredDomain, b.status === 'complete' && found === BigInt(saved));
    eq(b.oneCandidateIndexWithinDomain, b.status === 'complete' && found === 1n);
  }
}
function sameAcknowledgedData(result, acknowledged, kind) {
  // Independent equality of all candidate, coverage, materialization and sample
  // fields; do not call the product cancellation/summarization implementation.
  eq(inspected(result, kind), inspected(acknowledged, kind));
  eq(result.sequence, acknowledged.sequence);
  const fields = kind === 'low'
    ? ['candidateClassesFound', 'sampleClasses', 'sampleFullStateLifts', 'searchedIntervals', 'unsearchedIntervals']
    : ['candidateIndicesFound', 'sampleCandidates', 'searchedIndexIntervals', 'unsearchedIndexIntervals', 'candidateMaterialization'];
  for (let i = 0; i < result.branches.length; i++) for (const field of fields) eq(result.branches[i][field], acknowledged.branches[i][field], `last-ack retention: ${field}`);
  if (kind === 'index') eq(result.materializedCandidateRecordsTotal, acknowledged.materializedCandidateRecordsTotal);
}
async function trial(kind, mode, q = request(kind), controls = {}) {
  let native, termination, exitCode, nativeError, job, timer, timedOut = false, diagnostic, lastAck;
  const acks = [];
  class Relay extends EventEmitter {
    constructor() {
      super();
      native = new Worker(bridge, {workerData: {engine: kind, ...controls}});
      this.threadId = native.threadId;
      native.on('message', message => {
        if (message.type === 'regression-diagnostic') {
          diagnostic ??= message;
          lastAck = job.checkpoint();
          if (!controls.runtimeError) job.cancel();
        } else this.emit('message', message);
      });
      native.on('error', error => {nativeError = error; this.emit('error', error);});
      native.on('exit', code => {exitCode = code; this.emit('exit', code);});
    }
    postMessage(message) { native.postMessage(message); }
    terminate() { return termination ??= native.terminate(); }
  }
  const wasmBytes = Uint8Array.from(bytes[kind]);
  if (mode === 'hash-error') wasmBytes[0] ^= 1;
  const start = kind === 'low' ? startIdentification : startIndexIdentification;
  job = start(q, {wasmBytes, WorkerClass: Relay, onProgress: checkpoint => {
    acks.push(checkpoint);
    if (mode === 'cancel-after-ack' && inspected(checkpoint, kind) > 0n) {
      lastAck = job.checkpoint(); job.cancel();
    }
  }});
  const threadId = native.threadId, initial = job.checkpoint();
  if (mode === 'cancel-immediate') {lastAck = initial; job.cancel();}
  const deadline = new Promise((_, reject) => {timer = setTimeout(() => {
    timedOut = true;
    reject(Error(`${kind}/${mode}: real Worker watchdog exceeded 15s`));
    job.cancel(); // Reject first so cancellation can never make the timeout pass.
  }, 15000);});
  let result;
  try {
    result = await Promise.race([job.result, deadline]);
    ok(!timedOut);
    ok(termination instanceof Promise, 'host must request native Worker termination');
    const code = await termination;
    ok(Number.isInteger(exitCode), 'native exit event must have fired');
    eq(code, exitCode);
    eq(native.threadId, -1, 'Worker must have exited before this trial is accepted');
  } finally {
    clearTimeout(timer);
    if (native.threadId !== -1) await native.terminate();
  }
  for (const c of acks) validate(c, q, kind);
  validate(result, q, kind);
  if (mode.startsWith('cancel-') || mode.includes('withheld')) {
    eq(result.status, 'cancelled');
    sameAcknowledgedData(result, lastAck, kind);
  }
  if (mode === 'cancel-after-ack') ok(inspected(result, kind) > 0n);
  if (controls.withholdAfter !== undefined) {
    ok(diagnostic, 'the real engine must actually compute before cancellation/error');
    eq(diagnostic.clockSubstitution, false);
    validate(diagnostic.checkpoint, q, kind);
    ok(inspected(diagnostic.checkpoint, kind) > inspected(lastAck, kind), 'computed work is strictly beyond the last delivered ack');
    if (controls.withholdAfter === 0) {
      eq(inspected(result, kind), 0n);
      ok(acks.every(c => inspected(c, kind) === 0n), 'zero positive ack means zero searched/candidates');
    } else ok(inspected(result, kind) > 0n);
  }
  if (controls.runtimeError) {
    eq(result.status, 'failed');
    ok(nativeError instanceof Error, 'must use the native Worker error event');
    ok(result.error.includes('Injected native Worker error'));
    sameAcknowledgedData(result, lastAck, kind);
  }
  if (mode === 'hash-error' || controls.invalidWorkerInput) {
    eq(result.status, 'failed'); eq(inspected(result, kind), 0n);
    ok(mode === 'hash-error' ? /hash mismatch/i.test(result.error) : /first index|Sorted disjoint/i.test(result.error));
    sameAcknowledgedData(result, acks.at(-1) ?? initial, kind);
  }
  rows.push({id: `${controls.simulatedBudgetClock ? 'simulated-budget' : 'real-worker'}.${kind}.${mode}`,
    status: result.status, inspected: String(inspected(result, kind)),
    computedButUnacknowledged: diagnostic ? String(inspected(diagnostic.checkpoint, kind) - inspected(result, kind)) : null,
    positiveAcks: acks.filter(c => inspected(c, kind) > 0n).length,
    nativeExitConfirmed: true, clockSubstitution: Boolean(controls.simulatedBudgetClock)});
  return {result, q, threadId};
}
const mutationFixtures = [];
for (const kind of ['low', 'index']) {
  const cancelled = await trial(kind, 'cancel-immediate', request(kind, {small: true}));
  await trial(kind, 'cancel-after-ack');
  await trial(kind, 'zero-ack-withheld', request(kind), {withholdAfter: 0});
  const retained = await trial(kind, 'positive-ack-withheld', request(kind), {withholdAfter: 1});
  const failed = await trial(kind, 'zero-ack-runtime-error', request(kind, {small: true}), {withholdAfter: 0, runtimeError: true});
  await trial(kind, 'positive-ack-runtime-error', request(kind), {withholdAfter: 1, runtimeError: true});
  await trial(kind, 'hash-error');
  await trial(kind, 'invalid-worker-input', request(kind), {invalidWorkerInput: true});
  const a = await trial(kind, 'restart-after-cancel', request(kind, {small: true}));
  const b = await trial(kind, 'restart-after-error', request(kind, {small: true}));
  eq(a.result.status, 'complete'); eq(b.result.status, 'complete');
  ok(a.threadId !== cancelled.threadId && b.threadId !== failed.threadId && a.threadId !== b.threadId);
  sameAcknowledgedData(a.result, b.result, kind);
  const budget = request(kind, {small: true, events: 2});
  if (kind === 'low') budget.budget.maxInspectedStates = 19;
  else budget.budget.maxInspectedIndices = 19;
  const limited = await trial(kind, 'inspection-budget', budget);
  eq(limited.result.status, 'budget-stopped'); eq(inspected(limited.result, kind), 19n);
  const simulated = request(kind, {small: true, events: 2});
  simulated.budget.maxWallTimeMs = 80;
  if (kind === 'low') simulated.budget.chunkStates = 7;
  else simulated.budget.chunkIndices = 7;
  const boundary = await trial(kind, 'isolated-clock-boundary', simulated, {simulatedBudgetClock: true});
  eq(boundary.result.status, 'budget-stopped');
  eq(inspected(boundary.result, kind), kind === 'low' ? 21n : 7n, 'deterministic isolated boundary, not a real-time measurement');
  mutationFixtures.push({kind, ...retained});
}
for (const {kind, q, result} of mutationFixtures) {
  const k = keys(kind);
  const changes = [
    c => c.branches[0][k.found] = String(BigInt(c.branches[0][k.found]) + 1n),
    c => c.branches[0][k.rest][0].first = String(BigInt(c.branches[0][k.rest][0].first) + 1n),
    c => c.branches[0][k.rest][0].first = String(BigInt(c.branches[0][k.rest][0].first) - 1n),
    c => c.branches[0][k.rest].at(-1).last = String(BigInt(c.branches[0][k.rest].at(-1).last) + 1n),
    c => c.branches[0].searchCompleteWithinDomain = true,
    c => c.currentVideoStateRecovered = true,
    c => c.globallyUnique = true,
    c => kind === 'low' ? c.branches[0].sampleFullStateLifts[0][1]++ : c.branches[0].candidateMaterialization.states32[0]++,
  ];
  for (const change of changes) {
    const mutant = structuredClone(result); change(mutant);
    assert.throws(() => validate(mutant, q, kind), assert.AssertionError);
    mutationNegatives++;
  }
}
console.log(JSON.stringify({passed: true, cases: rows.length, assertions, mutationNegatives,
  realWorkerCases: rows.filter(r => !r.clockSubstitution).length,
  isolatedSimulatedBudgetCases: rows.filter(r => r.clockSubstitution).length,
  scope: 'bounded production Worker/host regression with independent closed-form candidate and coverage oracle; no timing performance claim', rows}, null, 2));
