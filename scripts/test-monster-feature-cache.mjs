import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {FEATURE_BANK_CACHE_NAME, FEATURE_BANK_SCHEMA, FEATURE_BANK_LIMITS, FeatureBankCacheError, createFeatureBankStore} from '../web/monster-feature-cache.mjs';

const keyFor = request => typeof request === 'string' ? request : request.url;
class MemoryCache {
  constructor() { this.items = new Map(); this.puts = 0; this.maxEntries = 0; this.maxBytes = 0; }
  async match(request) { return this.items.get(keyFor(request))?.clone(); }
  async keys() { return [...this.items.keys()].map(url => new Request(url)); }
  async delete(request) { return this.items.delete(keyFor(request)); }
  async put(request, response) {
    if (this.failPut) { this.failPut = false; throw new DOMException('full', 'QuotaExceededError'); }
    await this.beforePut?.();
    const bytes = await response.arrayBuffer();
    this.items.set(keyFor(request), new Response(bytes, {headers: response.headers})); this.puts++;
    this.maxEntries = Math.max(this.maxEntries, this.items.size);
    this.maxBytes = Math.max(this.maxBytes, [...this.items.values()].reduce((sum, value) => sum + Number(value.headers.get('Content-Length')), 0));
    await this.afterPut?.();
  }
}
class MemoryCacheStorage {
  constructor() { this.items = new Map(); this.opens = 0; }
  async open(name) { this.opens++; if (!this.items.has(name)) this.items.set(name, new MemoryCache()); return this.items.get(name); }
  async keys() { return [...this.items.keys()]; }
  async delete(name) { return this.items.delete(name); }
}
// Web Locks fixture serializes all instances with the same lock name. Abort
// cancels a queued acquisition; acquired callbacks finish/clean up themselves.
class MemoryLocks {
  constructor() { this.tails = new Map(); this.active = 0; this.maxActive = 0; }
  request(name, options, callback) {
    assert.equal(options.mode, 'exclusive');
    return new Promise((resolve, reject) => {
      let acquired = false;
      const cancel = () => { if (!acquired) reject(new DOMException('cancelled', 'AbortError')); };
      options.signal?.addEventListener('abort', cancel, {once: true});
      const work = (this.tails.get(name) ?? Promise.resolve()).then(async () => {
        if (options.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
        acquired = true; this.active++; this.maxActive = Math.max(this.maxActive, this.active);
        try { return await callback({name, mode: 'exclusive'}); }
        finally { this.active--; }
      });
      this.tails.set(name, work.catch(() => {}));
      work.then(resolve, reject).finally(() => options.signal?.removeEventListener('abort', cancel));
      if (options.signal?.aborted) cancel();
    });
  }
}
let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const rejects = async (work, expected) => { await assert.rejects(work, expected); checks++; };
const isCode = code => error => error instanceof FeatureBankCacheError && error.code === code && error.recoverable === true;
const unit = (index = 0) => { const vector = new Float32Array(384); vector[index] = 1; return vector; };
const entry = (key = 'pose-0', index = 0) => ({key, vector: unit(index)});
const entries = count => Array.from({length: count}, (_, i) => entry('pose-' + i, i % 384));
const origin = 'https://fixture.example';
function setup(options = {}) {
  const cacheStorage = new MemoryCacheStorage(), locks = new MemoryLocks(); let tick = 0;
  const config = {cacheStorage, locks, cryptoImpl: webcrypto, now: () => ++tick, origin, ...options};
  return {cacheStorage, locks, config, store: createFeatureBankStore(config)};
}
const urlFor = key => origin + '/__dq9_local_feature_banks__/v1/' + createHash('sha256').update(key).digest('hex');
const bankKey = JSON.stringify({romSha256: 'a'.repeat(64), weightSha256: 'b'.repeat(64), revision: 'pinned', provider: 'webgpu', precision: 'fp32', renderer: 'v1', pose: 'frame-0', preprocess: '224-normalized'});
async function unpack(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const size = new DataView(bytes.buffer).getUint32(0, true);
  return {metadata: JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + size))), vectors: bytes.slice(4 + size)};
}
function repack({metadata, vectors}) {
  const header = new TextEncoder().encode(JSON.stringify(metadata));
  const bytes = new Uint8Array(4 + header.length + vectors.length);
  new DataView(bytes.buffer).setUint32(0, header.length, true); bytes.set(header, 4); bytes.set(vectors, 4 + header.length);
  return new Response(bytes, {headers: {'Content-Length': String(bytes.length)}});
}
function gate() {
  let release, enter;
  return {started: new Promise(resolve => { enter = resolve; }), promise: new Promise(resolve => { release = resolve; }), release: () => release(), enter: () => enter()};
}
function pausedCrypto() {
  const barrier = gate();
  return {...barrier, cryptoImpl: {subtle: {async digest(...args) { barrier.enter(); await barrier.promise; return webcrypto.subtle.digest(...args); }}}};
}

eq(FEATURE_BANK_LIMITS.banks, 256); eq(FEATURE_BANK_LIMITS.payloadBytes, 32 * 1024 * 1024); eq(FEATURE_BANK_SCHEMA, 1);
const happy = setup();
eq(await happy.store.read(bankKey), null);
const written = await happy.store.write(bankKey, [entry('one'), entry('two', 1)]);
eq(written.bankCount, 1); eq(written.vectorBytes, 3072); eq(written.payloadBytes > written.vectorBytes, true);
const reopened = createFeatureBankStore(happy.config);
const loaded = await reopened.read(bankKey); eq(loaded, [entry('one'), entry('two', 1)]);
loaded[0].vector[0] = 0; eq((await happy.store.read(bankKey))[0].vector[0], 1);
eq(await happy.store.read(bankKey + '-provider-or-rom-mismatch'), null);
const cache = await happy.cacheStorage.open(FEATURE_BANK_CACHE_NAME);
eq((await cache.keys()).map(request => request.url), [urlFor(bankKey)]);
eq(Object.keys((await unpack(await cache.match(urlFor(bankKey)))).metadata).sort(), ['bankKey', 'completed', 'keys', 'schemaVersion', 'sha256', 'usedAt', 'vectorBytes']);
eq((await happy.store.status()).payloadBytes, written.payloadBytes);

// Input snapshot, strict finite/normalized 384-vector validation and no pixels.
const mutable = [entry('mutable')], pending = happy.store.write('snapshot', mutable);
mutable[0].key = 'changed'; mutable[0].vector.fill(0); await pending;
eq(await happy.store.read('snapshot'), [entry('mutable')]);
const invalid = setup();
for (const value of [[], entries(65), [entry('same'), entry('same')], [{key: '', vector: unit()}],
  [{key: 'x', vector: new Float32Array(383)}], [{key: 'x', vector: new Float32Array(384)}],
  [{key: 'x', vector: Float32Array.from({length: 384}, () => NaN)}], [{key: 'x', vector: Float32Array.from({length: 384}, () => Infinity)}],
  [{key: 'x', vector: Array.from(unit())}], [{...entry(), pixels: new Uint8Array(4)}], [{key: '長'.repeat(2000), vector: unit()}]]) {
  await rejects(() => invalid.store.write('invalid', value), isCode('invalid'));
}
for (const value of ['', null, 2, 'a'.repeat(16385), '長'.repeat(6000)]) await rejects(() => invalid.store.write(value, [entry()]), isCode('invalid'));
eq(invalid.cacheStorage.opens, 0);
await happy.store.write('maximum', entries(64)); eq((await happy.store.read('maximum')).length, 64);

// Corruption and partial/wrong-schema banks never become hits.
const good = await unpack(await cache.match(urlFor(bankKey)));
const corruptions = [
  record => { record.vectors[3] ^= 1; }, record => { record.metadata.sha256 = '0'.repeat(64); },
  record => { record.metadata.keys[0] = 'altered'; }, record => { record.metadata.usedAt = '0000000000000099'; },
  record => { record.metadata.bankKey = 'wrong-key'; }, record => { record.metadata.schemaVersion++; },
  record => { record.metadata.completed = false; }, record => { record.metadata.vectorBytes--; },
  record => { record.vectors = new Uint8Array(10); }, record => { record.metadata.keys = Array(65).fill('x'); },
  record => { record.metadata.keys[1] = record.metadata.keys[0]; }, record => { record.metadata.framePixels = [1, 2]; },
];
for (const corrupt of corruptions) {
  const bad = structuredClone(good); corrupt(bad); cache.items.set(urlFor(bankKey), repack(bad));
  await rejects(() => happy.store.read(bankKey), isCode('corrupt'));
}
cache.items.set(urlFor(bankKey), new Response(new Uint8Array(30), {headers: {'Content-Length': '20'}}));
await rejects(() => happy.store.read(bankKey), isCode('corrupt'));
cache.items.set(urlFor(bankKey), new Response(new Uint8Array(10), {headers: {'Content-Length': '20'}}));
await rejects(() => happy.store.read(bankKey), isCode('corrupt'));
cache.items.set(urlFor(bankKey), repack(good));
const zeros = structuredClone(good); zeros.vectors.fill(0);
const header = new TextEncoder().encode(JSON.stringify([zeros.metadata.schemaVersion, zeros.metadata.bankKey, zeros.metadata.completed, Number(zeros.metadata.usedAt), zeros.metadata.keys, zeros.metadata.vectorBytes]));
const hashInput = new Uint8Array(4 + header.length + zeros.vectors.length); new DataView(hashInput.buffer).setUint32(0, header.length, true); hashInput.set(header, 4); hashInput.set(zeros.vectors, 4 + header.length);
zeros.metadata.sha256 = createHash('sha256').update(hashInput).digest('hex'); cache.items.set(urlFor(bankKey), repack(zeros));
await rejects(() => happy.store.read(bankKey), isCode('corrupt'));
await happy.store.write(bankKey, [entry()]); eq(await happy.store.read(bankKey), [entry()]);

// Actual serialized payload budgets include metadata; reads refresh LRU.
const bounded = setup({maxBanks: 2});
await bounded.store.write('old', [entry()]); await bounded.store.write('middle', [entry()]);
await bounded.store.read('old'); await bounded.store.write('new', [entry()]);
eq(await bounded.store.read('middle'), null); eq(await bounded.store.read('old'), [entry()]);
eq((await bounded.store.status()).bankCount, 2);
const bytesBounded = setup({maxBytes: 4000});
await bytesBounded.store.write('older', entries(2));
const kept = await bytesBounded.store.write('newer', entries(2)); eq(kept.bankCount, 1); eq(kept.payloadBytes <= 4000, true);
eq(await bytesBounded.store.read('older'), null);
await rejects(() => bytesBounded.store.write('too-large', entries(4)), isCode('invalid'));
const bytesCache = await bytesBounded.cacheStorage.open(FEATURE_BANK_CACHE_NAME); eq(bytesCache.maxBytes <= 4000, true);
// Independent stores share locks, so racing admissions never exceed either cap.
const concurrent = setup({maxBanks: 2, maxBytes: 4000});
const other = createFeatureBankStore(concurrent.config);
await Promise.all([concurrent.store.write('a', [entry()]), other.write('b', [entry()]), concurrent.store.write('c', [entry()]), other.write('d', [entry()])]);
const concurrentCache = await concurrent.cacheStorage.open(FEATURE_BANK_CACHE_NAME);
eq((await concurrent.store.status()).bankCount, 2); eq(concurrentCache.maxEntries, 2); eq(concurrentCache.maxBytes <= 4000, true); eq(concurrent.locks.maxActive, 1);
// A touch across decimal timestamp widths cannot expand the byte budget.
let tick = 9; const ticks = setup({now: () => tick++}); const tickWrite = await ticks.store.write('tick', [entry()]);
await ticks.store.read('tick'); eq((await ticks.store.status()).payloadBytes, tickWrite.payloadBytes);

// Cancellation before/during hashing, lock acquisition, and atomic put.
const aborted = new AbortController(); aborted.abort();
await rejects(() => happy.store.write('aborted', [entry()], {signal: aborted.signal}), {name: 'AbortError'});
await rejects(() => happy.store.read(bankKey, {signal: aborted.signal}), {name: 'AbortError'});
const pause = pausedCrypto(), hashAbort = new AbortController();
const hashStore = createFeatureBankStore({...happy.config, cryptoImpl: pause.cryptoImpl});
const cancelledHash = hashStore.write('cancel-hash', [entry()], {signal: hashAbort.signal});
await pause.started; hashAbort.abort(); pause.release(); await rejects(() => cancelledHash, {name: 'AbortError'}); eq(await happy.store.read('cancel-hash'), null);
const putAbort = new AbortController(); cache.afterPut = () => putAbort.abort();
await rejects(() => happy.store.write(bankKey, [entry('replacement')], {signal: putAbort.signal}), {name: 'AbortError'});
cache.afterPut = null; eq(await happy.store.read(bankKey), [entry()]);
const freshAbort = new AbortController(); cache.afterPut = () => freshAbort.abort();
await rejects(() => happy.store.write('cancel-new', [entry()], {signal: freshAbort.signal}), {name: 'AbortError'});
cache.afterPut = null; eq(await happy.store.read('cancel-new'), null);
const hold = gate(), waiting = new AbortController();
const holdingLock = happy.locks.request(FEATURE_BANK_CACHE_NAME + '-lock', {mode: 'exclusive'}, async () => { hold.enter(); await hold.promise; });
await hold.started;
const queued = happy.store.write('cancel-wait', [entry()], {signal: waiting.signal});
waiting.abort(); const queueRejected = rejects(() => queued, {name: 'AbortError'}); hold.release(); await holdingLock; await queueRejected;
eq(await happy.store.read('cancel-wait'), null);

// clear invalidates pending local work and remains serialized across instances.
const clearPause = pausedCrypto(), clearStore = createFeatureBankStore({...happy.config, cryptoImpl: clearPause.cryptoImpl});
const clearPending = clearStore.write('must-not-return', [entry()]);
await clearPause.started; await clearStore.clear(); clearPause.release(); await rejects(() => clearPending, {name: 'AbortError'});
eq((await happy.store.status()).bankCount, 0);
const duringPut = setup(), duringCache = await duringPut.cacheStorage.open(FEATURE_BANK_CACHE_NAME), putGate = gate();
duringCache.beforePut = async () => { putGate.enter(); await putGate.promise; };
const pendingPut = duringPut.store.write('pending', [entry()]); await putGate.started;
const clearing = duringPut.store.clear(); putGate.release();
await rejects(() => pendingPut, {name: 'AbortError'}); await clearing;
eq((await duringPut.store.status()).bankCount, 0);

// Explicit, recoverable failure modes: unavailable storage/locks/crypto, quota.
const quota = setup(); await quota.store.write('keep', [entry()]);
const quotaCache = await quota.cacheStorage.open(FEATURE_BANK_CACHE_NAME); quotaCache.failPut = true;
await rejects(() => quota.store.write('keep', [entry('replace')]), isCode('quota'));
eq(await quota.store.read('keep'), [entry()]);
for (const override of [{cacheStorage: null}, {locks: null}]) {
  const unavailable = createFeatureBankStore({...quota.config, ...override});
  for (const action of [() => unavailable.read('x'), () => unavailable.write('x', [entry()]), () => unavailable.status(), () => unavailable.clear()]) await rejects(action, isCode('unavailable'));
}
const noCrypto = createFeatureBankStore({...quota.config, cryptoImpl: null});
await rejects(() => noCrypto.read('keep'), isCode('unavailable')); await rejects(() => noCrypto.write('x', [entry()]), isCode('unavailable'));
const badOrigin = createFeatureBankStore({...quota.config, origin: 'file://'}); await rejects(() => badOrigin.read('keep'), isCode('unavailable'));
const badCrypto = createFeatureBankStore({...quota.config, cryptoImpl: {subtle: {digest: async () => { throw Error('bad hash'); }}}});
await rejects(() => badCrypto.write('x', [entry()]), isCode('integrity-failed'));

// Dedicated versioned namespace. Clearing never alters inference or other caches.
const inference = await quota.cacheStorage.open('dq9-monster-inference-v1');
await inference.put('https://fixture.example/model.onnx', new Response('retain'));
const unrelated = await quota.cacheStorage.open('other-app'); await unrelated.put('https://fixture.example/other', new Response('other'));
await quota.store.clear(); eq((await quota.store.status()).bankCount, 0);
eq(await (await inference.match('https://fixture.example/model.onnx')).text(), 'retain');
eq(await (await unrelated.match('https://fixture.example/other')).text(), 'other');
const polluted = setup({maxBanks: 2}); const pollutedCache = await polluted.cacheStorage.open(FEATURE_BANK_CACHE_NAME);
for (let i = 0; i < 3; i++) pollutedCache.items.set(origin + '/' + i, new Response('bad'));
await rejects(() => polluted.store.status(), isCode('corrupt')); await polluted.store.clear(); eq((await polluted.store.status()).bankCount, 0);
// Populate a full production-sized synthetic inventory without O(n²) setup.
const production = setup({now: () => 1000}), productionCache = await production.cacheStorage.open(FEATURE_BANK_CACHE_NAME);
for (let i = 0; i < 256; i++) {
  const item = structuredClone(good), key = 'bank-' + String(i).padStart(3, '0');
  item.metadata.bankKey = key; item.metadata.usedAt = String(i).padStart(16, '0');
  const header = new TextEncoder().encode(JSON.stringify([item.metadata.schemaVersion, key, true, i, item.metadata.keys, item.metadata.vectorBytes]));
  const bytes = new Uint8Array(4 + header.length + item.vectors.length);
  new DataView(bytes.buffer).setUint32(0, header.length, true); bytes.set(header, 4); bytes.set(item.vectors, 4 + header.length);
  item.metadata.sha256 = createHash('sha256').update(bytes).digest('hex');
  productionCache.items.set(urlFor(key), repack(item));
}
eq((await production.store.status()).bankCount, 256);
eq((await production.store.write('bank-new', [entry()])).bankCount, 256);
eq(await production.store.read('bank-000'), null);
eq((await production.store.read('bank-255')).length, 2);
eq(productionCache.maxEntries, 256);
console.log(JSON.stringify({passed: true, checks, syntheticOnly: true, remoteDownloads: 0, browserCacheStorageAndLocksTested: false}, null, 2));
