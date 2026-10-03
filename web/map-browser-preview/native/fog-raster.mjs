/* Copyright (C) 2009-2025 DeSmuME team (rasterizer).
 * Copyright (C) 2016-2025 DeSmuME team (colorspace).
 * JavaScript adaptation and explicit input contracts: this submission, 2026.
 * GPL version 2 or, at your option, any later version. No warranty.
 */
/** Integer fog subset of DeSmuME core 535f676778dff6e2cbd57ff8468b4a9846d23933.
 * Derived from rasterize.cpp::_UpdateFogTable / RenderEdgeMarkingAndFog and
 * utils/colorspacehandler/colorspacehandler.cpp. GPL-2.0-or-later; see licenses.
 * Input is POST-raster depth24 / fragment fog mask / RGBA6665, not Euclidean distance.
 */
function intRange(n, lo, hi, label) {
  if (!Number.isInteger(n) || n < lo || n > hi) throw new RangeError(`${label}: ${lo}..${hi} integer required`);
}
const clampDepth = x => Math.max(0,Math.min(32768,x));
const promote = n => n >= 127 ? 128 : n;

/** Exact LUT for observed shifts0/1, also deterministic core branch shifts0..10.
 * Shifts11..15 leave one slot untouched in this pinned core; no invented initialization.
 */
export function buildFogTable({density, offset, shift}, previousTable = null) {
  if (!(density instanceof Uint8Array) || density.length !== 32) throw new TypeError('32-byte density');
  intRange(offset,-2147483648,2147483647,'offset'); intRange(shift,0,15,'shift');
  const off=clampDepth(offset), step=0x400 >> shift;
  if (step === 0 && !(previousTable instanceof Uint8Array && previousTable.length === 32768)) {
    throw new RangeError('ZERO_STEP_NEEDS_PREVIOUS_TABLE: pinned core retains one LUT slot');
  }
  const table=step === 0 ? previousTable.slice() : new Uint8Array(32768);
  if (step === 0) {
    table.fill(promote(density[0]),0,off);
    table.fill(promote(density[31]),clampDepth(off + 1));
    return table;
  }
  const inv=10-shift, lo=clampDepth(off + step + 1), hi=clampDepth(off + 32 * step + 1);
  table.fill(promote(density[0]),0,lo);
  for (let depth=lo;depth<hi;++depth) {
    const diff=depth-off+(step-1), interp=(diff & ~(step-1))+off-depth, idx=(diff >> inv)-1;
    const w=((interp*density[idx-1])+((step-interp)*density[idx])) >> inv;
    table[depth]=promote(w);
  }
  table.fill(promote(density[31]),hi);
  return table;
}

export function rgb555To6665(color) {
  intRange(color,0,0xffffffff,'color');
  const expand=x => x === 0 ? 0 : 2*x+1;
  return [expand(color & 31),expand((color >>> 5)&31),expand((color >>> 10)&31),(color >>> 16)&31];
}

/** Returns [r6,g6,b6,a5]; caller has already performed edge marking.
 * Inputs to this function must reflect native polygon/shadow/alpha/depth acceptance.
 */
export function applyFogPixel(rgba, depth24, isFogged, parameters, table) {
  if ((!Array.isArray(rgba) && !(rgba instanceof Uint8Array)) || rgba.length !== 4) throw new TypeError('RGBA6665');
  rgba.forEach((n,i)=>intRange(n,0,i === 3 ? 31 : 63,`channel${i}`));
  intRange(depth24,0,0xffffff,'depth24');
  if (!(table instanceof Uint8Array) || table.length !== 32768) throw new TypeError('32768-byte fog table');
  const out=Array.from(rgba);
  if (!parameters.enabled) return out;
  const w=isFogged ? table[depth24 >>> 9] : 0, f=rgb555To6665(parameters.color);
  if (!parameters.alphaOnly) for(let c=0;c<3;++c) out[c]=((128-w)*out[c]+f[c]*w) >> 7;
  out[3]=((128-w)*out[3]+f[3]*w) >> 7;
  return out;
}

/** Invoke only AFTER the original rasterizer has accepted this fragment.
 * Shaded alpha31 replaces the mask; accepted translucent alpha1..30 ANDs it.
 * Rejected depth/alpha/duplicate-ID/shadow fragments must NOT call this function.
 */
export function fogMaskAfterAcceptedFragment(previousFogged, polygonFogEnabled, shadedAlpha) {
  intRange(shadedAlpha,1,31,'accepted shaded alpha');
  return shadedAlpha === 31 ? !!polygonFogEnabled : !!previousFogged && !!polygonFogEnabled;
}
