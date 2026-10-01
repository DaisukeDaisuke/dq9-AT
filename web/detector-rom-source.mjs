// Architecture-independent local ROM -> exact 128px RGBA pose source.
// No detector, feature extractor, label inference, upload, or ROM fetch.
import {MONSTER_ARCHIVE, readMonsterAssets, parseMonsterAssetCatalog} from './monster-assets.mjs';
import {readNSBCA, sampleMatrices} from './monster-animation.mjs';
import {MonsterGeometry} from './monster-geometry.mjs';
import {rasterTile} from './monster-cpu-template.mjs';
import {templateBoundsForViews} from './monster-render-state.mjs';

const MiB = 1024 * 1024;
export const ROM_POSE_SOURCE_VERSION = 'local-rom-rgba-v1';
export const ROM_POSE_LIMITS = Object.freeze({
  romBytes: 512 * MiB, archiveBytes: 128 * MiB, catalogChars: 2 * MiB,
  modelIds: 1024, boundsViews: 256, modelCacheEntries: 16,
  modelCacheBytes: 128 * MiB, tileCacheEntries: 256,
  tileSize: 128, tileBytes: 128 * 128 * 4,
  triangles: 20000, vertexScalars: 40000 * 11,
});

export class ROMPoseSourceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ROMPoseSourceError';
    this.code = code;
    Object.assign(this, details);
  }
}
const need = (ok, code, message) => { if (!ok) throw new ROMPoseSourceError(code, message); };
const abort = signal => { if (signal?.aborted) throw new DOMException('ROM pose rendering cancelled', 'AbortError'); };
const now = () => performance.now();
const measure = (timings, key, fn) => { const start = now(); try { return fn(); } finally { timings[key] += now() - start; } };
const zeroTimings = () => ({archiveReadMs: 0, geometryDecodeMs: 0, animationDecodeMs: 0, boundsMs: 0, renderMs: 0, copyMs: 0, totalMs: 0});
const finiteView = view => view && Number.isFinite(view.yaw) && Number.isFinite(view.pitch);
const copyBounds = bounds => ({min: bounds.min.slice(), max: bounds.max.slice()});

// Walk only the requested NDS filename path. NitroFS.fromRom clones every file;
// this deliberately copies just enemy.gp2 and does not retain the ROM buffer.
function copyEnemyArchive(rom) {
  const dv = new DataView(rom);
  const range = (offset, bytes, end = rom.byteLength) => need(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(bytes) && bytes >= 0 && offset + bytes <= end, 'ROM_LAYOUT_INVALID', 'NDS file table range is outside the ROM');
  range(0, 0x200);
  const fntOffset = dv.getUint32(0x40, true), fntLength = dv.getUint32(0x44, true);
  const fatOffset = dv.getUint32(0x48, true), fatLength = dv.getUint32(0x4c, true);
  range(fntOffset, fntLength); range(fatOffset, fatLength);
  need(fntLength >= 8 && fatLength >= 8 && fatLength % 8 === 0, 'ROM_LAYOUT_INVALID', 'Invalid NDS filename/allocation table size');
  const fntEnd = fntOffset + fntLength, directoryCount = dv.getUint16(fntOffset + 6, true);
  need(directoryCount > 0 && directoryCount <= 4096 && directoryCount * 8 <= fntLength, 'ROM_LAYOUT_INVALID', 'Invalid NDS directory table');
  let directory = 0, selectedFile = null;
  const segments = MONSTER_ARCHIVE.split('/');
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    need(directory < directoryCount, 'ROM_LAYOUT_INVALID', 'NDS subdirectory ID is outside the table');
    const entry = fntOffset + directory * 8;
    let at = fntOffset + dv.getUint32(entry, true), fileId = dv.getUint16(entry + 4, true), found = false;
    need(at >= fntOffset + directoryCount * 8, 'ROM_LAYOUT_INVALID', 'NDS filename subtable overlaps directory entries');
    while (at < fntEnd) {
      const typeLength = dv.getUint8(at++);
      if (typeLength === 0) break;
      const length = typeLength & 127, isDirectory = !!(typeLength & 128);
      need(length > 0, 'ROM_LAYOUT_INVALID', 'Reserved NDS filename entry');
      range(at, length + (isDirectory ? 2 : 0), fntEnd);
      let name = ''; for (let i = 0; i < length; i++) name += String.fromCharCode(dv.getUint8(at + i));
      at += length;
      const id = isDirectory ? dv.getUint16(at, true) & 4095 : fileId++;
      if (isDirectory) at += 2;
      if (name !== segments[segmentIndex]) continue;
      need(isDirectory === (segmentIndex < segments.length - 1), 'ROM_LAYOUT_INVALID', 'NDS archive path has an unexpected file/directory type');
      if (isDirectory) directory = id; else selectedFile = id;
      found = true; break;
    }
    need(found, 'ARCHIVE_UNAVAILABLE', `Local ROM does not contain ${MONSTER_ARCHIVE}`);
  }
  need(selectedFile !== null && selectedFile < fatLength / 8, 'ROM_LAYOUT_INVALID', 'NDS archive file ID is outside the allocation table');
  const entry = fatOffset + selectedFile * 8, start = dv.getUint32(entry, true), end = dv.getUint32(entry + 4, true);
  range(start, end - start);
  need(end > start && end - start <= ROM_POSE_LIMITS.archiveBytes, 'ARCHIVE_BUDGET_EXCEEDED', 'Enemy archive exceeds its bounded input budget');
  return rom.slice(start, end);
}

// Bound GP2 allocations before delegating actual extraction to the unchanged
// validated reader. Only the small filename and member-index tables are decoded.
function validateArchiveBudget(buffer) {
  const bytes = new Uint8Array(buffer), dv = new DataView(buffer);
  const range = (at, size) => need(Number.isInteger(at) && at >= 0 && size >= 0 && at + size <= bytes.length, 'ARCHIVE_LAYOUT_INVALID', 'GP2 range is outside the selected archive');
  range(0, 24);
  need(dv.getUint32(0, true) === 0x32435047, 'ARCHIVE_LAYOUT_INVALID', 'Enemy archive is not GP2');
  const count = dv.getUint16(4, true) & 4095, headerEnd = dv.getUint16(6, true) * 4;
  const infoEnd = dv.getUint16(8, true) * 4, firstFile = dv.getUint16(10, true) * 4;
  need(headerEnd >= 20 && headerEnd < infoEnd && infoEnd < firstFile, 'ARCHIVE_LAYOUT_INVALID', 'GP2 metadata sections are not ordered');
  const compressedSize = (at, end, limit) => {
    need(end - at >= 4, 'ARCHIVE_LAYOUT_INVALID', 'GP2 compressed section is truncated');
    range(at, 4); range(at, end - at);
    const flags = dv.getUint32(at, true);
    need((flags & 7) <= 4 && (flags >>> 3) <= limit, 'ARCHIVE_BUDGET_EXCEEDED', 'GP2 expanded member exceeds its allocation budget');
  };
  compressedSize(headerEnd, infoEnd, MiB); compressedSize(infoEnd, firstFile, MiB);
  const reader = new globalThis.NdsFontGp2.BinaryReader(bytes); reader.seek(headerEnd);
  const info = globalThis.NdsFontGp2.decompressSelection(reader, infoEnd);
  need(info.length >= count * 12, 'ARCHIVE_LAYOUT_INVALID', 'GP2 member table is truncated');
  const members = new DataView(info.buffer, info.byteOffset, info.byteLength), compressed = !(dv.getUint32(16, true) & 0x10000000);
  for (let i = 0; i < count; i++) {
    const start = firstFile + (members.getUint32(i * 12 + 4, true) & 0xffffff) * 4;
    const size = members.getUint32(i * 12 + 8, true) & 0xffffff;
    range(start, size);
    if (compressed) compressedSize(start, start + size, 8 * MiB);
    else need(size <= 8 * MiB, 'ARCHIVE_BUDGET_EXCEEDED', 'GP2 member exceeds its container budget');
  }
}

class BoundedLRU {
  constructor(maxEntries, maxBytes) { this.maxEntries = maxEntries; this.maxBytes = maxBytes; this.entries = new Map(); this.bytes = 0; this.hits = 0; this.misses = 0; this.evictions = 0; }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) { this.misses++; return null; }
    this.hits++; this.entries.delete(key); this.entries.set(key, entry); return entry.value;
  }
  set(key, value, bytes) {
    const old = this.entries.get(key); if (old) { this.bytes -= old.bytes; this.entries.delete(key); }
    if (!this.maxEntries || bytes > this.maxBytes) return false;
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value;
      this.bytes -= this.entries.get(oldest).bytes; this.entries.delete(oldest); this.evictions++;
    }
    this.entries.set(key, {value, bytes}); this.bytes += bytes; return true;
  }
  clear() { this.entries.clear(); this.bytes = 0; }
  snapshot() { return {entries: this.entries.size, bytes: this.bytes, maxEntries: this.maxEntries, maxBytes: this.maxBytes, hits: this.hits, misses: this.misses, evictions: this.evictions}; }
}

// Counts retained binary payloads once per backing buffer; JS object overhead,
// WASM fixed memory, scratch allocations and caller-owned results are separate.
function payloadBytes(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  if (ArrayBuffer.isView(value)) return payloadBytes(value.buffer, seen);
  if (value instanceof ArrayBuffer) return value.byteLength;
  return Object.values(value).reduce((sum, child) => sum + payloadBytes(child, seen), 0);
}
function validateGeometry(model) {
  need(model?.counts?.triangles > 0 && model.counts.triangles <= ROM_POSE_LIMITS.triangles && model.vertices?.length <= ROM_POSE_LIMITS.vertexScalars,
    'MODEL_BUDGET_EXCEEDED', 'Decoded geometry exceeds the bounded CPU renderer budget');
}

/**
 * Creates a local-only lazy pose source. modelIds/catalogText are required.
 * Views use radians. Bind is the default. Stand never silently becomes bind.
 * boundsViews, when supplied, must contain every requested tile view; otherwise
 * each tile gets bounds computed for its exact view (independent of call order).
 * One tile call at a time: concurrent calls reject with SOURCE_BUSY.
 */
export async function createROMPoseSource(rom, {
  modelIds, catalogText, geometry, signal, onProgress = () => {}, boundsViews,
  cache = {},
} = {}) {
  const started = now(); abort(signal);
  need(rom instanceof ArrayBuffer && rom.byteLength >= 512 && rom.byteLength <= ROM_POSE_LIMITS.romBytes, 'ROM_INPUT_INVALID', 'Supply a local NDS ArrayBuffer within the 512 MiB input budget');
  need(typeof catalogText === 'string' && catalogText.length > 0 && catalogText.length <= ROM_POSE_LIMITS.catalogChars, 'CATALOG_INPUT_INVALID', 'Supply the complete bounded monsters.csv text explicitly');
  need(Array.isArray(modelIds) && modelIds.length > 0 && modelIds.length <= ROM_POSE_LIMITS.modelIds && modelIds.every(id => typeof id === 'string' && /^[a-z0-9_-]{1,32}$/i.test(id)) && new Set(modelIds).size === modelIds.length, 'MODEL_IDS_INVALID', 'Supply a nonempty unique list of explicit model IDs');
  need(typeof onProgress === 'function', 'PROGRESS_INVALID', 'onProgress must be a function');
  const ids = modelIds.slice(), allowed = new Set(ids), catalogStart = now(), catalog = parseMonsterAssetCatalog(catalogText);
  for (const id of ids) need(catalog.has(id), 'MODEL_ID_UNKNOWN', `Model ID is absent from the supplied catalogue: ${id}`);
  const catalogMs = now() - catalogStart;
  let views = null, viewKeys = null;
  if (boundsViews !== undefined) {
    need(Array.isArray(boundsViews) && boundsViews.length > 0 && boundsViews.length <= ROM_POSE_LIMITS.boundsViews && boundsViews.every(finiteView), 'BOUNDS_VIEWS_INVALID', 'boundsViews requires 1..256 finite yaw/pitch pairs in radians');
    views = boundsViews.map(({yaw, pitch}) => ({yaw, pitch})); viewKeys = new Set(views.map(v => JSON.stringify([v.yaw, v.pitch])));
  }
  const option = (key, fallback, max, min = 0) => { const value = cache[key] ?? fallback; need(Number.isSafeInteger(value) && value >= min && value <= max, 'CACHE_LIMIT_INVALID', `cache.${key} must be an integer in ${min}..${max}`); return value; };
  const models = new BoundedLRU(option('modelEntries', 4, ROM_POSE_LIMITS.modelCacheEntries), option('modelBytes', 64 * MiB, ROM_POSE_LIMITS.modelCacheBytes));
  const tiles = new BoundedLRU(option('tileEntries', 64, ROM_POSE_LIMITS.tileCacheEntries), option('tileBytes', 64 * ROM_POSE_LIMITS.tileBytes, ROM_POSE_LIMITS.tileCacheEntries * ROM_POSE_LIMITS.tileBytes));
  let archiveStart = now(), archive = copyEnemyArchive(rom); rom = null;
  validateArchiveBudget(archive); const archiveMs = now() - archiveStart;
  abort(signal);
  const geometryStart = now(); geometry ??= await MonsterGeometry.create(); abort(signal);
  need(typeof geometry?.decode === 'function', 'GEOMETRY_INPUT_INVALID', 'Supplied geometry must implement decode(asset, options)');
  const initTimings = Object.freeze({catalogMs, archiveMs, geometryInitMs: now() - geometryStart, totalMs: now() - started});
  const archiveBytes = archive.byteLength;
  let disposed = false, busy = false, activeController = null, decodeCount = 0, renderCount = 0;
  const snapshot = () => ({models: models.snapshot(), tiles: tiles.snapshot(), archiveBytes: disposed ? 0 : archiveBytes, decodedPoses: decodeCount, renderedTiles: renderCount});
  const assertActive = operationSignal => { abort(signal); abort(operationSignal); need(!disposed, 'SOURCE_DISPOSED', 'ROM pose source has been disposed'); };
  const readFile = path => { need(path === MONSTER_ARCHIVE && archive !== null, 'ARCHIVE_UNAVAILABLE', 'Only the retained enemy archive is available'); return archive; };
  const progress = (callback, event) => callback({sourceVersion: ROM_POSE_SOURCE_VERSION, ...event});
  progress(onProgress, {phase: 'ready', modelCount: ids.length, decodedPoses: 0, archiveBytes, timings: {...initTimings}});

  return {
    version: ROM_POSE_SOURCE_VERSION,
    renderer: 'validated CPU unlit RGBA128; exact bind or stored NSBCA midpoint',
    modelIds: Object.freeze(ids), initTimings,
    get cacheBytes() { return models.bytes + tiles.bytes; },
    get stats() { return snapshot(); },
    async tile(recipe, {signal: operationSignal, onProgress: tileProgress = onProgress} = {}) {
      const began = now(), timings = zeroTimings(); assertActive(operationSignal);
      need(!busy, 'SOURCE_BUSY', 'Await the previous tile call before requesting another');
      need(typeof tileProgress === 'function', 'PROGRESS_INVALID', 'onProgress must be a function');
      const modelId = recipe?.modelId;
      need(recipe && allowed.has(modelId), 'MODEL_NOT_SELECTED', 'Recipe modelId must belong to the explicit source modelIds');
      need(finiteView(recipe), 'VIEW_INVALID', 'Recipe yaw and pitch must be finite radians');
      const pose = recipe.pose ?? 'bind';
      need(pose === 'bind' || pose === 'stand-midpoint', 'POSE_INVALID', 'Choose bind or stand-midpoint explicitly');
      const view = {yaw: recipe.yaw, pitch: recipe.pitch}, viewKey = JSON.stringify([view.yaw, view.pitch]);
      need(!viewKeys || viewKeys.has(viewKey), 'VIEW_OUTSIDE_BOUNDS_SET', 'Recipe view is not present in the declared boundsViews');
      const key = JSON.stringify([modelId, pose, view.yaw, view.pitch]);
      let modelCacheHit = false, poseCacheHit = false;
      const cached = tiles.get(key);
      if (cached) {
        const copyStart = now(), rgba = cached.rgba.slice(); timings.copyMs = now() - copyStart; timings.totalMs = now() - began;
        return {tile: {width: 128, height: 128, rgba}, recipe: {...cached.recipe}, poseSource: cached.poseSource ? {...cached.poseSource} : null, bounds: copyBounds(cached.bounds), timings, renderMs: 0, cacheHit: true, cache: {tileHit: true, modelHit: null, poseHit: null, ...snapshot()}};
      }
      busy = true;
      const controller = new AbortController(); activeController = controller;
      const cancel = () => controller.abort(); signal?.addEventListener('abort', cancel, {once: true}); operationSignal?.addEventListener('abort', cancel, {once: true});
      try {
        assertActive(operationSignal);
        let entry = models.get(modelId); modelCacheHit = !!entry;
        if (!entry) {
          progress(tileProgress, {phase: 'archive-read', modelId, pose}); assertActive(operationSignal);
          const asset = measure(timings, 'archiveReadMs', () => readMonsterAssets({readFile}, catalog, [{modelId, variant: '_f'}]).models[0]);
          entry = {asset, poses: {}, standError: null};
        }
        let model = entry.poses[pose]; poseCacheHit = !!model;
        if (!model) {
          progress(tileProgress, {phase: 'decode', modelId, pose}); assertActive(operationSignal);
          if (pose === 'bind') {
            model = measure(timings, 'geometryDecodeMs', () => geometry.decode(entry.asset));
          } else {
            if (entry.standError) throw new ROMPoseSourceError('STAND_POSE_UNAVAILABLE', entry.standError.message, {...entry.standError});
            let reason = 'missing-clip';
            try {
              const clip = entry.asset.animations.find(item => item.name === 'stand.nsbca');
              if (!clip) throw Error('stand.nsbca missing');
              reason = 'unsupported-animation';
              const {frame, localMatrices} = measure(timings, 'animationDecodeMs', () => {
                const animation = readNSBCA(clip.bytes), frame = Math.floor((animation.numFrames - 1) / 2);
                return {frame, localMatrices: sampleMatrices(animation, frame)};
              });
              reason = 'incompatible-model';
              model = measure(timings, 'geometryDecodeMs', () => geometry.decode(entry.asset, {localMatrices, poseSource: {clip: 'stand.nsbca', frame, decoderVersion: 'exact-nsbca-v1', exactStoredFrame: true}}));
            } catch (cause) {
              entry.standError = {modelId, pose, reason, message: `${modelId}: stand-midpoint unavailable (${cause.message}); no bind substitution`};
              models.set(modelId, entry, payloadBytes(entry));
              throw new ROMPoseSourceError('STAND_POSE_UNAVAILABLE', entry.standError.message, {...entry.standError});
            }
          }
          validateGeometry(model); entry.poses[pose] = model; decodeCount++;
          models.set(modelId, entry, payloadBytes(entry));
        }
        assertActive(operationSignal);
        const bounds = measure(timings, 'boundsMs', () => templateBoundsForViews(model, views ?? [view]));
        progress(tileProgress, {phase: 'render', modelId, pose, view: {...view}}); assertActive(operationSignal);
        const renderStart = now(); let rgba;
        try { rgba = await rasterTile({...model, templateBounds: bounds}, view, 128, controller.signal); }
        finally { timings.renderMs = now() - renderStart; }
        assertActive(operationSignal); renderCount++;
        need(rgba instanceof Uint8ClampedArray && rgba.length === ROM_POSE_LIMITS.tileBytes, 'RGBA_INVALID', 'Renderer returned an unexpected RGBA buffer');
        const resultRecipe = {modelId, variant: '_f', pose, ...view};
        const poseSource = model.poseSource ? {...model.poseSource} : null;
        const tileCached = tiles.set(key, {rgba, recipe: resultRecipe, poseSource, bounds: copyBounds(bounds)}, rgba.byteLength);
        const copyStart = now(), outputRGBA = tileCached ? rgba.slice() : rgba; timings.copyMs = now() - copyStart; timings.totalMs = now() - began;
        progress(tileProgress, {phase: 'tile-ready', modelId, pose, timings: {...timings}, cache: snapshot()}); assertActive(operationSignal);
        return {tile: {width: 128, height: 128, rgba: outputRGBA}, recipe: resultRecipe, poseSource, bounds: copyBounds(bounds), timings, renderMs: timings.renderMs, cacheHit: false, cache: {tileHit: false, modelHit: modelCacheHit, poseHit: poseCacheHit, ...snapshot()}};
      } catch (caught) {
        const error = caught instanceof Error ? caught : new ROMPoseSourceError('SOURCE_OPERATION_FAILED', String(caught));
        error.timings = {...timings, totalMs: now() - began};
        error.cache = snapshot(); throw error;
      } finally {
        signal?.removeEventListener('abort', cancel); operationSignal?.removeEventListener('abort', cancel);
        activeController = null; busy = false;
      }
    },
    dispose() { if (disposed) return; disposed = true; activeController?.abort(); models.clear(); tiles.clear(); archive = null; geometry = null; },
  };
}
