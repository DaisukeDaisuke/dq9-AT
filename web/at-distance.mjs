// Inverse index for the existing full-period AT LCG. This maps an already
// constrained state to an index; it does not recover state from video.
const A = 0x41c64e6d, C = 0x3039;
const u32 = (n, label) => {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw Error(`${label} must be uint32`);
  return n >>> 0;
};

/** O(32) bit lifting: T^(2^k) preserves bits below k and flips bit k.
 * Full-period conditions hold: C odd and A=1 mod4 for modulus2^32.
 * The returned draw index is modulo2^32, never an elapsed-time estimate.
 */
export function atIndexModuloCycle(initialSeed, currentState) {
  let state = u32(initialSeed, 'initialSeed');
  const target = u32(currentState, 'currentState');
  let mul = A, add = C, index = 0;
  for (let bit = 0; bit < 32; bit++) {
    if (((state ^ target) >>> bit) & 1) {
      state = (Math.imul(state, mul) + add) >>> 0;
      index += 2 ** bit;
    }
    add = Math.imul(add, (mul + 1) >>> 0) >>> 0;
    mul = Math.imul(mul, mul) >>> 0;
  }
  if (state !== target) throw Error('AT inverse index verification failed');
  return {indexModuloCycle: index, period: 4294967296,
    absoluteIndexKnown: false, absoluteIndices: `${index} + k*4294967296 (k >= 0)`};
}

/** Output15 alone cannot distinguish the states separated by bit31.
 * This equivalence applies to outputs/consumers proven to use only output15.
 */
export function atOutputEquivalentIndices(initialSeed, candidateState) {
  const state = u32(candidateState, 'candidateState');
  return {states: [state, (state ^ 0x80000000) >>> 0],
    indices: [atIndexModuloCycle(initialSeed, state), atIndexModuloCycle(initialSeed, (state ^ 0x80000000) >>> 0)],
    output15Equivalent: true, fullStateUnique: false,
    applicability: 'same consumption path; only consumers using the returned15bit value'};
}
