// Work2 finite independent-oracle regressions. The oracle below was frozen in
// the accepted audit; expected division/multiplication use BigInt IEEE754 RNE,
// never the product's Number arithmetic, LCG/jump helpers, DP or packed kernels.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {atRandomInt} from '../web/at-core.mjs';
import {compileEvent} from '../web/at-observation-compiler.mjs';
import {startIdentification} from '../web/at-identify.mjs';
import {startIndexIdentification} from '../web/at-identify-index.mjs';
import {roundBinary64, binary64RandInt, weightedPredicateIEEE} from './fixtures/at-ieee754-reference.mjs';

const oracleSHA256 = '2fbfa26c3e96a601622ff8c1457ccdc29cc093555f93ce75517360501ad56b4c';
assert.equal(createHash('sha256').update(await readFile(new URL('./fixtures/at-ieee754-reference.mjs', import.meta.url))).digest('hex'), oracleSHA256);
let assertions = 1, scalarComparisons = 0, maskOutputs = 0, mutationNegatives = 0, workerCases = 0;
const eq = (a, b, message) => {assert.deepEqual(a, b, message); assertions++;};
const ok = (v, message) => {assert(v, message); assertions++;};
// Hand-checkable nearest-even ties independently validate the reference itself.
for (const [n, d, bits] of [[1n, 2n, 0x3fe0000000000000n],
  [(1n << 53n) + 1n, 1n << 53n, 0x3ff0000000000000n],
  [(1n << 53n) + 3n, 1n << 53n, 0x3ff0000000000002n],
  [-((1n << 53n) + 1n), 1n << 53n, 0xbff0000000000000n]]) eq(roundBinary64(n, d).bits, bits);
for (const [r, max, value] of [[0, 1, 0], [0, 32767, -1], [1, 32767, 0], [32767, 32767, 32766]]) {
  eq(binary64RandInt(r, max), value);
  ok(atRandomInt(r, max) === value); // Integer equality intentionally treats -0 as0.
}
const minima = [[17970, 93, 50, 51], [22198, 93, 62, 63], [3256, 151, 14, 15]];
const rational = (r, max) => Number(BigInt(max) * (BigInt(r) - 1n) / 32767n);
function verifyMinima(fn) {for (const [r, max, expected] of minima) eq(fn(r, max), expected);}
verifyMinima(atRandomInt);
for (const [r, max, expected, invalidRational] of minima) {
  eq(binary64RandInt(r, max), expected); eq(rational(r, max), invalidRational);
  assert.throws(() => eq(rational(r, max), expected), assert.AssertionError); mutationNegatives++;
}
// Complete 15-bit outputs for two discriminating multipliers, no full state scan.
for (const max of [93, 151]) for (let r = 0; r < 32768; r++) {
  ok(atRandomInt(r, max) === binary64RandInt(r, max), `binary64 max=${max}, R=${r}`);
  scalarComparisons++;
}
const event = (id, alternatives) => ({id, stateBoundary: 'immediately-after-draw',
  operation: 'weighted-species', tableSpeciesAlternatives: alternatives});
function resources(max, split = 50) {return {60000: {maxRand: max, data: [
  {start: 0, end: split, monsterId: 7, trapMonster: false},
  {start: split + 1, end: max - 1, monsterId: 8, trapMonster: false},
]}};}
for (const max of [93, 151]) {
  const tables = resources(max), raw = event('last', [{tableId: 60000, monsterId: 8}]);
  const compiled = compileEvent(raw, {tables});
  for (let r = 0; r < 32768; r++) {
    const expected = weightedPredicateIEEE(raw, r, tables);
    eq(compiled.possibleMask[r], +expected.possible);
    eq(compiled.unresolvedMask[r], +expected.unknown); maskOutputs++;
  }
}
const wasm = {
  low: await readFile(new URL('../web/wasm/at_identify.wasm', import.meta.url)),
  index: await readFile(new URL('../web/wasm/at_identify_stream.wasm', import.meta.url)),
};
const workerURL = {
  low: new URL('./at-identify-node-worker.mjs', import.meta.url),
  index: new URL('./at-identify-index-node-worker.mjs', import.meta.url),
};
function inverse(a, mod) {
  let r = mod, next = a, t = 0n, u = 1n;
  while (next) {const q = r / next; [r, next] = [next, r - q * next]; [t, u] = [u, t - q * u];}
  assert.equal(r, 1n); return (t % mod + mod) % mod;
}
const inverseMultiplier = inverse(1103515245n, 1n << 32n);
const previous = s => ((s - 12345n) * inverseMultiplier) & 0xffffffffn;
const next = s => (s * 1103515245n + 12345n) & 0xffffffffn;
const all = id => ({id, stateBoundary: 'immediately-after-draw', possibleMask: new Uint8Array(32768).fill(1), exactPredicate: true});
function experiment(final, count) {return {branches: [{id: 'chain', events: [
  ...Array.from({length: count - 1}, (_, i) => all(`e${i}`)), {...final, id: `e${count - 1}`},
], edges: Array.from({length: count - 1}, (_, i) => ({from: `e${i}`, to: `e${i + 1}`,
  callsBetweenPostStates: {min: '1', max: '1'}, provenance: 'synthetic exact gap'}))}], associationAlternatives: []};}
async function compareBoth(final, predicate, terminal, {events = 2, widened = false} = {}) {
  const first = terminal - 4, last = terminal + 4, exp = experiment(final, events);
  const lowRequest = {experiment: exp, domain: {kind: 'intervals', intervals: [{first, last}], provenance: 'synthetic bounded oracle fixture'},
    budget: {maxInspectedStates: 100, maxWallTimeMs: 10000, chunkStates: 7}};
  let seed = BigInt(terminal);
  for (let i = 0; i < events; i++) seed = previous(seed);
  const indexRequest = {experiment: exp, domain: {kind: 'known-origin-terminal-indices', first: '1', last: String(events + 15),
    origin: {kind: 'initial-state-before-draw-1', initialSeed: Number(seed), provenance: 'independently inverted synthetic origin'},
    predecessorPolicy: 'post-boot-events-only', provenance: 'finite synthetic truth fixture'},
    budget: {maxInspectedIndices: 100, maxWallTimeMs: 10000, chunkIndices: 7}, materialization: {maxCandidatesTotal: 100}};
  const expectedLow = [];
  for (let s = first; s <= last; s++) if (predicate((s >>> 16) & 32767)) expectedLow.push(s);
  const expectedIndex = [];
  let state = seed;
  for (let index = 1; index <= events + 15; index++) {
    state = next(state);
    if (index >= events && predicate(Number((state >> 16n) & 32767n))) expectedIndex.push({terminalIndex: String(index), state32: Number(state)});
  }
  const outputs = {};
  for (const kind of ['low', 'index']) {
    const q = kind === 'low' ? lowRequest : indexRequest;
    const run = kind === 'low' ? startIdentification : startIndexIdentification;
    const result = await run(q, {wasmBytes: wasm[kind], WorkerClass: Worker, workerURL: workerURL[kind]}).result;
    workerCases++; eq(result.status, 'complete'); eq(result.currentVideoStateRecovered, false);
    const b = result.branches[0]; eq(b.searchCompleteWithinDomain, true);
    if (kind === 'low') {
      eq(b.candidateClassesFound, String(expectedLow.length)); eq(b.sampleClasses, expectedLow);
      eq(b.searchedIntervals, q.domain.intervals); eq(b.unsearchedIntervals, []);
    } else {
      const m = b.candidateMaterialization;
      eq(b.candidateIndicesFound, String(expectedIndex.length));
      eq(Array.from(m.indexOffsets, (offset, i) => ({terminalIndex: String(BigInt(m.baseTerminalIndex) + BigInt(offset)), state32: m.states32[i]})), expectedIndex);
      eq(m.candidateExportCompleteWithinDeclaredDomain, true); eq(m.truncated, false);
      eq(b.unsearchedIndexIntervals, []); eq(result.absoluteIndexProven, false);
      // Index 'events' was constructed independently to land on terminal.
      eq(expectedIndex.some(x => x.terminalIndex === String(events)), Boolean(predicate((terminal >>> 16) & 32767)));
    }
    if (widened) {eq(b.predicateExact, false); eq(result.unexcludedAlternativeBranchIds, ['chain']);}
    outputs[kind] = result;
  }
  return outputs;
}
// Each minimized divide-then-multiply counterexample traverses production
// compilation, Worker transport and both actual kernels, not just atRandomInt.
for (const [r, max, value] of minima) {
  const tables = resources(max, value), raw = event('last', [{tableId: 60000, monsterId: 8}]);
  const compiled = compileEvent(raw, {tables}), predicate = output => weightedPredicateIEEE(raw, output, tables).possible;
  eq(compiled.possibleMask[r], 0);
  eq(rational(r, max) > value, true); // A rational-arithmetic mutant would wrongly accept.
  await compareBoth(compiled, predicate, r * 65536 + 8);
  await compareBoth(compiled, predicate, (r + 1) * 65536 + 8);
}
// Adding an unknown table alternative must retain a previously rejected truth
// in both production search paths, rather than intersect disjunctive evidence.
const tables = resources(93), raw = event('last', [{tableId: 60000, monsterId: 8}, {tableId: 60001, monsterId: 8}]);
const widened = compileEvent(raw, {tables});
eq(widened.possibleMask[17970], 1); eq(widened.unresolvedMask[17970], 1);
await compareBoth(widened, r => weightedPredicateIEEE(raw, r, tables).possible, 17970 * 65536 + 8, {widened: true});
// Selectively rejecting stage31 distinguishes correct uint32 bit31 packing from
// the existing all-accept32-stage case (which alone cannot detect ignored stage31).
const bit31 = {...all('last'), possibleMask: Uint8Array.from({length: 32768}, (_, r) => r & 1)};
await compareBoth(bit31, r => Boolean(r & 1), 100 * 65536 + 8, {events: 32});
await compareBoth(bit31, r => Boolean(r & 1), 101 * 65536 + 8, {events: 32});
console.log(JSON.stringify({passed: true, assertions, scalarComparisons, maskOutputs,
  workerCases, mutationNegatives, oracleSHA256,
  scope: 'finite BigInt binary64 oracle and actual production Worker/kernel predicates; no ROM bytes, native-game validation or universal no-false-negative proof'}));
