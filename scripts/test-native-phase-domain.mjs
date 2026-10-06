import assert from 'node:assert/strict';
import { createNativePhaseCursor, nextNativePhase, nativePhaseCursorSummary } from '../web/monster-native-phase-domain.mjs';

const clip = (numFrames, resourceFlags, name = 'stand.nsbca', extra = {}) => ({ clip: name, numFrames, resourceFlags, resourceSHA256: 'a'.repeat(64), ...extra });
const reference = (name, frame, extra = {}) => ({ ready: true, clip: name, frame, yawFx: 6434, ...extra });
const reverse12 = rank => Number.parseInt(rank.toString(2).padStart(12, '0').split('').reverse().join(''), 2);
const key = proposal => [proposal.clip, proposal.phaseFx];
const take = (cursor, count) => Array.from({ length: count }, () => nextNativePhase(cursor));
function exhaustive(numFrames, resourceFlags) {
 const cursor = createNativePhaseCursor([clip(numFrames, resourceFlags)]), before = nativePhaseCursorSummary(cursor);
 const intervalCount = numFrames - (resourceFlags === 1 ? 1 : 0), expectedCount = intervalCount * 4095, seen = new Set();
 assert.equal(before.totalCount, expectedCount);
 assert.equal(before.sourcePhaseDomain, 'SDK-J0AC-wrapper-input');
 assert.equal(before.clips[0].sourcePhaseDomain, 'SDK-J0AC-wrapper-input');
 assert.equal(before.clips[0].ordinaryKind1PeriodFx, (numFrames - 1) * 4096);
 assert.equal(before.clips[0].sdkFinalWrapIntervalIncluded, resourceFlags === 3);
 assert.deepEqual(before.nextPhase, { clip: 'stand.nsbca', integerFrame: 0, ordinaryKind1PeriodFx: (numFrames - 1) * 4096, sdkFinalWrapInterval: false });
 assert.equal(before.sourcePhaseCount, numFrames * 4096);
 assert.equal(before.storedIntegerCount, numFrames);
 assert.equal(before.skippedFractionalAliasCount, (numFrames - intervalCount) * 4095);
 for (let rank = 1; rank < 4096; rank++) for (let frame = 0; frame < intervalCount; frame++) {
  const p = nextNativePhase(cursor), fractionFx = reverse12(rank), q = frame * 4096 + fractionFx;
  assert.equal(p.phaseFx, q); assert.equal(p.frame, null); assert(!seen.has(q)); seen.add(q);
  assert.equal(p.adjacentToReference, false); assert(!Object.hasOwn(p, 'referenceYawFx'));
  assert.deepEqual(Object.keys(p.phaseCondition).filter(k => k !== 'signed32ClampAlias').sort(), ['kind', 'resourceSHA256', 'resourceFlags', 'sourcePhaseDomain', 'ordinaryKind1PeriodFx', 'sdkFinalWrapInterval', 'phaseFx', 'clampedPhaseFx', 'integerFrame', 'fractionFx', 'nextFrame', 'interpolationEnabled', 'currentPhaseKnown', 'defaultCallbackAssumed', 'fieldReachabilityProven'].sort());
  assert.equal(p.phaseCondition.resourceFlags, resourceFlags); assert.equal(p.phaseCondition.resourceSHA256, 'a'.repeat(64));
  assert.equal(p.phaseCondition.sourcePhaseDomain, 'SDK-J0AC-wrapper-input');
  assert.equal(p.phaseCondition.ordinaryKind1PeriodFx, (numFrames - 1) * 4096);
  assert.equal(p.phaseCondition.sdkFinalWrapInterval, frame === numFrames - 1);
  assert.equal(p.phaseCondition.phaseFx, q); assert.equal(p.phaseCondition.clampedPhaseFx, q);
  assert.equal(p.phaseCondition.integerFrame, frame); assert.equal(p.phaseCondition.fractionFx, fractionFx);
  assert.equal(p.phaseCondition.nextFrame, frame + 1 === numFrames ? 0 : frame + 1);
  assert.equal(p.phaseCondition.interpolationEnabled, true); assert.equal(p.phaseCondition.currentPhaseKnown, false);
  assert.equal(p.phaseCondition.defaultCallbackAssumed, true); assert.equal(p.phaseCondition.fieldReachabilityProven, false);
  if (q === numFrames * 4096 - 1) assert.deepEqual(p.phaseCondition.signed32ClampAlias, { minPhaseFx: q, maxPhaseFx: 2147483647, clampedPhaseFx: q });
  else assert(!Object.hasOwn(p.phaseCondition, 'signed32ClampAlias'));
 }
 for (let frame = 0; frame < numFrames; frame++) for (let fraction = 0; fraction < 4096; fraction++) assert.equal(seen.has(frame * 4096 + fraction), fraction > 0 && frame < intervalCount);
 const after = nativePhaseCursorSummary(cursor);
 assert.equal(seen.size, expectedCount); assert.equal(after.emittedCount, expectedCount); assert.equal(after.remainingCount, 0);
 assert.equal(after.nextPhase, null);
 assert.equal(after.fractionRank, 4096); assert.equal(after.intervalCursor, 0); assert.equal(after.nextFractionFx, null); assert.equal(after.exhausted, true);
 const terminal = JSON.stringify(cursor); assert.equal(nextNativePhase(cursor), null); assert.equal(nextNativePhase(cursor), null); assert.equal(JSON.stringify(cursor), terminal);
 return expectedCount;
}
const exhaustiveCounts = [exhaustive(2, 1), exhaustive(2, 3), exhaustive(3, 3)];
for (const frames of [1, 2, 512]) for (const flags of [0, 1, 2, 3]) {
 if (frames > 1 && (flags & 1)) continue;
 const cursor = createNativePhaseCursor([clip(frames, flags)]), summary = nativePhaseCursorSummary(cursor);
 assert.equal(summary.totalCount, 0); assert.equal(summary.exhausted, true); assert.equal(nextNativePhase(cursor), null);
 assert.equal(summary.skippedFractionalAliasCount, frames * 4095);
}
assert.equal(nextNativePhase(createNativePhaseCursor([])), null);
const binary = createNativePhaseCursor([clip(2, 1)]);
assert.deepEqual(take(binary, 8).map(p => p.phaseCondition.fractionFx), [2048, 1024, 3072, 512, 2560, 1536, 3584, 256]);

const metadata = [clip(3, 1, 'a'), clip(1, 3, 'zero'), clip(3, 3, 'b'), clip(4, 0, 'off'), clip(2, 1, 'c')];
const neutral = [['a', 2048], ['a', 6144], ['b', 2048], ['b', 6144], ['b', 10240], ['c', 2048]];
assert.deepEqual(take(createNativePhaseCursor(metadata), neutral.length).map(key), neutral);
const priorityCursor = createNativePhaseCursor(metadata, reference('b', 1));
const priority = take(priorityCursor, neutral.length);
assert.deepEqual(priority.map(key), [neutral[2], neutral[3], neutral[0], neutral[1], neutral[4], neutral[5]]);
assert.deepEqual(priority.map(p => p.adjacentToReference), [true, true, false, false, false, false]);
assert.deepEqual(priority.filter(p => p.adjacentToReference).map(p => p.referenceYawFx), [6434, 6434]);
assert.equal(nextNativePhase(priorityCursor).phaseCondition.fractionFx, 1024);
const wrapCursor = createNativePhaseCursor(metadata, reference('b', 0));
assert.deepEqual(nativePhaseCursorSummary(wrapCursor).nextPhase, { clip: 'b', integerFrame: 2, ordinaryKind1PeriodFx: 8192, sdkFinalWrapInterval: true });
const wrap = take(wrapCursor, neutral.length);
assert.equal(wrap[0].phaseCondition.sdkFinalWrapInterval, true);
assert.equal(wrap[1].phaseCondition.sdkFinalWrapInterval, false);
assert.deepEqual(wrap.map(key), [neutral[4], neutral[2], neutral[0], neutral[1], neutral[3], neutral[5]]);
const noWrap = take(createNativePhaseCursor(metadata, reference('a', 0)), neutral.length);
assert.deepEqual(noWrap.map(key), neutral); assert.deepEqual(noWrap.map(p => p.adjacentToReference), [true, false, false, false, false, false]);
const lastNoWrap = take(createNativePhaseCursor(metadata, reference('a', 2)), neutral.length);
assert.deepEqual(lastNoWrap.map(key), [neutral[1], neutral[0], ...neutral.slice(2)]);
assert.equal(lastNoWrap.filter(p => p.adjacentToReference).length, 1);
const lastWrap = take(createNativePhaseCursor(metadata, reference('b', 2)), neutral.length);
assert.deepEqual(lastWrap.map(key), [neutral[3], neutral[4], neutral[0], neutral[1], neutral[2], neutral[5]]);
for (const invalid of [null, {}, reference('bind', null), reference('missing', 0), reference('a', -1), reference('a', 3), reference('a', 0.5), reference('a', 0, { ready: false }), reference('a', 0, { yawFx: NaN }), reference('a', 0, { yawFx: 0.5 }), reference('a', 0, { yawFx: 2147483648 }), reference('zero', 0), reference('off', 0)]) {
 const rows = take(createNativePhaseCursor(metadata, invalid), neutral.length);
 assert.deepEqual(rows.map(key), neutral); assert(rows.every(p => !p.adjacentToReference && !Object.hasOwn(p, 'referenceYawFx')));
}
// A reference with an ambiguous clip name cannot prioritize either resource.
const duplicateClipCursor = createNativePhaseCursor([clip(2, 3, 'same'), clip(2, 3, 'same')], reference('same', 0));
assert.deepEqual(nativePhaseCursorSummary(duplicateClipCursor).priorityIntervals, []);

// Reference priority is a permutation, even with zero-interval clips between
// source resources. Every fraction still visits the entire admitted domain.
const mixed = Array.from({ length: 20 }, (_, i) => clip(1 + i % 5, i % 4, `c${i}`));
const mixedNeutral = createNativePhaseCursor(mixed), mixedCount = mixedNeutral.intervalCount;
const mixedIds = take(mixedNeutral, mixedCount).map(p => `${p.clip}:${p.phaseCondition.integerFrame}`).sort();
let referenceFractionWalks = 0;
for (const row of mixed) for (let frame = 0; frame < row.numFrames; frame++) {
 const cursor = createNativePhaseCursor(mixed, reference(row.clip, frame));
 for (let rank = 1; rank <= 8; rank++) {
  const proposals = take(cursor, mixedCount);
  assert.deepEqual(proposals.map(p => `${p.clip}:${p.phaseCondition.integerFrame}`).sort(), mixedIds);
  assert(proposals.every(p => p.phaseCondition.fractionFx === reverse12(rank)));
  const adjacent = proposals.filter(p => p.adjacentToReference);
  assert(adjacent.length <= 2); assert(adjacent.every(p => p.clip === row.clip));
  referenceFractionWalks++;
 }
}
const wrappedReference = createNativePhaseCursor([clip(2, 3)], reference('stand.nsbca', 0)), wrappedSeen = new Set();
while (!wrappedReference.exhausted) {
 const p = nextNativePhase(wrappedReference);
 assert(!wrappedSeen.has(p.phaseFx)); wrappedSeen.add(p.phaseFx);
}
assert.equal(wrappedSeen.size, 8190);

// Both JSON and structured cloning resume exactly, including within a fraction
// and immediately before/after the terminal transition. No function closures.
for (const initial of [createNativePhaseCursor([clip(2, 3)], reference('stand.nsbca', 0)), createNativePhaseCursor(metadata, reference('b', 0))]) {
 const cursor = structuredClone(initial);
 for (let n = 0; !cursor.exhausted; n++) {
  if ([0, 1, 2, 3, 7, 4094, 4095, 4096, cursor.totalCount - 2, cursor.totalCount - 1].includes(n)) {
   const json = JSON.parse(JSON.stringify(cursor)), cloned = structuredClone(cursor);
   for (let k = 0; k < Math.min(9, cursor.totalCount - cursor.emittedCount); k++) assert.deepEqual(nextNativePhase(json), nextNativePhase(cloned));
   assert.deepEqual(nativePhaseCursorSummary(json), nativePhaseCursorSummary(cloned));
   const expected = structuredClone(cursor);
   for (let k = 0; k < 9 && !expected.exhausted; k++) {
    const resumed = JSON.parse(JSON.stringify(expected));
    assert.deepEqual(nextNativePhase(expected), nextNativePhase(resumed));
    assert.deepEqual(expected, resumed);
   }
  }
  nextNativePhase(cursor);
 }
 assert.equal(nextNativePhase(JSON.parse(JSON.stringify(cursor))), null);
}
const source = [clip(3, 3, 'owned', { actionCondition: { assumptions: ['source only'], nested: { currentActionKnown: false } } })];
const hint = reference('owned', 1), first = createNativePhaseCursor(source, hint), second = createNativePhaseCursor(source, hint);
const inputBefore = JSON.stringify(source), hintBefore = JSON.stringify(hint);
const firstProposal = nextNativePhase(first);
assert.equal(JSON.stringify(source), inputBefore); assert.equal(JSON.stringify(hint), hintBefore);
source[0].clip = 'changed'; source[0].numFrames = 1; source[0].resourceFlags = 0; source[0].resourceSHA256 = 'b'.repeat(64);
source[0].actionCondition.assumptions[0] = 'changed'; hint.frame = 0; hint.yawFx = 0;
assert.deepEqual(firstProposal, nextNativePhase(second));
firstProposal.actionCondition.assumptions[0] = 'mutated return'; firstProposal.phaseCondition.resourceFlags = 0;
const summary = nativePhaseCursorSummary(first); summary.priorityIntervals[0] = 999; summary.clips[0].resourceFlags = 0; summary.clips[0].signed32ClampAliases[0].minPhaseFx = 0;
assert.deepEqual(nextNativePhase(first), nextNativePhase(second));
first.clips[0].actionCondition.assumptions[0] = 'mutated cursor';
assert.equal(nextNativePhase(second).actionCondition.assumptions[0], 'source only');

for (const badFlags of [-1, 4, 256, 4294967296, 1.5, NaN, null, undefined, '3']) assert.throws(() => createNativePhaseCursor([clip(2, badFlags)]), /resource flags/);
for (const badFrames of [0, 513, 2.5, NaN, null, undefined, '2']) assert.throws(() => createNativePhaseCursor([clip(badFrames, 3)]), /numFrames/);
assert.throws(() => createNativePhaseCursor([clip(2, 3, 'bind')]), /non-bind/);
assert.throws(() => createNativePhaseCursor([clip(2, 3, 'x', { resourceSHA256: 'unknown' })]), /SHA256/);
assert.throws(() => createNativePhaseCursor([clip(2, 3, 'x', { actionCondition: new Map() })]), /Plain/);
const cyclic = {}; cyclic.cyclic = cyclic;
assert.throws(() => createNativePhaseCursor([clip(2, 3, 'x', { actionCondition: cyclic })]), /Acyclic/);
assert.throws(() => nextNativePhase({}), /cursor required/);
const corrupted = createNativePhaseCursor([clip(2, 3)]); corrupted.emittedCount = 1;
assert.throws(() => nextNativePhase(corrupted), /Inconsistent/);

const large = createNativePhaseCursor([clip(512, 3)], reference('stand.nsbca', 0));
const largeSummary = nativePhaseCursorSummary(large);
assert.equal(largeSummary.totalCount, 512 * 4095); assert.equal(largeSummary.sourcePhaseCount, 512 * 4096);
assert.deepEqual(largeSummary.clips[0].signed32ClampAliases, [{ minPhaseFx: -2147483648, maxPhaseFx: 0, clampedPhaseFx: 0 }, { minPhaseFx: 2097151, maxPhaseFx: 2147483647, clampedPhaseFx: 2097151 }]);
assert(JSON.stringify(large).length < 1200);
function checkArrayBounds(value) {
 if (!value || typeof value !== 'object') return;
 if (Array.isArray(value)) assert(value.length <= 2, 'No eager fraction or interval arrays in the single-clip cursor');
 for (const item of Object.values(value)) checkArrayBounds(item);
}
checkArrayBounds(large);
assert.deepEqual(take(large, 3).map(p => p.phaseFx), [511 * 4096 + 2048, 2048, 4096 + 2048]);
assert.equal(nativePhaseCursorSummary(large).currentPhaseKnown, false);
assert.equal(nativePhaseCursorSummary(large).fieldReachabilityProven, false);
console.log(JSON.stringify({ passed: true, exhaustiveSourcePhaseProposals: exhaustiveCounts, all4095FractionValuesChecked: true, flags0and2AndF1AddNoProposals: true, wrapAndNoWrapSeparated: true, adjacentReferenceOnlyOrders: true, referenceFractionWalks, exhaustiveWrappedReferencePhases: wrappedSeen.size, serializedCursorResumeExact: true, ownershipIsolated: true, millionEntryBankAbsent: true, fullSigned32ClampAliasesRetained: true, sdkFinalWrapSeparatedFromOrdinaryKind1: true, currentPhaseKnown: false, fieldReachabilityProven: false }));
