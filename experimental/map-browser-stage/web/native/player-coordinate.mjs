// Pure coordinate arithmetic. Image estimates are never native-coordinate proof,
// party identity, visibility, movement consumption, or an AT-ledger update.
const finite = n => typeof n === 'number' && Number.isFinite(n);
const MIN_RAW = -0x80000000, MAX_RAW = 0x7fffffff;

/** Signed 20.12 fixed point, split exactly as unsigned LE low/high halfwords.
 * Negative values require floor chunks: -28 = (-1)*65536 + 65508.
 * A chunk is 16 coordinate units; local range is [0, 16-1/4096].
 */
export function splitFixedCoordinate(rawSigned32) {
  if (!Number.isInteger(rawSigned32) || rawSigned32 < MIN_RAW || rawSigned32 > MAX_RAW) throw Error('Expected signed 32-bit fixed-point word');
  const rawUnsigned32 = rawSigned32 >>> 0;
  const chunkSigned16 = Math.floor(rawSigned32 / 65536);
  const chunkUnsigned16 = rawUnsigned32 >>> 16;
  const localRaw16 = rawUnsigned32 & 0xffff;
  return {rawSigned32, rawUnsigned32, chunkSigned16, chunkUnsigned16, localRaw16,
    local: localRaw16 / 4096, map: rawSigned32 / 4096, denominator: 4096};
}

/** Inclusive signed-word interval. Keep each wrapped low16 range with its own
 * signed chunk; a display cap never removes the full range of possibilities.
 * Packing is exact arithmetic, not certification of an image-derived bound.
 */
export function splitFixedInterval(rawMin,rawMax,{maxChunks=16}={}) {
  if(!Number.isInteger(rawMin)||!Number.isInteger(rawMax)||rawMin<MIN_RAW||rawMax>MAX_RAW||rawMin>rawMax)throw Error('Expected an ordered signed 32-bit interval');
  if(!Number.isInteger(maxChunks)||maxChunks<1||maxChunks>32)throw Error('Expected a chunk display cap from 1 through 32');
  const chunkSignedMin=Math.floor(rawMin/65536),chunkSignedMax=Math.floor(rawMax/65536),chunkCount=chunkSignedMax-chunkSignedMin+1,chunks=[];
  for(let chunk=chunkSignedMin;chunk<=chunkSignedMax&&chunks.length<maxChunks;chunk++){
    const min=Math.max(0,rawMin-chunk*65536),max=Math.min(65535,rawMax-chunk*65536);
    chunks.push({chunkSigned16:chunk,chunkUnsigned16:(chunk+65536)%65536,localRaw16:{min,max},local:{min:min/4096,max:max/4096}});
  }
  return {rawMin,rawMax,worldMin:rawMin/4096,worldMax:rawMax/4096,chunkSignedMin,chunkSignedMax,chunkCount,chunks,complete:chunks.length===chunkCount,omittedChunks:chunkCount-chunks.length,packingMathematicallyVerified:true,calibratedCoverage:false};
}

/** Matches the Lua shortest signed chunk difference; half-range is ambiguous. */
export function chunkDifference(fromUnsigned16, toUnsigned16) {
  if (![fromUnsigned16, toUnsigned16].every(n => Number.isInteger(n) && n >= 0 && n <= 65535)) throw Error('Expected unsigned 16-bit chunks');
  const wrapped = ((toUnsigned16 - fromUnsigned16 + 32768) % 65536 + 65536) % 65536 - 32768;
  return {difference: wrapped, halfRangeAmbiguous: wrapped === -32768};
}

function estimateSplit(value) {
  const raw = Math.round(value * 4096);
  if (raw < MIN_RAW || raw > MAX_RAW) return null;
  return {...splitFixedCoordinate(raw), approximate: true, quantization: 'nearest-fixed-point-estimate-not-a-memory-read'};
}

function interval(min, max) {
  const rawMin = Math.floor(min * 4096), rawMax = Math.ceil(max * 4096);
  const inRange = rawMin >= MIN_RAW && rawMax <= MAX_RAW;
  return {min, max, rawMin, rawMax, inSigned32Range: inRange,
    chunkSignedMin: Math.floor(rawMin / 65536), chunkSignedMax: Math.floor(rawMax / 65536),
    crossesChunkBoundary: Math.floor(rawMin / 65536) !== Math.floor(rawMax / 65536),
    chunkIntervals: inRange ? splitFixedInterval(rawMin,rawMax) : null,
    calibratedCoverage: false};
}

/** Invert only a caller-supplied candidate descriptor transform.
 * imageX/imageY and bounds MUST already be in composed-map pixel-edge space,
 * after capture resize/camera registration. Map Y is game Z, not game height Y.
 * Even a supplied transformVerified:true cannot promote this candidate to proof.
 */
export function imageToMapCoordinateCandidate({imageX, imageY, originPixel, scale,
  mapId = null, markerIdentity = null, imageBounds = null}) {
  if (![imageX, imageY, scale].every(finite) || scale <= 0 || !Array.isArray(originPixel)
      || originPixel.length !== 2 || !originPixel.every(finite)) throw Error('Finite image coordinates and explicit positive-scale descriptor required');
  if (imageBounds && (![imageBounds.left, imageBounds.top, imageBounds.right, imageBounds.bottom].every(finite)
      || imageBounds.left > imageBounds.right || imageBounds.top > imageBounds.bottom)) throw Error('Invalid image bounds');
  const x = (imageX + originPixel[0]) / scale, z = (imageY + originPixel[1]) / scale;
  if (![x, z].every(finite)) throw Error('Coordinate transform overflow');
  const bounds = imageBounds ? {
    x: interval((imageBounds.left + originPixel[0]) / scale, (imageBounds.right + originPixel[0]) / scale),
    z: interval((imageBounds.top + originPixel[1]) / scale, (imageBounds.bottom + originPixel[1]) / scale)
  } : null;
  const splitX = estimateSplit(x), splitZ = estimateSplit(z);
  return {kind: 'approximate-map-coordinate-candidate', mapId, markerIdentity,
    x, z, splitX, splitZ, bounds, approximate: true,
    packingMathematicallyVerified: true, transformVerified: false,
    playerIdentityProven: false, temporalAlignmentVerified: false,
    visibilityKnown: false, minimumProvenATCalls: 0,
    ambiguity: {identity: true, transform: true, imageErrorUncalibrated: true,
      chunkBoundary: !!(bounds?.x.crossesChunkBoundary || bounds?.z.crossesChunkBoundary),
      outOfFixedPointRange: !splitX || !splitZ},
    axisConvention: 'image-right→game+X; image-down→game+Z for this supplied transform; gameY omitted',
    formula: 'X=(imageX+originPixelX)/scale; Z=(imageY+originPixelY)/scale'};
}
