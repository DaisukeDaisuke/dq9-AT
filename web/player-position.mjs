// Browser-only marker candidates and image-space trajectories. No emulator/RAM input,
// movement-count arithmetic, spawn inference, or mutation of the AT proof ledger.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clone = value => structuredClone(value);

/** RGB is calibrated from this capture source, not a universal DQ9 leader color.
 * Coordinates use pixel edges: pixel (x,y) has center (x+.5,y+.5).
 * Connected components are candidates, even when only one matches the profile.
 */
export function markerColorCandidates(frame, profile) {
  const {width, height, rgba} = frame;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba?.length !== width * height * 4) throw Error('Expected a complete RGBA upper-screen frame');
  if (!profile?.id || !Array.isArray(profile.rgb) || profile.rgb.length !== 3 || !profile.rgb.every(x => finite(x) && x >= 0 && x <= 255)) throw Error('Explicit source-calibrated marker color profile required');
  const {tolerance = 12, minimumPixels = 3, maximumPixels = 128, maximumExtent = 20, excluded = []} = profile;
  const mask = new Uint8Array(width * height), seen = new Uint8Array(mask.length), candidates = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (excluded.some(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h)) continue;
    const i = y * width + x, p = i * 4;
    mask[i] = rgba[p + 3] > 0 && profile.rgb.every((v, c) => Math.abs(rgba[p + c] - v) <= tolerance) ? 1 : 0;
  }
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const pending = [start]; seen[start] = 1;
    let pixels = 0, sx = 0, sy = 0, minX = width, minY = height, maxX = -1, maxY = -1;
    for (let n = 0; n < pending.length; n++) {
      const i = pending[n], x = i % width, y = Math.floor(i / width);
      pixels++; sx += x + .5; sy += y + .5;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (mask[next] && !seen[next]) { seen[next] = 1; pending.push(next); }
      }
    }
    if (pixels < minimumPixels || pixels > maximumPixels || maxX - minX + 1 > maximumExtent || maxY - minY + 1 > maximumExtent) continue;
    candidates.push({id: `component:${start}`, profileId: profile.id, x: sx / pixels, y: sy / pixels, pixels,
      bounds: {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1},
      // Color centroid need not equal the glyph anchor if clipped or occluded.
      uncertaintyPixels: {x: (maxX - minX + 1) / 2, y: (maxY - minY + 1) / 2},
      identity: 'unverified-marker-candidate', confidenceCalibrated: false});
  }
  return {profileId: profile.id, frame: {width, height}, candidates, resolvedIdentity: false, confidenceCalibrated: false};
}

/** Preserve the cross product of all registration peaks and all marker candidates.
 * The exact matcher resize dimensions, rather than the requested scale alone,
 * define the inverse pixel-edge transform. No peak pruning or world transform.
 */
export function playerPositionSample({stamp, frame, registrationFrame, registration, markers, mapNameObservation = null}) {
  if (!stamp?.streamId || !Number.isSafeInteger(stamp.frameSerial) || !finite(stamp.videoTime) || typeof stamp.capturedAt !== 'string') throw Error('A capture stream, frame serial, video time, and capture timestamp are required');
  if (!Number.isInteger(frame?.width) || !Number.isInteger(frame?.height) || frame.width <= 0 || frame.height <= 0) throw Error('Frame dimensions are required');
  if (!Number.isInteger(registrationFrame?.width) || !Number.isInteger(registrationFrame?.height) || registrationFrame.width <= 0 || registrationFrame.height <= 0) throw Error('Explicit registration-frame dimensions are required');
  if (markers?.frame?.width !== frame.width || markers?.frame?.height !== frame.height) throw Error('Marker source dimensions do not match the capture frame');
  const frameScaleX = registrationFrame.width / frame.width, frameScaleY = registrationFrame.height / frame.height;
  const markerCandidates = markers?.candidates ?? [], peaks = registration?.candidates ?? [];
  const mapIds = [...new Set((mapNameObservation?.candidates ?? []).flatMap(c => c.mapIds ?? []))];
  const mapIdentity = mapNameObservation ? {
    status: mapIds.length ? (mapIds.includes(registration?.mapId) ? 'candidate-compatible' : 'candidate-conflict') : 'unresolved',
    candidateMapIds: mapIds, observedAt: mapNameObservation.capturedAt ?? null,
    videoTime: mapNameObservation.videoTime ?? null, frameSerial: mapNameObservation.frameSerial ?? null,
    // OCR scores/margins are not calibrated probabilities; timestamp is separate.
    candidates: clone(mapNameObservation.candidates ?? []), confidenceCalibrated: false,
    synchronized: mapNameObservation.frameSerial === stamp.frameSerial && mapNameObservation.videoTime === stamp.videoTime
  } : {status: 'unobserved', candidateMapIds: [], confidenceCalibrated: false, synchronized: false};
  const candidates = [];
  if (registration?.imageWidth > 0 && registration?.imageHeight > 0) for (let p = 0; p < peaks.length; p++) {
    const peak = peaks[p]; if (!(peak.scale > 0) || ![peak.dx, peak.dy, peak.score].every(finite)) continue;
    const scaleX = Math.round(registration.imageWidth * peak.scale) / registration.imageWidth;
    const scaleY = Math.round(registration.imageHeight * peak.scale) / registration.imageHeight;
    if (!(scaleX > 0 && scaleY > 0)) continue;
    for (const marker of markerCandidates) {
      if (![marker.x, marker.y].every(finite)) continue;
      const x = (marker.x * frameScaleX - peak.dx) / scaleX, y = (marker.y * frameScaleY - peak.dy) / scaleY;
      const ux = ((marker.uncertaintyPixels?.x ?? 0) * frameScaleX + 1) / scaleX;
      const uy = ((marker.uncertaintyPixels?.y ?? 0) * frameScaleY + 1) / scaleY;
      candidates.push({markerId: marker.id, profileId: marker.profileId, registrationPeak: p,
        mapId: registration.mapId ?? null, descriptor: registration.descriptor ?? null,
        coordinateSpace: 'ROM-composed-image-pixel-edges', x, y,
        bounds: {left: x - ux, top: y - uy, right: x + ux, bottom: y + uy},
        registrationScore: peak.score, registrationAccepted: !!registration.resolved && p === 0,
        insideImage: x >= 0 && x <= registration.imageWidth && y >= 0 && y <= registration.imageHeight,
        uncertaintyBasis: 'component extent plus one registration-grid pixel; not a calibrated error bound'});
    }
  }
  return {kind: 'player-position-candidates', stamp: clone(stamp), frame: {width: frame.width, height: frame.height}, registrationFrame: clone(registrationFrame),
    reference: {mapId: registration?.mapId ?? null, descriptor: registration?.descriptor ?? null, epoch: stamp.referenceEpoch ?? null},
    status: !markerCandidates.length ? 'occluded-or-not-detected' : !peaks.length || !registration?.resolved ? 'registration-unresolved' : markerCandidates.length > 1 ? 'marker-ambiguous' : mapIdentity.status === 'candidate-conflict' ? 'map-identity-conflict' : 'candidate',
    markerCandidates: clone(markerCandidates), registration: clone(registration ?? null), mapIdentity, candidates,
    worldPositionKnown: false, playerIdentityProven: false, temporalAlignmentVerified: false,
    minimumProvenATCalls: 0, confidenceCalibrated: false};
}

/** A gap/map change starts a new segment; never interpolate through it or reset AT.
 * This owns no AT session and therefore cannot increase/reset either AT bound.
 */
export class PlayerTrajectory {
  constructor() { this.samples = []; this.segment = 0; }
  append(sample) {
    const previous = this.samples.at(-1), current = clone(sample), reasons = [];
    if (previous) {
      const a = previous.stamp, b = current.stamp;
      if (a.streamId !== b.streamId) reasons.push('capture-stream-changed');
      else if (b.frameSerial <= a.frameSerial || b.videoTime < a.videoTime) reasons.push('capture-discontinuity');
      if (a.referenceEpoch !== b.referenceEpoch || previous.reference?.mapId !== current.reference?.mapId) reasons.push('reference-map-changed');
      if (previous.status === 'gap' || current.status === 'gap') reasons.push('video-gap');
      if (!previous.candidates?.length || !current.candidates?.length) reasons.push('unobserved-position');
    }
    if (reasons.length) this.segment++;
    current.segment = this.segment;
    current.continuity = {linkedToPrevious: !!previous && reasons.length === 0, reasons,
      // Even adjacent visible samples do not establish intervening motion/consumers.
      motionBetweenSamplesKnown: false, interpolated: false};
    this.samples.push(current); return clone(current);
  }
  gap(stamp, reason = 'video-unavailable') {
    return this.append({kind: 'player-position-candidates', stamp: clone(stamp), status: 'gap', reason,
      reference: this.samples.at(-1)?.reference ?? null, candidates: [], worldPositionKnown: false,
      minimumProvenATCalls: 0, temporalAlignmentVerified: false});
  }
  export() { return {format: 'dq9-player-trajectory', version: 1, samples: clone(this.samples), worldPositionKnown: false, minimumProvenATCalls: 0}; }
}

/** Existing ATSession.noteVideo envelope: records evidence without a new draw. */
export function playerSampleATObservation(sample) {
  return {kind: 'video-map-registration', capturedAt: sample.stamp.capturedAt,
    videoTime: sample.stamp.videoTime, frameSerial: sample.stamp.frameSerial,
    playerPosition: clone(sample), worldPositionKnown: false, bootProof: false,
    minimumProvenATCalls: 0, interpretation: 'Timestamped marker/map candidates only; no new spawn, AT consumption, or exact world position inferred.'};
}
