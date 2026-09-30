import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_MODELS, LIMITS, RequestGate, RecognitionWorkerClient, cloneCaptureStamp, mountRecognitionPage, pointerROI, stampEquals, validateROI } from '../web/monster-recognize-page.mjs';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`ok ${passed} - ${name}`); };
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const stamp = { sourceId: 'local-test', sourceEpoch: 2, timelineSegment: 3, frameSerial: 4, romEpoch: 5, sourceFrame: { width: 640, height: 480 }, videoTime: 1.25, timestampBasis: 'video.currentTime (approximate)', capturedAt: '2026-09-30T23:00:00.000Z', enemyROI: { x: 10, y: 20, w: 40, h: 50 } };
check('capture clone owns both nested objects', () => { const copy = cloneCaptureStamp(stamp); copy.enemyROI.x++; copy.sourceFrame.width++; assert.equal(stamp.enemyROI.x, 10); assert.equal(stamp.sourceFrame.width, 640); });
check('valid ROI keeps integer source coordinates', () => assert.deepEqual(validateROI(stamp.enemyROI, stamp.sourceFrame), stamp.enemyROI));
for (const rect of [{ x: -1, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 0, h: 1 }, { x: 0, y: 0, w: 1025, h: 1 }, { x: 0.5, y: 0, w: 1, h: 1 }, { x: 630, y: 0, w: 20, h: 1 }]) check(`reject unsafe ROI ${JSON.stringify(rect)}`, () => assert.throws(() => validateROI(rect, stamp.sourceFrame)));
check('pointer ROI clamps the source edge and 1024 limit', () => { assert.deepEqual(pointerROI({ x: 10, y: 10 }, { x: 4000, y: 4000 }, { width: 4096, height: 4096 }), { x: 10, y: 10, w: 1024, h: 1024 }); assert.deepEqual(pointerROI({ x: 640, y: 480 }, { x: 640, y: 480 }, stamp.sourceFrame), { x: 639, y: 479, w: 1, h: 1 }); });
const gate = new RequestGate(); gate.begin('a', 5, stamp);
check('matching result is accepted', () => assert(gate.accepts({ type: 'result', id: 'a', romEpoch: 5, result: { captureStamp: cloneCaptureStamp(stamp) } })));
for (const key of ['sourceId', 'sourceEpoch', 'timelineSegment', 'frameSerial', 'romEpoch', 'videoTime', 'timestampBasis', 'capturedAt']) check(`stale ${key} rejected`, () => { const other = cloneCaptureStamp(stamp); other[key] = typeof other[key] === 'number' ? other[key] + 1 : `${other[key]}-stale`; assert(!gate.accepts({ type: 'result', id: 'a', romEpoch: 5, result: { captureStamp: other } })); });
check('stale ROI and frame geometry rejected', () => { const other = cloneCaptureStamp(stamp); other.enemyROI.w++; assert(!stampEquals(stamp, other)); other.enemyROI.w--; other.sourceFrame.width++; assert(!stampEquals(stamp, other)); });
check('source/ROM/ROI invalidation rejects even matching old replies', () => { gate.invalidate(); assert(!gate.accepts({ id: 'a', romEpoch: 5 })); });
check('new request rejects a previous request ID', () => { gate.begin('b', 5, stamp); assert(!gate.accepts({ id: 'a', romEpoch: 5 })); assert(gate.accepts({ id: 'b', romEpoch: 5 })); });

class MockWorker {
  messages = []; terminated = false;
  postMessage(message, transfer) {
    // Mirrors the actual Worker boundary: IDs must be nonempty strings.
    assert.equal(typeof message.id, 'string'); assert(message.id.length); assert(Number.isSafeInteger(message.romEpoch));
    this.messages.push({ message, transfer });
  }
  terminate() { this.terminated = true; }
  emit(message) { this.onmessage?.({ data: message }); }
}
const workers = []; const progress = [];
const client = new RecognitionWorkerClient({ factory: () => { const worker = new MockWorker(); workers.push(worker); return worker; }, onProgress: message => progress.push(message) });
const file = { name: 'test.nds', size: 600, arrayBuffer: async () => new ArrayBuffer(600) };
let promise = client.load(file, 5, 'load-1'); await settle();
check('ROM load uses ArrayBuffer transfer', () => { const request = workers[0].messages[0]; assert.equal(request.message.type, 'load'); assert.strictEqual(request.transfer[0], request.message.rom); });
workers[0].emit({ type: 'loaded', id: 'load-1', romEpoch: 4, catalog: [] });
check('old ROM epoch cannot complete load', () => assert.equal(client.pending.size, 1));
workers[0].emit({ type: 'loaded', id: 'load-1', romEpoch: 5, catalog: [] }); await promise;
const crop = { width: 1, height: 1, rgba: new Uint8ClampedArray(4) };
promise = client.recognize({ type: 'recognize', id: 'score-1', romEpoch: 5, crop }); const canceled = assert.rejects(promise, { name: 'AbortError' });
workers[0].emit({ type: 'progress', id: 'score-1', romEpoch: 5, done: 1, total: 2 });
client.terminate(); await canceled;
check('cancel immediately terminates Worker and invalidates load state', () => { assert(workers[0].terminated); assert.equal(client.loadedRomEpoch, null); assert.equal(client.pending.size, 0); assert.equal(progress.length, 1); });
workers[0].emit({ type: 'progress', id: 'score-1', romEpoch: 5, done: 2, total: 2 });
check('terminated Worker cannot publish late progress', () => assert.equal(progress.length, 1));
let finishRead; promise = client.load({ size: 600, arrayBuffer: () => new Promise(resolve => { finishRead = resolve; }) }, 6, 'load-2');
const canceledRead = assert.rejects(promise, { name: 'AbortError' }); client.terminate(); finishRead(new ArrayBuffer(600)); await canceledRead;
check('cancel during File read never creates a Worker', () => assert.equal(workers.length, 1));
promise = client.load(file, 6, 'load-3'); await settle(); workers[1].emit({ type: 'loaded', id: 'load-3', romEpoch: 6, catalog: [] }); await promise;
check('restart uses a fresh Worker and retained File', () => { assert.equal(workers.length, 2); assert.equal(client.loadedRomEpoch, 6); }); client.terminate();
let rejectOldRead;
const oldRead = client.load({ size: 600, arrayBuffer: () => new Promise((resolve, reject) => { rejectOldRead = reject; }) }, 7, 'old-read');
const oldReadCanceled = assert.rejects(oldRead, { name: 'AbortError' }); client.terminate();
const newestLoad = client.load(file, 7, 'new-read'); await settle(); workers[2].emit({ type: 'loaded', id: 'new-read', romEpoch: 7, catalog: [] }); await newestLoad;
rejectOldRead(new Error('late disk failure')); await oldReadCanceled;
check('late failed File read after same-ROM retry stays canceled', () => assert.equal(client.loadedRomEpoch, 7)); client.terminate();
await assert.rejects(client.load({ size: LIMITS.romBytes + 1 }, 1, 'oversized'), /512/); passed++; console.log(`ok ${passed} - oversized ROM rejected before reading`);

// A minimal event-driven DOM harness exercises control state without launching a browser.
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.attributes = new Map(); this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.width = 640; this.height = 360; this.className = ''; this.classList = { add() {}, remove() {}, toggle() {} }; this.files = []; }
  addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
  async trigger(type, data = {}) { const event = { type, preventDefault() {}, ...data }; await Promise.all((this.listeners.get(type) || []).map(fn => fn(event))); }
  click() { return this.trigger('click'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  setPointerCapture(id) { this.pointer = id; }
  hasPointerCapture(id) { return this.pointer === id; }
  releasePointerCapture() { this.pointer = null; }
  getContext() {
    if (!this.context) this.context = { snapshot: 0, clearRect() {}, save() {}, restore() {}, fillRect() {}, strokeRect() {}, putImageData() {}, drawImage(source) { this.snapshot = source.frameValue ?? source.context?.snapshot ?? 0; }, getImageData(x, y, width, height) { return { data: new Uint8ClampedArray(width * height * 4).fill(this.snapshot) }; }, createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; } };
    return this.context;
  }
  pause() { this.paused = true; }
  async play() { this.paused = false; }
  load() {}
}
const html = await readFile(new URL('../web/monster-recognize.html', import.meta.url), 'utf8');
const elements = new Map([...html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(match => [match[2], new Element(match[1])]));
const doc = { getElementById: id => { assert(elements.has(id), `missing HTML element ${id}`); return elements.get(id); }, createElement: tag => new Element(tag) };
const win = new Element('window'); const ui = mountRecognitionPage(doc, win); const el = id => elements.get(id);
el('variant').value = '_f'; el('preset').value = 'quick'; el('top-k').value = '4';
const uiWorkers = []; ui.client.factory = () => { const worker = new MockWorker(); uiWorkers.push(worker); return worker; };
const catalog = [...DEFAULT_MODELS, 'z999x'].map(modelId => ({ modelId, speciesCandidates: [{ monsterId: 1, nameJa: `名前-${modelId}` }] }));
check('initial controls block recognition until capture and catalog exist', () => { assert(el('start').disabled); assert(el('cancel').disabled); });
el('rom-file').files = [file]; let romRead = ui.selectROM(); await settle(); const firstLoad = uiWorkers[0].messages[0].message;
check('page-generated load ID matches actual Worker string contract', () => { assert.match(firstLoad.id, /^request-\d+$/); assert(!el('cancel').disabled); });
await el('cancel').click(); await romRead;
check('cancel initial ROM load leaves an enabled File reread action', () => { assert(uiWorkers[0].terminated); assert(!el('restart').disabled); assert.equal(el('restart').textContent, 'NDSを再読込'); });
const retry = el('restart').click(); await settle(); const retryLoad = uiWorkers[1].messages[0].message;
uiWorkers[1].emit({ type: 'loaded', id: retryLoad.id, romEpoch: retryLoad.romEpoch, catalog }); await retry;
check('reread restores default four candidates', () => { assert.equal(ui.state.selected.size, 4); assert.equal(el('model-count').textContent, '4 / 4'); });
const fifth = el('model-list').children[4].children[0]; fifth.checked = true; await fifth.trigger('change');
check('fifth model selection is rejected', () => { assert(!fifth.checked); assert.equal(ui.state.selected.size, 4); });
const video = el('source-video'); Object.assign(video, { videoWidth: 640, videoHeight: 480, currentTime: 1.25, duration: 20, readyState: 4, seeking: false, frameValue: 37 });
Object.assign(ui.state, { sourceReady: true, sourceKind: 'video', sourceId: 'video-test', sourceEpoch: 2, timelineSegment: 3 }); ui.freeze();
check('freeze alone does not invent an enemy ROI', () => { assert.equal(ui.state.roi, null); assert(el('start').disabled); });
ui.setROI({ x: 10, y: 20, w: 40, h: 50 });
check('explicit numeric ROI enables scoring', () => { assert(!el('start').disabled); assert.equal(el('crop-size').textContent, '40 × 50 px · x 10, y 20'); });
video.frameValue = 99; video.currentTime = 2; await video.trigger('seeking');
let scoring = ui.recognize(); await settle(); let scoreRequest = uiWorkers[1].messages.at(-1).message;
check('request copies the frozen pixels and original timestamp, not moving video', () => { assert.equal(scoreRequest.crop.rgba[0], 37); assert.equal(scoreRequest.captureStamp.videoTime, 1.25); assert.equal(scoreRequest.captureStamp.timelineSegment, 3); assert.equal(ui.state.timelineSegment, 4); });
check('score request transfers crop and disables duplicate Start', () => { assert.equal(scoreRequest.type, 'recognize'); assert.match(scoreRequest.id, /^request-/); assert(el('start').disabled); assert(!el('cancel').disabled); assert(!el('restart').disabled); });
const previousRequest = scoreRequest;
ui.setROI({ x: 11, y: 20, w: 40, h: 50 }); await scoring;
check('ROI edit cancels active Worker and clears scoring state', () => { assert(uiWorkers[1].terminated); assert(!ui.state.busy); assert(!el('start').disabled); });
uiWorkers[1].emit({ type: 'result', id: previousRequest.id, romEpoch: previousRequest.romEpoch, result: { captureStamp: previousRequest.captureStamp, rankings: [{ modelId: 'stale' }] } });
check('old ROI result cannot populate rankings', () => assert.equal(el('rankings').children.length, 0));
scoring = ui.recognize(); await settle(); const thirdLoad = uiWorkers[2].messages[0].message; uiWorkers[2].emit({ type: 'loaded', id: thirdLoad.id, romEpoch: thirdLoad.romEpoch, catalog }); await settle(); scoreRequest = uiWorkers[2].messages.at(-1).message;
const mismatch = cloneCaptureStamp(scoreRequest.captureStamp); mismatch.enemyROI.x++;
uiWorkers[2].emit({ type: 'result', id: scoreRequest.id, romEpoch: scoreRequest.romEpoch, result: { captureStamp: mismatch, rankings: [] } }); await scoring;
check('mismatched result stamp is discarded with usable controls', () => { assert.equal(el('rankings').children.length, 0); assert(!ui.state.busy); assert(!el('start').disabled); assert.match(el('error').textContent, /一致しない/); });
scoring = ui.recognize(); await settle(); scoreRequest = uiWorkers[2].messages.at(-1).message;
uiWorkers[2].emit({ type: 'result', id: scoreRequest.id, romEpoch: scoreRequest.romEpoch, result: { captureStamp: scoreRequest.captureStamp, rankings: [{ modelId: 'z000c', speciesCandidates: [{ nameJa: 'テスト候補' }], distance: 0.2, bestPose: { variant: '_f', clip: 'stand', frame: 0, yaw: 0, pitch: 0 } }], unknown: { suggested: true, calibrated: false, reason: '未校正' }, coverage: { requestedModels: 4, completedModels: 1, renderedTemplates: 16, unsupported: [] }, limitations: [], elapsedMs: 50 } }); await scoring;
check('ranking appears with explicit unknown and coverage', () => { assert.equal(el('rankings').children.length, 1); assert.match(el('unknown-status').textContent, /候補外・判別不能/); assert.match(el('coverage').textContent, /要求モデル: 4/); assert(!el('coverage-section').hidden); });
await el('variant').trigger('change');
check('variant changes invalidate prior result', () => assert.equal(el('rankings').children.length, 0));
scoring = ui.recognize(); await settle(); await win.trigger('pagehide'); await scoring; await win.trigger('pageshow', { persisted: true });
check('back-forward restore clears stale busy/loading and allows next work', () => { assert(!ui.state.disposed); assert(!ui.state.busy); assert(!ui.state.loading); assert.equal(ui.state.capture, null); assert(el('cancel').disabled); assert(ui.state.romFile === file); });
check('all required frozen capture keys are retained', () => { for (const key of Object.keys(stamp)) assert(key in previousRequest.captureStamp); });
console.log(`\n${passed} UI and lifecycle checks passed (Node DOM harness; no browser launched).`);
