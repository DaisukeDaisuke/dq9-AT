// ROM-derived pose vectors use this versioned local-only CacheStorage cache.
// No synthetic URL is fetched or added to the public inference SW allowlist.
// Upstream exact bank keys contain full ROM/inference hashes and all policies.
export const FEATURE_BANK_CACHE_PREFIX = 'dq9-monster-local-feature-banks-';
export const FEATURE_BANK_SCHEMA = 1;
export const FEATURE_BANK_CACHE_NAME = FEATURE_BANK_CACHE_PREFIX + 'v1';
export const FEATURE_BANK_LIMITS = Object.freeze({
  banks: 256, payloadBytes: 32 * 1024 * 1024, entriesPerBank: 64,
  dimensions: 384, bankKeyBytes: 16 * 1024, entryKeyBytes: 4 * 1024,
});
const FLOAT_BYTES = FEATURE_BANK_LIMITS.dimensions * 4;
const MAX_BANK_BYTES = 512 * 1024;
const encoder = new TextEncoder();
const fields = ['bankKey', 'completed', 'keys', 'schemaVersion', 'sha256', 'usedAt', 'vectorBytes', 'vectors'];
export class FeatureBankCacheError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : {cause});
    this.name = 'FeatureBankCacheError'; this.code = code; this.recoverable = true;
  }
}
const fail = (code, message, cause) => new FeatureBankCacheError(code, message, cause);
const aborted = () => new DOMException('Local pose-vector cache operation cancelled', 'AbortError');
const check = signal => { if (signal?.aborted) throw aborted(); };
const validKey = (key, max) => typeof key === 'string' && key.length > 0 && key.length <= max && encoder.encode(key).byteLength <= max;
function checkKey(key) {
  if (!validKey(key, FEATURE_BANK_LIMITS.bankKeyBytes)) throw fail('invalid', 'A bounded exact pose-vector bank key is required');
}
function normalized(vector) {
  if (!(vector instanceof Float32Array) || vector.length !== FEATURE_BANK_LIMITS.dimensions) return false;
  let norm = 0;
  for (const value of vector) { if (!Number.isFinite(value)) return false; norm += value * value; }
  return Math.abs(norm - 1) <= 0.0001;
}
function storageFailure(error, operation) {
  if (error?.name === 'AbortError' || error instanceof FeatureBankCacheError) return error;
  const quota = error?.name === 'QuotaExceededError';
  return fail(quota ? 'quota' : operation + '-failed', quota ?
    'Local pose-vector cache storage is full; clear it or continue without persistence' :
    'Local pose-vector cache ' + operation + ' failed; clear it or retry', error);
}
function inspect(record, bankKey, maxBytes) {
  if (!record || typeof record !== 'object' || Object.keys(record).sort().join('|') !== fields.join('|') ||
      record.schemaVersion !== FEATURE_BANK_SCHEMA || record.completed !== true || record.bankKey !== bankKey ||
      !validKey(record.bankKey, FEATURE_BANK_LIMITS.bankKeyBytes) || !Number.isSafeInteger(record.usedAt) || record.usedAt < 0 ||
      !Array.isArray(record.keys) || record.keys.length < 1 || record.keys.length > FEATURE_BANK_LIMITS.entriesPerBank ||
      record.keys.some(key => !validKey(key, FEATURE_BANK_LIMITS.entryKeyBytes)) || new Set(record.keys).size !== record.keys.length ||
      !(record.vectors instanceof ArrayBuffer) || record.vectorBytes !== record.keys.length * FLOAT_BYTES ||
      record.vectorBytes > maxBytes || record.vectors.byteLength !== record.vectorBytes || !/^[a-f0-9]{64}$/.test(record.sha256)) {
    throw fail('corrupt', 'Local pose-vector cache record is incomplete, mismatched or malformed; regenerate it');
  }
}
function integrityBytes(record) {
  const header = encoder.encode(JSON.stringify([record.schemaVersion, record.bankKey, record.completed, record.usedAt, record.keys, record.vectorBytes]));
  const bytes = new Uint8Array(4 + header.byteLength + record.vectorBytes);
  new DataView(bytes.buffer).setUint32(0, header.byteLength, true);
  bytes.set(header, 4); bytes.set(new Uint8Array(record.vectors), 4 + header.byteLength);
  return bytes;
}
function pack(record) {
  const {vectors, ...metadata} = record;
  metadata.usedAt = String(record.usedAt).padStart(16, '0');
  const header = encoder.encode(JSON.stringify(metadata));
  const bytes = new Uint8Array(4 + header.byteLength + vectors.byteLength);
  new DataView(bytes.buffer).setUint32(0, header.byteLength, true);
  bytes.set(header, 4); bytes.set(new Uint8Array(vectors), 4 + header.byteLength);
  return bytes;
}
function responseFor(bytes) {
  return new Response(bytes, {headers: {'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.byteLength)}});
}

/**
 * read(key, {signal}) -> null on miss or fresh [{key, vector: Float32Array(384)}]
 * write(key, entries, {signal}) -> {bankCount, vectorBytes, payloadBytes}
 * clear() -> void; clears this versioned owned cache only
 * status() -> {available: true, bankCount, vectorBytes, payloadBytes, limits}
 * Web Locks are required; unsupported browsers explicitly reject persistence.
 * Fixture budgets may lower, but never raise, the production limits.
 */
export function createFeatureBankStore({
  cacheStorage = globalThis.caches, locks = globalThis.navigator?.locks,
  cryptoImpl = globalThis.crypto, now = Date.now, origin = globalThis.location?.origin,
  maxBanks = FEATURE_BANK_LIMITS.banks, maxBytes = FEATURE_BANK_LIMITS.payloadBytes,
} = {}) {
  if (!Number.isInteger(maxBanks) || maxBanks < 1 || maxBanks > FEATURE_BANK_LIMITS.banks ||
      !Number.isInteger(maxBytes) || maxBytes < FLOAT_BYTES || maxBytes > FEATURE_BANK_LIMITS.payloadBytes || typeof now !== 'function') {
    throw fail('invalid', 'Invalid local pose-vector cache budget');
  }
  const limits = Object.freeze({banks: maxBanks, payloadBytes: maxBytes, entriesPerBank: FEATURE_BANK_LIMITS.entriesPerBank});
  let generation = 0;
  const current = (epoch, signal) => { check(signal); if (epoch !== generation) throw aborted(); };
  const timestamp = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) throw fail('invalid', 'Invalid local pose-vector timestamp');
    return value;
  };
  async function hash(bytes, signal) {
    check(signal);
    if (!cryptoImpl?.subtle?.digest) throw fail('unavailable', 'SHA-256 is unavailable for the local pose-vector cache');
    let digest;
    try { digest = await cryptoImpl.subtle.digest('SHA-256', bytes); } catch (error) { throw storageFailure(error, 'integrity'); }
    check(signal);
    if (!(digest instanceof ArrayBuffer) || digest.byteLength !== 32) throw fail('integrity-failed', 'Invalid local pose-vector SHA-256 digest');
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function baseURL() {
    let url;
    try { url = new URL(origin); } catch { throw fail('unavailable', 'A same-origin HTTP(S) location is required for the local pose-vector cache'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw fail('unavailable', 'A same-origin HTTP(S) location is required for the local pose-vector cache');
    return origin + '/__dq9_local_feature_banks__/v' + FEATURE_BANK_SCHEMA + '/';
  }
  const keyURL = async (bankKey, signal) => baseURL() + await hash(encoder.encode(bankKey), signal);
  async function locked(operation, signal, callback) {
    check(signal);
    if (!cacheStorage?.open || !cacheStorage?.delete) throw fail('unavailable', 'CacheStorage is unavailable; local pose vectors were not persisted');
    if (!locks?.request) throw fail('unavailable', 'Web Locks are required to safely persist local pose vectors across tabs');
    try {
      return await locks.request(FEATURE_BANK_CACHE_NAME + '-lock', {mode: 'exclusive', ...(signal ? {signal} : {})}, async () => {
        check(signal); return callback();
      });
    } catch (error) { throw storageFailure(error, operation); }
  }
  async function decode(response, bankKey, signal, includeEntries = true) {
    check(signal);
    const length = Number(response.headers.get('Content-Length'));
    if (!response.ok || !Number.isSafeInteger(length) || length < 4 || length > Math.min(maxBytes, MAX_BANK_BYTES) || !response.body?.getReader) {
      throw fail('corrupt', 'Local pose-vector payload size is invalid; regenerate it');
    }
    const bytes = new Uint8Array(length), reader = response.body.getReader(); let offset = 0;
    const cancel = () => { reader.cancel().catch(() => {}); };
    signal?.addEventListener('abort', cancel, {once: true});
    try {
      for (;;) {
        check(signal); const {done, value} = await reader.read(); check(signal);
        if (done) break;
        if (!(value instanceof Uint8Array) || offset + value.byteLength > length) throw fail('corrupt', 'Local pose-vector payload length mismatch');
        bytes.set(value, offset); offset += value.byteLength;
      }
      if (offset !== length) throw fail('corrupt', 'Local pose-vector payload is incomplete');
    } catch (error) { reader.cancel().catch(() => {}); throw error; }
    finally { signal?.removeEventListener('abort', cancel); reader.releaseLock(); }
    let record;
    try {
      const headerLength = new DataView(bytes.buffer).getUint32(0, true);
      if (headerLength < 2 || 4 + headerLength >= bytes.byteLength) throw Error('invalid header');
      record = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(4, 4 + headerLength)));
      if (!record || typeof record !== 'object' || Object.hasOwn(record, 'vectors')) throw Error('invalid metadata');
      if (typeof record.usedAt !== 'string' || !/^\d{16}$/.test(record.usedAt)) throw Error('invalid timestamp');
      record.usedAt = Number(record.usedAt);
      record.vectors = bytes.buffer.slice(4 + headerLength);
    } catch (error) { throw fail('corrupt', 'Local pose-vector payload header is malformed', error); }
    inspect(record, bankKey ?? record.bankKey, maxBytes);
    if (await hash(integrityBytes(record), signal) !== record.sha256) throw fail('corrupt', 'Local pose-vector cache SHA-256 mismatch; regenerate it');
    const view = new DataView(record.vectors), entries = [];
    for (let index = 0; index < record.keys.length; index++) {
      const vector = new Float32Array(FEATURE_BANK_LIMITS.dimensions);
      for (let i = 0; i < vector.length; i++) vector[i] = view.getFloat32(index * FLOAT_BYTES + i * 4, true);
      if (!normalized(vector)) throw fail('corrupt', 'Local pose-vector cache contains a non-normalized or non-finite vector');
      if (includeEntries) entries.push({key: record.keys[index], vector});
    }
    return {record, entries, bytes};
  }
  async function inventory(cache, signal, repair = false) {
    const requests = await cache.keys(); check(signal);
    // CacheStorage has no cursor API. Our lock and admission check keep its
    // key list bounded; reject external pollution instead of growing inventory.
    if (requests.length > maxBanks) throw fail('corrupt', 'Local pose-vector cache has too many records; clear it');
    const items = [], prefix = baseURL(); let total = 0;
    for (const request of requests) {
      try {
        if (request.method !== 'GET' || !request.url.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(request.url.slice(prefix.length))) throw fail('corrupt', 'Unexpected local pose-vector cache key');
        const response = await cache.match(request); check(signal);
        if (!response) throw fail('corrupt', 'Local pose-vector cache changed unexpectedly; retry');
        // Sequential validation retains descriptors only, never an inventory of
        // bank vectors. The next bank replaces these temporary decode buffers.
        const decoded = await decode(response, undefined, signal, false);
        if (await keyURL(decoded.record.bankKey, signal) !== request.url) throw fail('corrupt', 'Local pose-vector cache key mismatch');
        if (total + decoded.bytes.byteLength > maxBytes) throw fail('corrupt', 'Local pose-vector cache exceeds its payload budget; clear it');
        total += decoded.bytes.byteLength;
        items.push({url: request.url, usedAt: decoded.record.usedAt, vectorBytes: decoded.record.vectorBytes, payloadBytes: decoded.bytes.byteLength});
      } catch (error) {
        if (!repair || error?.code !== 'corrupt') throw error;
        await cache.delete(request); check(signal);
      }
    }
    return items;
  }
  async function putCompleted(cache, url, bytes, previous, epoch, signal) {
    current(epoch, signal);
    await cache.put(url, responseFor(bytes));
    try { current(epoch, signal); }
    catch (error) {
      // Cache.put cannot be aborted. Keep the lock through cleanup so another
      // tab never reads a cancelled publication. Restore an overwritten bank.
      try { if (previous) await cache.put(url, previous); else await cache.delete(url); }
      catch (rollbackError) { throw fail('rollback-failed', 'Cancelled cache write could not be removed; clear the local cache', rollbackError); }
      throw error;
    }
  }
  async function read(bankKey, {signal} = {}) {
    const epoch = generation; checkKey(bankKey);
    const url = await keyURL(bankKey, signal); current(epoch, signal);
    return locked('read', signal, async () => {
      current(epoch, signal);
      const cache = await cacheStorage.open(FEATURE_BANK_CACHE_NAME), response = await cache.match(url);
      current(epoch, signal); if (!response) return null;
      const decoded = await decode(response, bankKey, signal); current(epoch, signal);
      decoded.record.usedAt = timestamp();
      decoded.record.sha256 = await hash(integrityBytes(decoded.record), signal);
      const refreshed = pack(decoded.record);
      // Timestamps use fixed-width serialization below, so touches never raise
      // the payload budget and only the requested bank is loaded into memory.
      if (refreshed.byteLength !== decoded.bytes.byteLength) throw fail('corrupt', 'Local pose-vector metadata size changed unexpectedly');
      await putCompleted(cache, url, refreshed, responseFor(decoded.bytes), epoch, signal);
      return decoded.entries;
    });
  }
  async function write(bankKey, entries, {signal} = {}) {
    const epoch = generation; current(epoch, signal); checkKey(bankKey);
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > FEATURE_BANK_LIMITS.entriesPerBank) throw fail('invalid', 'A completed pose-vector bank needs 1..64 vectors');
    const keys = [], vectors = new ArrayBuffer(entries.length * FLOAT_BYTES), view = new DataView(vectors);
    for (const [index, entry] of entries.entries()) {
      if (!entry || Object.keys(entry).sort().join('|') !== 'key|vector' || !validKey(entry.key, FEATURE_BANK_LIMITS.entryKeyBytes) ||
          !(entry.vector instanceof Float32Array) || entry.vector.length !== FEATURE_BANK_LIMITS.dimensions) throw fail('invalid', 'Each entry needs only a bounded key and a finite normalized Float32Array(384)');
      const vector = new Float32Array(entry.vector);
      if (!normalized(vector)) throw fail('invalid', 'Pose vectors must be finite and normalized');
      keys.push(entry.key);
      for (let i = 0; i < vector.length; i++) view.setFloat32(index * FLOAT_BYTES + i * 4, vector[i], true);
    }
    if (new Set(keys).size !== keys.length) throw fail('invalid', 'Duplicate pose-vector entry keys');
    const record = {schemaVersion: FEATURE_BANK_SCHEMA, bankKey, completed: true, usedAt: timestamp(), keys, vectors, vectorBytes: vectors.byteLength};
    record.sha256 = await hash(integrityBytes(record), signal);
    const bytes = pack(record);
    if (bytes.byteLength > Math.min(maxBytes, MAX_BANK_BYTES)) throw fail('invalid', 'Completed pose-vector payload exceeds the cache byte budget');
    const url = await keyURL(bankKey, signal); current(epoch, signal);
    return locked('write', signal, async () => {
      current(epoch, signal);
      const cache = await cacheStorage.open(FEATURE_BANK_CACHE_NAME), items = await inventory(cache, signal, true);
      const previous = await cache.match(url), kept = items.filter(item => item.url !== url);
      kept.sort((a, b) => a.usedAt - b.usedAt || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
      let payloadBytes = kept.reduce((sum, item) => sum + item.payloadBytes, 0) + bytes.byteLength;
      while (kept.length + 1 > maxBanks || payloadBytes > maxBytes) {
        current(epoch, signal); const victim = kept.shift();
        await cache.delete(victim.url); payloadBytes -= victim.payloadBytes;
      }
      await putCompleted(cache, url, bytes, previous, epoch, signal);
      return {bankCount: kept.length + 1, vectorBytes: kept.reduce((sum, item) => sum + item.vectorBytes, 0) + record.vectorBytes, payloadBytes};
    });
  }
  async function clear() {
    generation++;
    await locked('clear', undefined, () => cacheStorage.delete(FEATURE_BANK_CACHE_NAME));
  }
  async function status() {
    return locked('status', undefined, async () => {
      const cache = await cacheStorage.open(FEATURE_BANK_CACHE_NAME), items = await inventory(cache);
      return {available: true, bankCount: items.length, vectorBytes: items.reduce((sum, item) => sum + item.vectorBytes, 0), payloadBytes: items.reduce((sum, item) => sum + item.payloadBytes, 0), limits};
    });
  }
  return Object.freeze({read, write, clear, status});
}
