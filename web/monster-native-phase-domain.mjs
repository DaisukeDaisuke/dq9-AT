// Enumerate conditional source FX12 phases, never infer a live field phase.
// Stored integer phases are covered elsewhere. Resource-flag aliases add no
// proposals. A bit-reversal fraction walk is complete, not a sampling grid.
const FX12 = 4096, FRACTIONS = FX12 - 1;
const MIN_I32 = -2147483648, MAX_I32 = 2147483647;
const KIND = 'conditional-source-native-FX12-phase-cursor-v1';
const need = (value, message) => { if (!value) throw Error(message); };
const signed32 = n => Number.isInteger(n) && n >= MIN_I32 && n <= MAX_I32;
const reverse12 = n => {
 let result = 0;
 for (let bit = 0; bit < 12; bit++) { result = (result << 1) | (n & 1); n >>>= 1; }
 return result;
};
// Metadata must remain plain, independently owned, and JSON-resumable.
function copyPlain(value, ancestors = new Set()) {
 if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
 if (typeof value === 'number') { need(Number.isFinite(value), 'Finite native phase metadata required'); return value; }
 need(value && typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), 'Plain native phase metadata required');
 need(!ancestors.has(value), 'Acyclic native phase metadata required');
 ancestors.add(value);
 const result = Array.isArray(value)
  ? Array.from(value, item => copyPlain(item, ancestors))
  : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyPlain(item, ancestors)]));
 ancestors.delete(value);
 return result;
}
function referencePriority(clips, reference) {
 const empty = { intervals: [], yawFx: null };
 if (reference?.ready !== true || reference.clip === 'bind' || !Number.isInteger(reference.frame) || !signed32(reference.yawFx)) return empty;
 const matches = clips.filter(row => row.clip === reference.clip);
 if (matches.length !== 1) return empty;
 const row = matches[0], frame = reference.frame;
 if (frame < 0 || frame >= row.numFrames || !row.intervalCount) return empty;
 const preceding = frame === 0 ? ((row.resourceFlags & 2) ? row.numFrames - 1 : -1) : frame - 1;
 const intervals = [...new Set([preceding, frame].filter(interval => interval >= 0 && interval < row.intervalCount).map(interval => row.intervalOffset + interval))];
 return { intervals, yawFx: intervals.length ? reference.yawFx : null };
}
/** The caller verifies the source resources; this helper retains that metadata.
 * Each fraction visits every admitted interval before the next fraction. Only
 * O(clips) metadata and up to two reference-adjacent interval IDs are retained.
 * The returned object is mutable cursor state and survives JSON round trips. */
export function createNativePhaseCursor(clips, reference = null) {
 need(Array.isArray(clips), 'Native phase clip metadata array required');
 let intervalCount = 0, sourcePhaseCount = 0, storedIntegerCount = 0;
 const owned = clips.map(input => {
  need(input && typeof input.clip === 'string' && input.clip.length > 0 && input.clip !== 'bind', 'Named non-bind native phase clip required');
  need(Number.isInteger(input.numFrames) && input.numFrames >= 1 && input.numFrames <= 512, 'Native phase numFrames must be 1..512');
  need(Number.isInteger(input.resourceFlags) && input.resourceFlags >= 0 && input.resourceFlags <= 3, 'Unknown native phase resource flags');
  need(typeof input.resourceSHA256 === 'string' && /^[a-f0-9]{64}$/i.test(input.resourceSHA256), 'Native phase resource SHA256 required');
  const count = (input.resourceFlags & 1) && input.numFrames > 1 ? input.numFrames - 1 + ((input.resourceFlags & 2) ? 1 : 0) : 0;
  const row = { clip: input.clip, numFrames: input.numFrames, resourceFlags: input.resourceFlags, resourceSHA256: input.resourceSHA256, intervalOffset: intervalCount, intervalCount: count };
  if (input.actionCondition !== undefined) row.actionCondition = copyPlain(input.actionCondition);
  intervalCount += count;
  sourcePhaseCount += input.numFrames * FX12;
  storedIntegerCount += input.numFrames;
  return row;
 });
 const totalCount = intervalCount * FRACTIONS;
 need(Number.isSafeInteger(sourcePhaseCount) && Number.isSafeInteger(totalCount), 'Exact native phase domain count exceeded');
 const priority = referencePriority(owned, reference);
 return {
  kind: KIND, clips: owned, priorityIntervals: priority.intervals, referenceYawFx: priority.yawFx,
  intervalCount, sourcePhaseCount, storedIntegerCount, totalCount, emittedCount: 0,
  fractionRank: intervalCount ? 1 : FX12, intervalCursor: 0, exhausted: totalCount === 0,
 };
}
function checkCursor(cursor) {
 need(cursor?.kind === KIND && Array.isArray(cursor.clips) && Array.isArray(cursor.priorityIntervals), 'Native phase cursor required');
 need(Number.isInteger(cursor.intervalCount) && cursor.intervalCount >= 0 && Number.isSafeInteger(cursor.totalCount) && cursor.totalCount === cursor.intervalCount * FRACTIONS, 'Invalid native phase domain count');
 need(Number.isInteger(cursor.fractionRank) && cursor.fractionRank >= 1 && cursor.fractionRank <= FX12 && Number.isInteger(cursor.intervalCursor) && cursor.intervalCursor >= 0, 'Invalid native phase cursor position');
 need(cursor.emittedCount === (cursor.fractionRank - 1) * cursor.intervalCount + cursor.intervalCursor && cursor.emittedCount <= cursor.totalCount, 'Inconsistent native phase cursor position');
 need(cursor.exhausted === (cursor.emittedCount === cursor.totalCount) && (cursor.exhausted ? cursor.fractionRank === FX12 && cursor.intervalCursor === 0 : cursor.intervalCursor < cursor.intervalCount), 'Inconsistent native phase cursor exhaustion');
}
function intervalAt(cursor) {
 let index;
 if (cursor.intervalCursor < cursor.priorityIntervals.length) index = cursor.priorityIntervals[cursor.intervalCursor];
 else {
  index = cursor.intervalCursor - cursor.priorityIntervals.length;
  // Skip the at-most-two priority IDs without making an interval bank.
  for (const priority of cursor.priorityIntervals.slice().sort((a, b) => a - b)) if (index >= priority) index++;
 }
 let low = 0, high = cursor.clips.length;
 while (low < high) {
  const mid = Math.floor((low + high) / 2), row = cursor.clips[mid];
  if (index >= row.intervalOffset + row.intervalCount) low = mid + 1;
  else high = mid;
 }
 const row = cursor.clips[low];
 need(row && index >= row.intervalOffset && index < row.intervalOffset + row.intervalCount, 'Native phase interval is outside its source domain');
 return { row, integerFrame: index - row.intervalOffset, adjacentToReference: cursor.intervalCursor < cursor.priorityIntervals.length };
}
export function nextNativePhase(cursor) {
 checkCursor(cursor);
 if (cursor.exhausted) return null;
 const { row, integerFrame, adjacentToReference } = intervalAt(cursor);
 const fractionFx = reverse12(cursor.fractionRank), phaseFx = integerFrame * FX12 + fractionFx;
 const nextFrame = integerFrame + 1 === row.numFrames ? 0 : integerFrame + 1;
 const phaseCondition = {
  kind: 'conditional-source-native-FX12-phase', resourceSHA256: row.resourceSHA256, resourceFlags: row.resourceFlags,
  sourcePhaseDomain: 'SDK-J0AC-wrapper-input', ordinaryKind1PeriodFx: (row.numFrames - 1) * FX12, sdkFinalWrapInterval: integerFrame === row.numFrames - 1,
  phaseFx, clampedPhaseFx: phaseFx, integerFrame, fractionFx, nextFrame,
  interpolationEnabled: true, currentPhaseKnown: false, defaultCallbackAssumed: true, fieldReachabilityProven: false,
 };
 // Source signed32 values above the last representable phase clamp here. The
 // lower endpoint aliases the already-covered stored integer phase zero.
 if (phaseFx === row.numFrames * FX12 - 1) phaseCondition.signed32ClampAlias = { minPhaseFx: phaseFx, maxPhaseFx: MAX_I32, clampedPhaseFx: phaseFx };
 const proposal = { clip: row.clip, frame: null, phaseFx, adjacentToReference, phaseCondition };
 if (row.actionCondition !== undefined) proposal.actionCondition = copyPlain(row.actionCondition);
 if (adjacentToReference) proposal.referenceYawFx = cursor.referenceYawFx;
 cursor.emittedCount++;
 cursor.intervalCursor++;
 if (cursor.intervalCursor === cursor.intervalCount) { cursor.intervalCursor = 0; cursor.fractionRank++; }
 cursor.exhausted = cursor.emittedCount === cursor.totalCount;
 return proposal;
}
export function nativePhaseCursorSummary(cursor) {
 checkCursor(cursor);
 const next = cursor.exhausted ? null : intervalAt(cursor);
 return {
  kind: KIND, sourcePhaseDomain: 'SDK-J0AC-wrapper-input', clampedPhaseDomain: 'FX12-0-through-numFrames-times-4096-minus-1',
  nextPhase: next ? { clip: next.row.clip, integerFrame: next.integerFrame, ordinaryKind1PeriodFx: (next.row.numFrames - 1) * FX12, sdkFinalWrapInterval: next.integerFrame === next.row.numFrames - 1 } : null,
  fractionOrder: 'reverse12-ranks-1-through-4095', fractionCount: FRACTIONS,
  intervalCount: cursor.intervalCount, sourcePhaseCount: cursor.sourcePhaseCount, storedIntegerCount: cursor.storedIntegerCount,
  skippedFractionalAliasCount: cursor.sourcePhaseCount - cursor.storedIntegerCount - cursor.totalCount,
  totalCount: cursor.totalCount, emittedCount: cursor.emittedCount, remainingCount: cursor.totalCount - cursor.emittedCount,
  fractionRank: cursor.fractionRank, intervalCursor: cursor.intervalCursor,
  nextFractionFx: cursor.exhausted ? null : reverse12(cursor.fractionRank), exhausted: cursor.exhausted,
  priorityIntervals: cursor.priorityIntervals.slice(), referenceYawFx: cursor.referenceYawFx,
  currentPhaseKnown: false, defaultCallbackAssumed: true, fieldReachabilityProven: false,
  clips: cursor.clips.map(row => ({
   clip: row.clip, numFrames: row.numFrames, resourceFlags: row.resourceFlags, resourceSHA256: row.resourceSHA256,
   sourcePhaseDomain: 'SDK-J0AC-wrapper-input', ordinaryKind1PeriodFx: (row.numFrames - 1) * FX12, sdkFinalWrapIntervalIncluded: row.numFrames > 1 && row.intervalCount === row.numFrames,
   intervalOffset: row.intervalOffset, intervalCount: row.intervalCount, totalCount: row.intervalCount * FRACTIONS,
   signed32ClampAliases: [
    { minPhaseFx: MIN_I32, maxPhaseFx: 0, clampedPhaseFx: 0 },
    { minPhaseFx: row.numFrames * FX12 - 1, maxPhaseFx: MAX_I32, clampedPhaseFx: row.numFrames * FX12 - 1 },
   ],
  })),
 };
}
