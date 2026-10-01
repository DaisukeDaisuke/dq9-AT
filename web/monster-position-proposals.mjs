/* Experimental local ROI proposals, not an enemy classifier or birth detector.
 * The explicit shrine-blue-v1 profile reuses the existing blue/teal exclusion
 * heuristic. It is unsuitable for arbitrary maps, battles, or automatic AT pruning.
 * No learned assets, remote inference, or pixel persistence are used here. */
import { normalizeSceneContext, getFieldExclusion } from './monster-field-mask.mjs';
import { validateRGBA, cropRGBA } from './monster-roi-descriptor.mjs';

export const PROPOSAL_REVISION = 'shrine-components-v2-recall-ui-contract';
export const PROPOSAL_LIMITS = Object.freeze({ width: 256, height: 192, maxProposals: 8, maxGapSeconds: .5, maxTracks: 32 });
const need = (v, m) => { if (!v) throw new Error(m); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const copy = v => structuredClone(v);
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const intersection = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const iou = (a, b) => { const x = intersection(a, b); return x / (a.w * a.h + b.w * b.h - x); };
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const unknown = () => ({ suggested: true, calibrated: false, reason: 'Appearance proposals include background, HUD, static objects and partial bodies; missing proposals do not establish absence.' });

function validateStamp(image, stamp) {
  validateRGBA(image, 4096 * 4096);
  need(image.width <= 4096 && image.height <= 4096, 'Source dimensions exceed the proposal limit');
  need(stamp && typeof stamp.sourceId === 'string' && stamp.sourceId.length > 0, 'Source identity required');
  for (const key of ['sourceEpoch', 'timelineSegment', 'frameSerial']) need(Number.isSafeInteger(stamp[key]) && stamp[key] >= 0, `Invalid ${key}`);
  need(stamp.sourceFrame?.width === image.width && stamp.sourceFrame?.height === image.height, 'Source stamp dimensions differ from pixels');
  const stillImage = stamp.videoTime === null && stamp.timestampBasis === 'local-image';
  need(stillImage || (Number.isFinite(stamp.videoTime) && stamp.videoTime >= 0), 'Finite clip-relative video time or a local-image stamp required');
  return normalizeSceneContext(stamp.sceneContext, stamp.sourceFrame);
}
function normalizedRect(r, width, height) {
  const x = Math.floor(r.x * width), y = Math.floor(r.y * height);
  return { x, y, w: Math.ceil((r.x + r.w) * width) - x, h: Math.ceil((r.y + r.h) * height) - y };
}
function sampleField(image, roi) {
  const width = 256, height = 192, rgba = new Uint8ClampedArray(width * height * 4);
  // Explicit bilinear resampling: browser/Node share exactly the same proposal pixels.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const fx = clamp(roi.x + (x + .5) * roi.w / width - .5, roi.x, roi.x + roi.w - 1);
    const fy = clamp(roi.y + (y + .5) * roi.h / height - .5, roi.y, roi.y + roi.h - 1);
    const ix = Math.floor(fx), iy = Math.floor(fy), jx = Math.min(ix + 1, roi.x + roi.w - 1), jy = Math.min(iy + 1, roi.y + roi.h - 1), dx = fx - ix, dy = fy - iy;
    for (let k = 0; k < 4; k++) rgba[(y * width + x) * 4 + k] = image.rgba[(iy * image.width + ix) * 4 + k] * (1 - dx) * (1 - dy) + image.rgba[(iy * image.width + jx) * 4 + k] * dx * (1 - dy) + image.rgba[(jy * image.width + ix) * 4 + k] * (1 - dx) * dy + image.rgba[(jy * image.width + jx) * 4 + k] * dx * dy;
  }
  return { width, height, rgba };
}
function appearanceMask(frame) {
  const mask = new Uint8Array(frame.width * frame.height), gray = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const r = frame.rgba[i * 4], g = frame.rgba[i * 4 + 1], b = frame.rgba[i * 4 + 2];
    gray[i] = (r * 77 + g * 150 + b * 29) >> 8;
    // Same chroma inequality as colorDescriptor, with a documented low-light floor.
    mask[i] = frame.rgba[i * 4 + 3] >= 128 && b - r < .065 * 255 && g - r < .12 * 255 && Math.max(r, g, b) > 50 ? 1 : 0;
  }
  return { mask, gray };
}
function components(mask, width, height, blocked) {
  const dilated = new Uint8Array(mask.length), seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length), out = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) {
    // One-pixel four-neighbor dilation connects narrow arms without large merges.
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && !blocked[(y + dy) * width + x + dx]) dilated[(y + dy) * width + x + dx] = 1;
  }
  for (let start = 0; start < mask.length; start++) {
    if (!dilated[start] || seen[start]) continue;
    let head = 0, tail = 1, x0 = width, y0 = height, x1 = -1, y1 = -1, cx0 = width, cy0 = height, cx1 = -1, cy1 = -1, pixels = 0; queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); pixels += mask[i];
      if (mask[i]) { cx0 = Math.min(cx0, x); cy0 = Math.min(cy0, y); cx1 = Math.max(cx1, x); cy1 = Math.max(cy1, y); }
      for (const j of [x > 0 ? i - 1 : -1, x + 1 < width ? i + 1 : -1, y > 0 ? i - width : -1, y + 1 < height ? i + width : -1]) if (j >= 0 && dilated[j] && !seen[j]) { seen[j] = 1; queue[tail++] = j; }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, coreROI: { x: cx0, y: cy0, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1 }, foregroundPixels: pixels });
  }
  return out;
}
function trimPaddingAtExclusions(padded, component, exclusions) {
  const r = { ...padded };
  for (const mask of exclusions) {
    // A mask never cuts a component into a purported complete enemy. Only trim
    // optional padding when the observed component itself lies outside the mask.
    if (!overlaps(r, mask)) continue;
    if (overlaps(component, mask)) return null;
    if (component.x + component.w <= mask.x) r.w = Math.min(r.x + r.w, mask.x) - r.x;
    else if (component.x >= mask.x + mask.w) { const end = r.x + r.w; r.x = Math.max(r.x, mask.x + mask.w); r.w = end - r.x; }
    else if (component.y + component.h <= mask.y) r.h = Math.min(r.y + r.h, mask.y) - r.y;
    else if (component.y >= mask.y + mask.h) { const end = r.y + r.h; r.y = Math.max(r.y, mask.y + mask.h); r.h = end - r.y; }
  }
  return r.w > 0 && r.h > 0 ? r : null;
}
function componentEdgeMean(gray, c) {
  let sum = 0, n = 0;
  for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
    const i = y * 256 + x;
    if (x < 255) { sum += Math.abs(gray[i] - gray[i + 1]); n++; }
    if (y < 191) { sum += Math.abs(gray[i] - gray[i + 256]); n++; }
  }
  return n ? sum / n : 0;
}
function sourceRect(rect, game) {
  const x = game.x + Math.floor(rect.x * game.w / 256), y = game.y + Math.floor(rect.y * game.h / 192);
  const x1 = game.x + Math.ceil((rect.x + rect.w) * game.w / 256), y1 = game.y + Math.ceil((rect.y + rect.h) * game.h / 192);
  return { x, y, w: x1 - x, h: y1 - y };
}
function identity(stamp, profile, hud) {
  return JSON.stringify({ sourceId: stamp.sourceId, sourceEpoch: stamp.sourceEpoch, timelineSegment: stamp.timelineSegment, sourceFrame: stamp.sourceFrame, sceneContext: stamp.sceneContext, profile, hud });
}

/** Image-space suggestions only. Scene/profile selection is a required external gate. */
export function proposeEnemyROIs(image, captureStamp, { profile, excludeCommandHUD = true, maxProposals = 8 } = {}) {
  const start = performance.now(), scene = validateStamp(image, captureStamp);
  need(profile === 'shrine-blue-v1', 'Select the explicit shrine-blue-v1 experimental scene profile');
  need(typeof excludeCommandHUD === 'boolean', 'HUD exclusion must be explicit boolean');
  need(Number.isInteger(maxProposals) && maxProposals >= 1 && maxProposals <= 8, 'Proposal budget must be 1–8');
  const stamp = copy(captureStamp), base = { schema: 'dq9-enemy-roi-proposals-v1', revision: PROPOSAL_REVISION, captureStamp: stamp, profile, proposals: [], excluded: [], unknown: unknown(), safeForHardPruning: false, enemyIdentityCertified: false, birthCertified: false, ATDrawsCertified: 0 };
  if (scene.kind !== 'field') return { ...base, skipped: 'field-scene-required', elapsedMs: performance.now() - start };
  const game = scene.gameplayROI;
  need(Math.abs(game.w / game.h - 4 / 3) < .04, 'Profile requires an explicitly selected 4:3 gameplay panel');
  const sampled = sampleField(image, game), { mask, gray } = appearanceMask(sampled), blocked = new Uint8Array(mask.length);
  const localExclusions = [];
  if (scene.excludeCenter) localExclusions.push({ reason: 'central-field-exclusion', ...normalizedRect(scene.maskNormalized, 256, 192) });
  if (excludeCommandHUD) localExclusions.push({ reason: 'command-hud-exclusion', x: 212, y: 0, w: 44, h: 39 });
  for (const r of localExclusions) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { mask[y * 256 + x] = 0; blocked[y * 256 + x] = 1; }
  let oversizedComponents = 0;
  const candidates = [];
  for (const component of components(mask, 256, 192, blocked)) {
    const { x, y, w, h, foregroundPixels } = component;
    // Broad bounds only. This is not a calibrated y-to-world-size model.
    const minPixels = Math.max(8, 12 * (.6 + (y + h / 2) / 192 * 1.5) ** 2);
    if (foregroundPixels < minPixels || w < 3 || h < 3 || foregroundPixels / (w * h) < .08) continue;
    if (w > 100 || h > 115) { oversizedComponents++; continue; }
    const pad = Math.max(2, Math.ceil(Math.max(w, h) * .08)), x0 = Math.max(0, x - pad), y0 = Math.max(0, y - pad);
    const padded = { x: x0, y: y0, w: Math.min(256, x + w + pad) - x0, h: Math.min(192, y + h + pad) - y0 };
    const nativeROI = trimPaddingAtExclusions(padded, component.coreROI, localExclusions);
    if (!nativeROI) { base.excluded.push({ roi: sourceRect(padded, game), reason: 'component-overlaps-exclusion', unknown: true }); continue; }
    const roundedROI = sourceRect(nativeROI, game);
    const sourceExclusions = localExclusions.filter(r => r.reason === 'command-hud-exclusion').map(r => sourceRect(r, game));
    const fieldMask = getFieldExclusion({ ...stamp, enemyROI: roundedROI }, scene).mask;
    if (fieldMask) sourceExclusions.push(fieldMask);
    // Source-space trimming also removes conservative resampling/rounding padding.
    const roi = trimPaddingAtExclusions(roundedROI, sourceRect(component.coreROI, game), sourceExclusions);
    if (!roi) { base.excluded.push({ roi: roundedROI, reason: 'core-overlaps-exclusion', unknown: true }); continue; }
    const centerGate = getFieldExclusion({ ...stamp, enemyROI: roi }, scene);
    const exclusion = centerGate.excluded ? 'central-field-exclusion' : (sourceExclusions.some(r => overlaps(roi, r)) ? 'command-hud-exclusion' : null);
    if (exclusion) { base.excluded.push({ roi, reason: exclusion, unknown: true }); continue; }
    const edgeMean = componentEdgeMean(gray, component);
    const priority = foregroundPixels / Math.sqrt(w * h) * clamp(edgeMean / 8, .15, 3);
    const classificationEligible = roi.w <= 1024 && roi.h <= 1024 && roi.w * roi.h <= 1024 * 1024;
    candidates.push({ roi, nativeROI, component: { ...component }, priority, edgeMean, paddingTrimmed: JSON.stringify(padded) !== JSON.stringify(nativeROI) || JSON.stringify(roundedROI) !== JSON.stringify(roi), classificationEligible, classificationStatus: classificationEligible ? 'unverified' : 'unprocessed-size-limit', clipped: x === 0 || y === 0 || x + w === 256 || y + h === 192, unknown: true, screenPosition: { x: roi.x + roi.w / 2, y: roi.y + roi.h, basis: 'proposal-box-bottom-center', calibrated: false } });
  }
  candidates.sort((a, b) => b.priority - a.priority || a.roi.y - b.roi.y || a.roi.x - b.roi.x);
  base.proposals = candidates.slice(0, maxProposals).map((p, i) => ({ proposalId: `${stamp.frameSerial}:${i}`, ...p }));
  return { ...base, coverage: { candidateComponents: candidates.length, budgetDropped: Math.max(0, candidates.length - maxProposals), oversizedComponents, exclusions: localExclusions.map(r => ({ ...r, coordinateSystem: '256x192-gameplay' })), expectedScaleModel: 'uncalibrated broad y-dependent speckle floor only', absenceCertified: false }, elapsedMs: performance.now() - start,
    // Ephemeral small CPU buffers for camera registration; never inference inputs.
    trackingFrame: { width: 256, height: 192, gray, mask, blocked, identity: identity(stamp, profile, excludeCommandHUD) } };
}

/** Reuse the existing recognition request schema and original pixels unchanged. */
export function proposalRecognitionRequest(image, result, proposalId, { romEpoch, modelIds, variant = '_f', preset = 'quick', featureMethod = 'dinov2', inferenceBackend = 'wasm' } = {}) {
  validateStamp(image, result.captureStamp);
  const p = result.proposals.find(p => p.proposalId === proposalId); need(p, 'Proposal does not belong to this result');
  // Enforce the unchanged classifier contract before cropRGBA allocates pixels.
  need(p.roi.w <= 1024 && p.roi.h <= 1024 && p.roi.w * p.roi.h <= 1024 * 1024, '領域候補は未処理です。既存の分類器の上限1024×1024 px以内へ手動で調整してください');
  need(Number.isSafeInteger(romEpoch) && romEpoch >= 0, 'ROM epoch required');
  const captureStamp = { ...copy(result.captureStamp), romEpoch, enemyROI: copy(p.roi), featureMethod, inferenceBackend };
  return { romEpoch, modelIds: copy(modelIds), variant, preset, featureMethod, inferenceBackend, captureStamp, sceneContext: copy(captureStamp.sceneContext), crop: cropRGBA(image, p.roi.x, p.roi.y, p.roi.w, p.roi.h) };
}

/** Coarse translational registration. Rotation/parallax/lighting may invalidate it. */
export function estimateCameraTranslation(previous, current) {
  need(previous?.gray?.length === 256 * 192 && current?.gray?.length === 256 * 192, '256x192 tracking frames required');
  let textureSum = 0, textureCount = 0;
  for (let y = 18; y < 174; y += 6) for (let x = 18; x < 238; x += 6) {
    const i = y * 256 + x; if (!previous.blocked[i] && !previous.mask[i]) { textureSum += Math.abs(previous.gray[i] - previous.gray[i + 2]) + Math.abs(previous.gray[i] - previous.gray[i + 512]); textureCount += 2; }
  }
  const texture = textureCount ? textureSum / textureCount : 0;
  const cost = (dx, dy) => {
    let sum = 0, count = 0;
    for (let y = 18; y < 174; y += 6) for (let x = 18; x < 238; x += 6) {
      const a = y * 256 + x, b = (y + dy) * 256 + x + dx;
      if (previous.blocked[a] || current.blocked[b] || previous.mask[a] || current.mask[b]) continue;
      sum += Math.min(40, Math.abs(previous.gray[a] - current.gray[b])); count++;
    }
    return count >= 150 ? sum / count : Infinity;
  };
  let best = { dx: 0, dy: 0, residual: cost(0, 0) };
  for (let dy = -16; dy <= 16; dy += 2) for (let dx = -16; dx <= 16; dx += 2) { const residual = cost(dx, dy); if (residual < best.residual) best = { dx, dy, residual }; }
  const rough = { ...best };
  for (let dy = Math.max(-16, rough.dy - 1); dy <= Math.min(16, rough.dy + 1); dy++) for (let dx = Math.max(-16, rough.dx - 1); dx <= Math.min(16, rough.dx + 1); dx++) { const residual = cost(dx, dy); if (residual < best.residual) best = { dx, dy, residual }; }
  return { ...best, texture, reliable: texture >= 2 && Number.isFinite(best.residual) && best.residual <= 14 && Math.abs(best.dx) < 16 && Math.abs(best.dy) < 16, method: 'bounded-clipped-SAD-translation', calibrated: false };
}

/** Short, conservative image-space associations; track IDs are never native entities. */
export class EnemyProposalTracker {
  constructor() { this.reset(); }
  reset() { this.previous = null; this.tracks = []; this.nextId = 1; this.generation = (this.generation ?? -1) + 1; }
  update(result) {
    need(result?.captureStamp && Array.isArray(result.proposals), 'A proposal result is required');
    const t = result.captureStamp.videoTime, prev = this.previous; let resetReason = null, camera = null;
    if (!result.trackingFrame) resetReason = 'out-of-scope-scene';
    else if (!Number.isFinite(t)) resetReason = 'video-time-required-for-tracking';
    else if (prev) {
      const dt = t - prev.captureStamp.videoTime;
      if (result.trackingFrame.identity !== prev.trackingFrame.identity) resetReason = 'source-or-scene-change';
      else if (!(dt > 0 && dt <= .5) || result.captureStamp.frameSerial <= prev.captureStamp.frameSerial) resetReason = 'time-or-frame-discontinuity';
      else { camera = estimateCameraTranslation(prev.trackingFrame, result.trackingFrame); if (!camera.reliable) resetReason = 'camera-registration-unknown'; }
    }
    if (resetReason) { this.reset(); camera = null; }
    const proposals = result.proposals, matches = [], game = result.captureStamp.sceneContext?.gameplayROI;
    if (!resetReason && prev && camera) {
      const dx = camera.dx * game.w / 256, dy = camera.dy * game.h / 192;
      for (let i = 0; i < this.tracks.length; i++) {
        const track = this.tracks[i], predicted = { ...track.roi, x: track.roi.x + dx, y: track.roi.y + dy };
        if (t - track.lastSeen > .5) continue;
        for (let j = 0; j < proposals.length; j++) {
          const p = proposals[j], ratio = (p.roi.w * p.roi.h) / (track.roi.w * track.roi.h), overlap = iou(predicted, p.roi);
          if (ratio < .4 || ratio > 2.5 || overlap < .15) continue;
          const a = center(predicted), b = center(p.roi), distance = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(predicted.w, predicted.h, p.roi.w, p.roi.h);
          matches.push({ i, j, score: overlap - .15 * distance });
        }
      }
    }
    const associations = new Map(), used = new Set();
    for (let j = 0; j < proposals.length; j++) {
      const opts = matches.filter(m => m.j === j).sort((a, b) => b.score - a.score);
      if (!opts.length || (opts[1] && opts[0].score - opts[1].score < .1)) continue;
      const best = opts[0], back = matches.filter(m => m.i === best.i).sort((a, b) => b.score - a.score);
      if (back[0].j !== j || (back[1] && back[0].score - back[1].score < .1) || used.has(best.i)) continue;
      associations.set(j, this.tracks[best.i]); used.add(best.i);
    }
    const observed = proposals.map((p, j) => {
      const prior = associations.get(j), track = { id: prior?.id ?? `track-${this.generation}-${this.nextId++}`, roi: copy(p.roi), firstSeen: prior?.firstSeen ?? t, lastSeen: t, sightings: (prior?.sightings ?? 0) + 1 };
      return { ...p, ...track, association: prior ? 'tentative-continuation' : 'first-observed-or-unmatched', nativeIdentityCertified: false, birthCertified: false, unknown: true };
    });
    const unobserved = this.tracks.filter((track, i) => !used.has(i) && t - track.lastSeen <= .5).map(track => ({ ...copy(track), status: 'unobserved', positionCurrent: false, absenceCertified: false, reason: 'missed/occluded/masked/out-of-frame or proposal failure; not a despawn' }));
    // Do not bridge a missing frame with a guessed camera/occlusion trajectory.
    this.tracks = observed.map(({ id, roi, firstSeen, lastSeen, sightings }) => ({ id, roi: copy(roi), firstSeen, lastSeen, sightings })).slice(0, 32);
    // Own the compact state: serializing/discarding a caller's buffers must not corrupt the next update.
    this.previous = result.trackingFrame && Number.isFinite(t) ? { captureStamp: copy(result.captureStamp), trackingFrame: copy(result.trackingFrame) } : null;
    return { observed, unobserved, camera, resetReason, unknown: unknown(), nativeIdentityCertified: false, birthCertified: false, ATDrawsCertified: 0 };
  }
}
