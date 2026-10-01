import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CENTER_MASK, DEFAULT_MODELS, LIMITS, RequestGate, RecognitionWorkerClient, cloneCaptureStamp, gameplayROIForLayout, mountRecognitionPage, pointerROI, stampEquals, validateROI } from '../web/monster-recognize-page.mjs';

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
    if (!this.context) this.context = { snapshot: 0, clearRect() {}, save() {}, restore() {}, fillRect() {}, strokeRect() {}, fillText() {}, putImageData() {}, drawImage(source) { this.snapshot = source.frameValue ?? source.context?.snapshot ?? 0; }, getImageData(x, y, width, height) { return { data: new Uint8ClampedArray(width * height * 4).fill(this.snapshot) }; }, createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; } };
    return this.context;
  }
  pause() { this.paused = true; }
  async play() { this.paused = false; }
  load() {}
}
const html = await readFile(new URL('../web/monster-recognize.html', import.meta.url), 'utf8');
const elements = new Map([...html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(match => [match[2], new Element(match[1])]));
const doc = { getElementById: id => { assert(elements.has(id), `missing HTML element ${id}`); return elements.get(id); }, createElement: tag => new Element(tag) };
let probeGPU = async () => ({}), clearLocalFeatures = async () => {}; let prepareInference = async () => ({}); const preparationCalls = [];
const proposalCalls = [];
let proposalFactory = (image, captureStamp) => ({ captureStamp: cloneCaptureStamp(captureStamp), elapsedMs: 3, proposals: [{ proposalId: `${captureStamp.frameSerial}:0`, roi: { x: 40, y: 45, w: 50, h: 60 } }, { proposalId: `${captureStamp.frameSerial}:1`, roi: { x: 430, y: 80, w: 70, h: 90 } }], unknown: { suggested: true, calibrated: false } });
const defaultProposalFactory = proposalFactory;
const win = new Element('window'); const ui = mountRecognitionPage(doc, win, { proposeROIs: (image, captureStamp, options) => { proposalCalls.push({ firstPixel: image.rgba[0], captureStamp: cloneCaptureStamp(captureStamp), options }); return proposalFactory(image, captureStamp, options); }, probeWebGPU: options => probeGPU(options), clearFeatureCache: () => clearLocalFeatures(), ensureInferenceAssets: options => { preparationCalls.push(options); return prepareInference(options); } }); const el = id => elements.get(id);
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

check('OBS preset uses the explicit right-hand 4:3 DS panel', () => assert.deepEqual(gameplayROIForLayout('obs-right-upper', { width: 1920, height: 1080 }), { x: 960, y: 0, w: 960, h: 720 }));
check('stacked preset selects the lower DS screen', () => assert.deepEqual(gameplayROIForLayout('stacked-lower', { width: 256, height: 384 }), { x: 0, y: 192, w: 256, h: 192 }));
check('layout rejects an out-of-bounds OBS panel', () => assert.throws(() => gameplayROIForLayout('obs-right-upper', { width: 1920, height: 500 }), /はみ出/));
check('manual gameplay region may exceed the enemy ROI size cap', () => assert.deepEqual(gameplayROIForLayout('manual', { width: 1920, height: 1080 }, { x: 0, y: 0, w: 1920, h: 1080 }), { x: 0, y: 0, w: 1920, h: 1080 }));
const sceneStamp = { ...stamp, featureMethod: 'dinov2', sceneContext: { kind: 'field', gameplayROI: { x: 0, y: 0, w: 640, h: 480 }, excludeCenter: true, maskNormalized: { ...CENTER_MASK } } };
check('scene and mask are deep cloned per scoring request', () => { const copy = cloneCaptureStamp(sceneStamp); copy.sceneContext.gameplayROI.x++; copy.sceneContext.maskNormalized.x++; assert.equal(sceneStamp.sceneContext.gameplayROI.x, 0); assert.equal(sceneStamp.sceneContext.maskNormalized.x, .42); });
for (const key of ['featureMethod', 'kind', 'gameplayROI', 'excludeCenter', 'maskNormalized']) check(`result gate rejects stale ${key}`, () => {
  const guard = new RequestGate(); guard.begin('scene', 5, sceneStamp); const other = cloneCaptureStamp(sceneStamp);
  if (key === 'featureMethod') other.featureMethod = 'histogram';
  else if (key === 'kind') other.sceneContext.kind = 'unspecified';
  else if (key === 'excludeCenter') other.sceneContext.excludeCenter = false;
  else other.sceneContext[key].x++;
  assert(!guard.accepts({ type: 'result', id: 'scene', romEpoch: 5, result: { captureStamp: other } }));
});
async function beginScoring() {
  const completion = ui.recognize(); await settle(); const worker = uiWorkers.at(-1); const request = worker.messages.at(-1)?.message;
  if (request?.type === 'load') { worker.emit({ type: 'loaded', id: request.id, romEpoch: request.romEpoch, catalog }); await settle(); }
  return { completion, worker };
}
function emitResult(worker, request, overrides = {}) {
  worker.emit({ type: 'result', id: request.id, romEpoch: request.romEpoch, result: { captureStamp: request.captureStamp, featureMethod: request.featureMethod, metric: request.featureMethod === 'dinov2' ? 'cosine' : 'distance', rankings: [{ modelId: 'z000c', speciesCandidates: [{ nameJa: 'テスト候補' }], similarity: .75, distance: .25 }], unknown: { suggested: true, calibrated: false }, coverage: { requestedModels: 4, completedModels: 1, renderedTemplates: 16, unsupported: [] }, limitations: [], elapsedMs: 10, ...overrides } });
}
Object.assign(video, { videoWidth: 1920, videoHeight: 1080, currentTime: 1.25, frameValue: 37 });
Object.assign(ui.state, { sourceReady: true, sourceKind: 'video', sourceId: 'dino-video', sourceEpoch: 3 });
el('scene-kind').value = 'unspecified'; el('gameplay-layout').value = 'obs-right-upper'; el('exclude-center').checked = true;
ui.freeze(); ui.setROI({ x: 1000, y: 50, w: 40, h: 50 });
let dinoJob = await beginScoring(); let dinoRequest = dinoJob.worker.messages.at(-1).message;
check('image dimensions never assert field context or activate center masking', () => { assert.equal(dinoRequest.featureMethod, 'histogram'); assert.equal(dinoRequest.sceneContext.kind, 'unspecified'); assert.equal(dinoRequest.sceneContext.gameplayROI, null); assert.equal(dinoRequest.sceneContext.excludeCenter, false); assert.equal(preparationCalls.length, 0); });
emitResult(dinoJob.worker, dinoRequest); await dinoJob.completion;
el('feature-method').value = 'dinov2'; el('preset').value = 'standard'; await el('feature-method').trigger('change');
check('DINO standard preset is visibly blocked without silently changing it', () => { assert(el('start').disabled); assert(!el('configuration-error').hidden); assert.equal(el('preset').value, 'standard'); });
el('preset').value = 'quick'; el('variant').value = 'both'; await el('variant').trigger('change');
check('DINO both variants is visibly blocked without silently changing it', () => { assert(el('start').disabled); assert.equal(el('variant').value, 'both'); });
el('variant').value = '_f'; await el('variant').trigger('change');
check('DINO valid quick single variant enables scoring', () => { assert(!el('start').disabled); assert(!el('dino-constraints').hidden); });
el('scene-kind').value = 'field'; await el('scene-kind').trigger('change'); ui.setROI({ x: 1400, y: 300, w: 30, h: 30 });
dinoJob = await beginScoring(); dinoRequest = dinoJob.worker.messages.at(-1).message;
check('explicit central field overlap skips asset preparation and retains original pixels', () => { assert.equal(preparationCalls.length, 0); assert.equal(dinoRequest.type, 'recognize'); assert.equal(dinoRequest.featureMethod, 'dinov2'); assert.deepEqual(dinoRequest.sceneContext.gameplayROI, { x: 960, y: 0, w: 960, h: 720 }); assert(dinoRequest.sceneContext.excludeCenter); assert.equal(dinoRequest.crop.rgba[0], 37); assert.match(el('mask-status').textContent, /重なる/); });
emitResult(dinoJob.worker, dinoRequest, { rankings: [], skipped: 'central-field-exclusion', coverage: { requestedModels: 4, completedModels: 0, renderedTemplates: 0, unsupported: [] } }); await dinoJob.completion;
check('masked result remains unknown and unobserved without negative evidence', () => { assert.equal(el('rankings').children.length, 0); assert.match(el('unknown-status').textContent, /未観測・判別不能/); assert.match(el('unknown-status').textContent, /根拠にはなりません/); });
ui.setROI({ x: 1000, y: 50, w: 40, h: 50 });
let resolveAssets; prepareInference = () => new Promise(resolve => { resolveAssets = resolve; });
dinoJob = await beginScoring(); const beforeAssets = dinoJob.worker.messages.length; const prep = preparationCalls.at(-1);
check('DINO waits for verified asset preparation before scoring', () => { assert(ui.state.busy); assert.equal(preparationCalls.length, 1); assert(!prep.signal.aborted); assert.equal(dinoJob.worker.messages.length, beforeAssets); assert.match(el('status').textContent, /34.75/); });
prep.onProgress({ phase: 'download', loadedBytes: 10, totalBytes: 20, message: 'download current' });
check('current asset progress updates the progress indicator', () => { assert.equal(el('progress').value, 10); assert.equal(el('progress').max, 20); assert.equal(el('status').textContent, 'download current'); });
resolveAssets({}); await settle(); dinoRequest = dinoJob.worker.messages.at(-1).message;
check('DINO request keeps feature and nested scene in capture stamp', () => { assert.equal(dinoJob.worker.messages.length, beforeAssets + 1); assert.equal(dinoRequest.captureStamp.featureMethod, 'dinov2'); assert.deepEqual(dinoRequest.captureStamp.sceneContext, dinoRequest.sceneContext); assert.notStrictEqual(dinoRequest.captureStamp.sceneContext, dinoRequest.sceneContext); assert.equal(dinoRequest.crop.rgba[0], 37); });
emitResult(dinoJob.worker, dinoRequest); await dinoJob.completion;
check('DINO ranking reports cosine similarity rather than histogram distance', () => { const card = el('rankings').children[0]; assert(card.children.some(child => /cosine類似度 0.7500/.test(child.textContent))); assert(card.children.some(child => /大きいほど近い/.test(child.textContent))); assert.match(el('unknown-status').textContent, /候補外・判別不能/); });

let rejectAssets; prepareInference = () => new Promise((resolve, reject) => { rejectAssets = reject; });
dinoJob = await beginScoring(); const canceledPrep = preparationCalls.at(-1); await el('cancel').click(); const statusAfterCancel = el('status').textContent;
canceledPrep.onProgress({ message: 'late download progress' }); rejectAssets(new Error('late download failure')); await dinoJob.completion;
check('cancel aborts asset preparation and ignores late progress/error', () => { assert(canceledPrep.signal.aborted); assert(dinoJob.worker.terminated); assert.equal(el('status').textContent, statusAfterCancel); assert(!ui.state.busy); assert(!el('start').disabled); });
prepareInference = async () => { throw new Error('cache unavailable'); }; dinoJob = await beginScoring(); await dinoJob.completion;
check('asset error leaves DINO selected and offers explicit histogram choice', () => { assert.equal(el('feature-method').value, 'dinov2'); assert.match(el('status').textContent, /色ヒストグラム/); assert.match(el('error').textContent, /cache unavailable/); assert(!el('start').disabled); });
el('feature-method').value = 'histogram'; await el('feature-method').trigger('change'); const countBeforeHistogram = preparationCalls.length;
dinoJob = await beginScoring(); dinoRequest = dinoJob.worker.messages.at(-1).message;
check('explicit histogram selection remains usable without inference assets', () => { assert.equal(dinoRequest.featureMethod, 'histogram'); assert.equal(preparationCalls.length, countBeforeHistogram); }); emitResult(dinoJob.worker, dinoRequest); await dinoJob.completion;

el('feature-method').value = 'dinov2'; await el('feature-method').trigger('change'); prepareInference = () => new Promise((resolve, reject) => { rejectAssets = reject; });
dinoJob = await beginScoring(); const oldFramePrep = preparationCalls.at(-1); video.currentTime = 4; ui.freeze(); const afterFreezeStatus = el('status').textContent; rejectAssets(new Error('old-frame fetch failure')); await dinoJob.completion;
check('new frozen frame aborts preparation and cannot inherit its error', () => { assert(oldFramePrep.signal.aborted); assert.equal(el('status').textContent, afterFreezeStatus); assert.equal(ui.state.capture.videoTime, 4); assert.equal(el('error').textContent, ''); });
ui.setROI({ x: 1000, y: 50, w: 40, h: 50 }); dinoJob = await beginScoring(); const oldROMPrep = preparationCalls.at(-1);
el('rom-file').files = [{ ...file, name: 'replacement.nds' }]; const replacement = ui.selectROM(); await settle(); const newROMWorker = uiWorkers.at(-1); const newLoad = newROMWorker.messages.at(-1).message; newROMWorker.emit({ type: 'loaded', id: newLoad.id, romEpoch: newLoad.romEpoch, catalog }); await replacement;
const newROMStatus = el('status').textContent; rejectAssets(new Error('old-ROM cache failure')); await dinoJob.completion;
check('new ROM aborts preparation and rejects old download errors', () => { assert(oldROMPrep.signal.aborted); assert.equal(el('status').textContent, newROMStatus); assert.equal(el('error').textContent, ''); assert.equal(ui.state.capture, null); });
ui.freeze(); ui.setROI({ x: 1000, y: 50, w: 40, h: 50 });
for (const [id, value] of [['scene-kind', 'unspecified'], ['gameplay-layout', 'whole'], ['exclude-center', false]]) {
  prepareInference = () => new Promise(resolve => { resolveAssets = resolve; }); dinoJob = await beginScoring(); const old = preparationCalls.at(-1);
  if (id === 'exclude-center') el(id).checked = value; else el(id).value = value; await el(id).trigger('change');
  resolveAssets({}); await dinoJob.completion;
  check(`${id} change aborts the active inference preparation`, () => { assert(old.signal.aborted); assert(!ui.state.busy); assert.equal(el('rankings').children.length, 0); });
}
prepareInference = () => new Promise(resolve => { resolveAssets = resolve; }); dinoJob = await beginScoring(); const oldROIPrep = preparationCalls.at(-1);
ui.setROI({ x: 1001, y: 50, w: 40, h: 50 }); resolveAssets({}); await dinoJob.completion;
check('enemy ROI edit aborts preparation before any descriptor request', () => { assert(oldROIPrep.signal.aborted); assert(dinoJob.worker.terminated); assert.equal(el('rankings').children.length, 0); });
dinoJob = await beginScoring(); const oldMethodPrep = preparationCalls.at(-1); el('feature-method').value = 'histogram'; await el('feature-method').trigger('change'); resolveAssets({}); await dinoJob.completion;
check('feature method edit cancels old DINO preparation', () => { assert(oldMethodPrep.signal.aborted); assert.equal(el('feature-method').value, 'histogram'); assert(!ui.state.busy); });
el('feature-method').value = 'dinov2'; await el('feature-method').trigger('change'); dinoJob = await beginScoring(); const oldSourcePrep = preparationCalls.at(-1);
el('source-file').files = []; ui.selectSource(); resolveAssets({}); await dinoJob.completion;
check('source file replacement aborts preparation and drops stale capture', () => { assert(oldSourcePrep.signal.aborted); assert.equal(ui.state.capture, null); assert(!ui.state.busy); });
Object.assign(ui.state, { sourceReady: true, sourceKind: 'video', sourceId: 'dino-new-source', sourceEpoch: ui.state.sourceEpoch + 1 }); ui.freeze(); ui.setROI({ x: 1001, y: 50, w: 40, h: 50 });
el('scene-kind').value = 'field'; el('gameplay-layout').value = 'manual'; await el('gameplay-layout').trigger('change');
for (const [key, value] of Object.entries({ x: 0, y: 0, w: 1921, h: 1080 })) el(`gameplay-${key}`).value = String(value);
await el('gameplay-w').trigger('input');
check('out-of-bounds manual game area blocks scoring with a visible explanation', () => { assert(el('start').disabled); assert.match(el('configuration-error').textContent, /はみ出/); });

// Explicit provider selection, GPU availability, separate timings and cache clear lifecycle.
el('scene-kind').value='unspecified';el('gameplay-layout').value='obs-right-upper';await el('scene-kind').trigger('change');prepareInference=async()=>({});
el('inference-backend').value='webgpu';await el('inference-backend').trigger('change');
probeGPU=async()=>{throw Error('shader-f16 unsupported');};let prepBefore=preparationCalls.length;dinoJob=await beginScoring();await dinoJob.completion;
check('unsupported GPU stops before asset setup and leaves GPU explicitly selected',()=>{assert.equal(preparationCalls.length,prepBefore);assert.equal(el('inference-backend').value,'webgpu');assert.match(el('error').textContent,/shader-f16/);assert.match(el('status').textContent,/CPU\/WASM/);});
probeGPU=async()=>({});dinoJob=await beginScoring();await settle();dinoRequest=dinoJob.worker.messages.at(-1).message;
check('GPU provider is explicit in asset profile, request and capture identity',()=>{assert.equal(preparationCalls.at(-1).backend,'webgpu');assert.equal(dinoRequest.inferenceBackend,'webgpu');assert.equal(dinoRequest.captureStamp.inferenceBackend,'webgpu');const stale=cloneCaptureStamp(dinoRequest.captureStamp);stale.inferenceBackend='wasm';assert(!stampEquals(stale,dinoRequest.captureStamp));});
emitResult(dinoJob.worker,dinoRequest,{inference:{backend:'webgpu',precision:'fp16'},timings:{backendInitMs:10,queryMs:20,templateEmbeddingMs:30,templateCacheHits:64,templateCacheMisses:0,persistentRestored:64,persistentSaved:true}});await dinoJob.completion;
check('result separately labels GPU precision, template reuse, query and setup timings',()=>{assert.match(el('result-timing').textContent,/WebGPU\/FP16/);assert.match(el('result-timing').textContent,/再利用64/);assert.match(el('result-timing').textContent,/保存から64/);assert.match(el('result-timing').textContent,/切り抜き/);assert.match(el('result-timing').textContent,/公開ファイル準備/);});
let resolveProbe;probeGPU=()=>new Promise(resolve=>{resolveProbe=resolve;});dinoJob=await beginScoring();prepBefore=preparationCalls.length;el('inference-backend').value='wasm';await el('inference-backend').trigger('change');resolveProbe({});await dinoJob.completion;
check('provider change cancels pending GPU capability probe before download',()=>{assert.equal(preparationCalls.length,prepBefore);assert.equal(el('rankings').children.length,0);assert(dinoJob.worker.terminated);});
probeGPU=async()=>({});let resolveClear;clearLocalFeatures=()=>new Promise(resolve=>{resolveClear=resolve;});
dinoJob=await beginScoring();dinoRequest=dinoJob.worker.messages.at(-1).message;const pendingClear=el('clear-feature-cache').click();await settle();
check('clear requested vectors terminates active scoring and blocks restart until complete',()=>{assert(dinoJob.worker.terminated);assert(ui.state.clearingCache);assert(el('start').disabled);assert(el('clear-feature-cache').disabled);});resolveClear();await pendingClear;await dinoJob.completion;
check('clear reports local feature removal without deleting public dependencies',()=>{assert(!ui.state.clearingCache);assert.match(el('status').textContent,/公開AIファイルのキャッシュは保持/);assert(!el('start').disabled);});
clearLocalFeatures=async()=>{throw Error('cache unavailable');};await el('clear-feature-cache').click();check('cache clear failure is visible and does not claim success',()=>{assert.match(el('error').textContent,/cache unavailable/);assert(!el('clear-feature-cache').disabled);});

// Opt-in frozen-frame region suggestions, using the exact existing classification client.
Object.assign(video, { videoWidth: 640, videoHeight: 480, currentTime: 12, frameValue: 61, seeking: false, readyState: 4 });
Object.assign(ui.state, { sourceReady: true, sourceKind: 'video', sourceId: 'proposal-source', sourceEpoch: ui.state.sourceEpoch + 1 });
el('scene-kind').value = 'unspecified'; el('gameplay-layout').value = 'whole'; el('exclude-center').checked = false; el('enable-roi-proposals').checked = false;
el('feature-method').value = 'dinov2'; el('inference-backend').value = 'webgpu'; el('preset').value = 'quick'; el('variant').value = '_f';
probeGPU = async () => ({}); prepareInference = async () => ({}); ui.freeze();
check('ROI suggestions are opt-in and freeze does not start detection', () => { assert(el('generate-roi-proposals').disabled); assert.equal(proposalCalls.length, 0); assert.equal(ui.state.proposalResult, null); });
ui.generateProposals();
check('direct generation cannot bypass the opt-in gate', () => { assert.equal(proposalCalls.length, 0); assert.match(el('error').textContent, /チェック/); });
el('enable-roi-proposals').checked = true; await el('enable-roi-proposals').trigger('change');
check('opt-in alone does not infer a field scene', () => { assert(el('generate-roi-proposals').disabled); assert.match(el('proposal-status').textContent, /フィールド/); });
el('scene-kind').value = 'field'; await el('scene-kind').trigger('change');
check('suggestions require the explicit central exclusion', () => assert(el('generate-roi-proposals').disabled));
el('exclude-center').checked = true; await el('exclude-center').trigger('change');
el('gameplay-layout').value = 'manual'; for (const [key, value] of Object.entries({x:0,y:0,w:600,h:480})) el(`gameplay-${key}`).value = String(value); await el('gameplay-layout').trigger('change');
check('non-4:3 proposal scene is blocked without changing layout', () => { assert(el('generate-roi-proposals').disabled); assert.equal(el('gameplay-layout').value, 'manual'); });
el('gameplay-layout').value = 'whole'; await el('gameplay-layout').trigger('change');
video.frameValue = 99; video.currentTime = 13;
const recognitionCount = () => uiWorkers.reduce((n,w) => n + w.messages.filter(m => m.message.type === 'recognize').length, 0);
let countBeforeProposals = recognitionCount();
await el('generate-roi-proposals').click();
check('proposal generation uses frozen pixels/time and never classifies automatically', () => { const call=proposalCalls.at(-1); assert.equal(call.firstPixel,61); assert.equal(call.captureStamp.videoTime,12); assert.equal(call.options.profile,'shrine-blue-v1'); assert.equal(call.options.maxProposals,8); assert(call.options.excludeCommandHUD); assert.equal(recognitionCount(),countBeforeProposals); });
check('candidate list is unverified and leaves manual ROI unset until selection', () => { assert.equal(el('roi-proposal-list').children.length,2); assert.equal(ui.state.roi,null); assert.match(el('proposal-status').textContent,/分類時間は別/); assert.match(el('roi-proposal-list').children[0].textContent,/未確認/); });
const firstProposalButton = el('roi-proposal-list').children[0];
await firstProposalButton.click();
check('choosing a proposal sets the existing ROI without changing WebGPU or launching inference', () => { assert.deepEqual(ui.state.roi,{x:40,y:45,w:50,h:60}); assert.equal(el('inference-backend').value,'webgpu'); assert.equal(recognitionCount(),countBeforeProposals); assert.equal(el('roi-proposal-list').children[0].getAttribute('aria-pressed'),'true'); assert(!el('start').disabled); });
dinoJob = await beginScoring(); await settle(); dinoRequest = dinoJob.worker.messages.at(-1).message;
check('proposal selection flows through one unchanged capture-bound WebGPU request', () => { assert.equal(recognitionCount(),countBeforeProposals+1); assert.equal(dinoRequest.inferenceBackend,'webgpu'); assert.deepEqual(dinoRequest.captureStamp.enemyROI,{x:40,y:45,w:50,h:60}); assert.equal(dinoRequest.crop.rgba[0],61); assert.equal(dinoRequest.captureStamp.videoTime,12); assert.equal(dinoRequest.captureStamp.sceneContext.kind,'field'); assert.deepEqual(dinoRequest.modelIds,[...DEFAULT_MODELS]); });
emitResult(dinoJob.worker,dinoRequest,{inference:{backend:'webgpu',precision:'fp16'}}); await dinoJob.completion;
check('existing ranked and unknown result UI describes selected proposal honestly', () => { assert.equal(el('rankings').children.length,1); assert.match(el('unknown-status').textContent,/候補外・判別不能/); assert.match(el('limitations').children[0].textContent,/未確認の領域候補/); });
dinoJob = await beginScoring(); await settle(); const oldProposalRequest = dinoJob.worker.messages.at(-1).message;
await el('roi-proposal-list').children[1].click(); await dinoJob.completion;
dinoJob.worker.emit({type:'result',id:oldProposalRequest.id,romEpoch:oldProposalRequest.romEpoch,result:{captureStamp:oldProposalRequest.captureStamp,rankings:[{modelId:'stale'}]}});
check('selecting another candidate cancels old scoring and rejects late replies', () => { assert(dinoJob.worker.terminated); assert.deepEqual(ui.state.roi,{x:430,y:80,w:70,h:90}); assert.equal(el('rankings').children.length,0); assert.equal(el('roi-proposal-list').children.length,2); });
const preservedProposalSet=ui.state.proposalResult; el('inference-backend').value='wasm'; await el('inference-backend').trigger('change');
check('backend change preserves frozen proposals while retaining normal classifier invalidation', () => { assert.strictEqual(ui.state.proposalResult,preservedProposalSet); assert.equal(el('rankings').children.length,0); });
ui.setROI({x:25,y:30,w:30,h:40});
check('manual adjustment remains usable and removes candidate selection highlighting',()=>{assert.equal(ui.state.selectedProposalId,null);assert.equal(el('roi-proposal-list').children.length,2);assert.equal(el('roi-proposal-list').children[0].getAttribute('aria-pressed'),'false');});
const retained = ui.state.proposalResult; await video.trigger('seeking');
check('seeking live video does not regenerate or relabel the frozen image',()=>{assert.strictEqual(ui.state.proposalResult,retained);assert.equal(retained.captureStamp.videoTime,12);});
ui.freeze();
check('new frozen frame clears proposal set and previous results',()=>{assert.equal(ui.state.proposalResult,null);assert.equal(el('roi-proposal-list').children.length,0);assert.equal(ui.state.roi,null);assert.equal(el('rankings').children.length,0);});
await el('generate-roi-proposals').click();const newSet=ui.state.proposalResult;await firstProposalButton.click();
check('an obsolete candidate button cannot select or erase a newer proposal set',()=>{assert.strictEqual(ui.state.proposalResult,newSet);assert.equal(ui.state.roi,null);});
el('exclude-center').checked=false;await el('exclude-center').trigger('change');
check('scene mask changes clear proposals and disable regeneration',()=>{assert.equal(ui.state.proposalResult,null);assert(el('generate-roi-proposals').disabled);});
el('exclude-center').checked=true;await el('exclude-center').trigger('change');await el('generate-roi-proposals').click();
el('enable-roi-proposals').checked=false;await el('enable-roi-proposals').trigger('change');
check('turning the experiment off removes all proposal state',()=>{assert.equal(ui.state.proposalResult,null);assert.equal(el('roi-proposal-list').children.length,0);assert(el('generate-roi-proposals').disabled);});
el('enable-roi-proposals').checked=true;await el('enable-roi-proposals').trigger('change');ui.setROI({x:25,y:30,w:30,h:40});
proposalFactory=(image,captureStamp)=>({captureStamp:cloneCaptureStamp(captureStamp),proposals:[],elapsedMs:2});await el('generate-roi-proposals').click();
check('zero proposals retain unknown and manual classification remains possible',()=>{assert.match(el('proposal-status').textContent,/敵がいない証拠ではありません/);assert(!el('start').disabled);});
proposalFactory=()=>{throw new Error('proposal fixture failure');};await el('generate-roi-proposals').click();
check('proposal failure leaves manual ROI workflow usable and clears stale suggestions',()=>{assert.equal(ui.state.proposalResult,null);assert.match(el('error').textContent,/proposal fixture failure/);assert(!el('start').disabled);});
proposalFactory=(image,captureStamp)=>({...defaultProposalFactory(image,captureStamp),captureStamp:{...captureStamp,frameSerial:captureStamp.frameSerial+1}});await el('generate-roi-proposals').click();
check('mismatched proposal capture stamp is rejected rather than rewritten as current',()=>{assert.equal(ui.state.proposalResult,null);assert.match(el('error').textContent,/一致しない/);});
proposalFactory=(image,captureStamp)=>({captureStamp:cloneCaptureStamp(captureStamp),elapsedMs:2,proposals:Array.from({length:12},(_,i)=>({proposalId:`${captureStamp.frameSerial}:${i}`,roi:{x:10+i*5,y:10,w:20,h:20}}))});await el('generate-roi-proposals').click();
check('UI independently limits proposal choices to eight',()=>{assert.equal(ui.state.proposalResult.proposals.length,8);assert.equal(el('roi-proposal-list').children.length,8);});
Object.assign(video,{videoWidth:4096,videoHeight:3072});ui.freeze();proposalFactory=(image,captureStamp)=>({captureStamp:cloneCaptureStamp(captureStamp),elapsedMs:2,proposals:[{proposalId:`${captureStamp.frameSerial}:0`,roi:{x:16,y:16,w:1408,h:1728}},{proposalId:`${captureStamp.frameSerial}:1`,roi:{x:3000,y:2000,w:100,h:100}}]});await el('generate-roi-proposals').click();
let beforeLarge=recognitionCount();const largeButton=el('roi-proposal-list').children[0];await largeButton.click();
check('oversized suggestion is visibly unprocessed and cannot allocate a classifier crop',()=>{assert(largeButton.disabled);assert.match(largeButton.children[0].textContent,/サイズ上限のため未処理/);assert.match(el('proposal-status').textContent,/1件はサイズ上限のため未処理/);assert.equal(ui.state.roi,null);assert.equal(recognitionCount(),beforeLarge);});
await el('roi-proposal-list').children[1].click();
check('a supported sibling candidate remains selectable after an oversized one',()=>assert.deepEqual(ui.state.roi,{x:3000,y:2000,w:100,h:100}));
await el('clear-roi-proposals').click();
check('clearing suggestion overlays preserves the manually adjustable selected crop',()=>{assert.equal(ui.state.proposalResult,null);assert.deepEqual(ui.state.roi,{x:3000,y:2000,w:100,h:100});assert(!el('start').disabled);});
Object.assign(video,{videoWidth:640,videoHeight:480});proposalFactory=defaultProposalFactory;ui.freeze();await el('generate-roi-proposals').click();
el('source-file').files=[];ui.selectSource();
check('source replacement clears proposals as well as its frozen capture',()=>{assert.equal(ui.state.capture,null);assert.equal(ui.state.proposalResult,null);assert.equal(el('roi-proposal-list').children.length,0);});
Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'proposal-new-source',sourceEpoch:ui.state.sourceEpoch+1});ui.freeze();await el('generate-roi-proposals').click();el('rom-file').files=[];await ui.selectROM();
check('ROM epoch replacement cannot retain proposal capture or old results',()=>{assert.equal(ui.state.capture,null);assert.equal(ui.state.proposalResult,null);assert.equal(el('rankings').children.length,0);});
proposalFactory=defaultProposalFactory;

await win.trigger('pagehide');
console.log(`\n${passed} UI and lifecycle checks passed (Node DOM harness; no browser launched).`);
