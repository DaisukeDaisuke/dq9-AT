import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { proposeEnemyROIs, EnemyProposalTracker } from '../web/monster-position-proposals.mjs';
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
    if (!this.context) this.context = { snapshot: 0, clearRect() {}, save() {}, restore() {}, fillRect() {}, strokeRect(...rect) { (this.boxes ??= []).push(rect); }, fillText(text) { (this.labels ??= []).push(text); }, putImageData(pixels) { this.snapshot = pixels.data[0]; this.paintedPixels = pixels.data.slice(); this.boxes = []; this.labels = []; }, drawImage(source) { this.snapshot = source.frameValue ?? source.context?.snapshot ?? 0; this.pixels = source.frameRGBA ?? source.context?.pixels; this.pixelWidth = source.videoWidth ?? source.context?.pixelWidth; }, getImageData(x, y, width, height) { const data = new Uint8ClampedArray(width * height * 4).fill(this.snapshot); if (this.pixels) for (let row = 0; row < height; row++) data.set(this.pixels.subarray(((y + row) * this.pixelWidth + x) * 4, ((y + row) * this.pixelWidth + x + width) * 4), row * width * 4); return { data }; }, createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; } };
    return this.context;
  }
  pause() { this.paused = true; }
  async play() { this.paused = false; }
  load() {}
}
const html = await readFile(new URL('../web/monster-recognize.html', import.meta.url), 'utf8');
const elements = new Map([...html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(match => [match[2], new Element(match[1])]));
const documentEvents = new Element('document');
const doc = { hidden: false, addEventListener: (...args) => documentEvents.addEventListener(...args), getElementById: id => { assert(elements.has(id), `missing HTML element ${id}`); return elements.get(id); }, createElement: tag => new Element(tag) };
let probeGPU = async () => ({}), clearLocalFeatures = async () => {}; let prepareInference = async () => ({}); const preparationCalls = [];
const proposalCalls = [];
let proposalFactory = (image, captureStamp) => ({ captureStamp: cloneCaptureStamp(captureStamp), elapsedMs: 3, proposals: [{ proposalId: `${captureStamp.frameSerial}:0`, roi: { x: 40, y: 45, w: 50, h: 60 } }, { proposalId: `${captureStamp.frameSerial}:1`, roi: { x: 430, y: 80, w: 70, h: 90 } }], unknown: { suggested: true, calibrated: false } });
const defaultProposalFactory = proposalFactory;
const win = new Element('window'); const ui = mountRecognitionPage(doc, win, { proposeROIs: (image, captureStamp, options) => { proposalCalls.push({ firstPixel: image.rgba[0], captureStamp: cloneCaptureStamp(captureStamp), options }); return proposalFactory(image, captureStamp, options); }, probeWebGPU: options => probeGPU(options), clearFeatureCache: () => clearLocalFeatures(), ensureInferenceAssets: options => { preparationCalls.push(options); return prepareInference(options); } }); const el = id => elements.get(id);
el('variant').value = '_f'; el('preset').value = 'quick'; el('top-k').value = '4';
const uiWorkers = []; ui.client.factory = () => { const worker = new MockWorker(); uiWorkers.push(worker); return worker; };
const catalog = [...DEFAULT_MODELS, 'z999x'].map(modelId => ({ modelId, speciesCandidates: [{ monsterId: 1, nameJa: `名前-${modelId}` }] }));
check('initial controls block recognition until capture and catalog exist', () => { assert(el('start').disabled); assert(el('cancel').disabled); assert.match(el('recognition-requirements').textContent,/NDSファイルを選択/); });
el('rom-file').files = [file]; let romRead = ui.selectROM(); await settle(); const firstLoad = uiWorkers[0].messages[0].message;
check('page-generated load ID matches actual Worker string contract', () => { assert.match(firstLoad.id, /^request-\d+$/); assert(!el('cancel').disabled); assert.match(el('recognition-requirements').textContent,/NDSを読み込んでいます/); });
await el('cancel').click(); await romRead;
check('cancel initial ROM load leaves an enabled File reread action', () => { assert(uiWorkers[0].terminated); assert(!el('restart').disabled); assert.equal(el('restart').textContent, 'NDSを再読込'); });
const retry = el('restart').click(); await settle(); const retryLoad = uiWorkers[1].messages[0].message;
uiWorkers[1].emit({ type: 'loaded', id: retryLoad.id, romEpoch: retryLoad.romEpoch, catalog }); await retry;
check('reread restores default four candidates', () => { assert.equal(ui.state.selected.size, 4); assert.equal(el('model-count').textContent, '4 / 4'); assert.match(el('recognition-requirements').textContent,/動画または画像を選択/); });
const fifth = el('model-list').children[4].children[0]; fifth.checked = true; await fifth.trigger('change');
check('fifth model selection is rejected', () => { assert(!fifth.checked); assert.equal(ui.state.selected.size, 4); });
const video = el('source-video'); Object.assign(video, { videoWidth: 640, videoHeight: 480, currentTime: 1.25, duration: 20, readyState: 4, seeking: false, frameValue: 37 });
Object.assign(ui.state, { sourceReady: true, sourceKind: 'video', sourceId: 'video-test', sourceEpoch: 2, timelineSegment: 3 }); ui.freeze();
check('freeze alone does not invent an enemy ROI', () => { assert.equal(ui.state.roi, null); assert(el('start').disabled); assert.match(el('recognition-requirements').textContent,/固定画像上で敵を囲む/); });
ui.setROI({ x: 10, y: 20, w: 40, h: 50 });
check('explicit numeric ROI enables scoring', () => { assert(!el('start').disabled); assert.equal(el('crop-size').textContent, '40 × 50 px · x 10, y 20'); assert.match(el('recognition-requirements').textContent,/この切り抜きで照合できます/); });
video.frameValue = 99; video.currentTime = 2; await video.trigger('seeking');
let scoring = ui.recognize(); await settle(); let scoreRequest = uiWorkers[1].messages.at(-1).message;
check('request copies the frozen pixels and original timestamp, not moving video', () => { assert.equal(scoreRequest.crop.rgba[0], 37); assert.equal(scoreRequest.captureStamp.videoTime, 1.25); assert.equal(scoreRequest.captureStamp.timelineSegment, 3); assert.equal(ui.state.timelineSegment, 4); });
check('score request transfers crop and disables duplicate Start', () => { assert.equal(scoreRequest.type, 'recognize'); assert.match(scoreRequest.id, /^request-/); assert.match(el('recognition-requirements').textContent,/処理中/); assert(el('start').disabled); assert(!el('cancel').disabled); assert(!el('restart').disabled); });
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
check('DINO standard preset is visibly blocked without silently changing it', () => { assert(el('start').disabled); assert(!el('configuration-error').hidden); assert.equal(el('preset').value, 'standard'); assert.match(el('recognition-requirements').textContent,/DINOv2は単一/); });
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
check('clear requested vectors terminates active scoring and blocks restart until complete',()=>{assert(dinoJob.worker.terminated);assert(ui.state.clearingCache);assert(el('start').disabled);assert(el('clear-feature-cache').disabled);assert.match(el('recognition-requirements').textContent,/姿勢特徴を消去中/);});resolveClear();await pendingClear;await dinoJob.completion;
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

// Optional dense supplement is one capture-bound worker job, never an implicit CPU action.
Object.assign(ui.state,{romFile:file,romEpoch:20,catalog,selected:new Set(DEFAULT_MODELS),sourceReady:true,sourceKind:'video',sourceId:'dense-fixture',sourceEpoch:20});
ui.client.loadedRomEpoch=20;Object.assign(video,{videoWidth:640,videoHeight:480,readyState:4,seeking:false,frameValue:71,currentTime:20});
el('enable-roi-proposals').checked=true;el('scene-kind').value='field';el('exclude-center').checked=true;el('gameplay-layout').value='whole';el('feature-method').value='dinov2';el('inference-backend').value='wasm';el('preset').value='quick';el('variant').value='_f';prepareInference=async()=>({});
ui.freeze();let prepCount=preparationCalls.length;ui.generateProposals();
check('CPU proposals never prepare DINO even when supplement is available',()=>{assert.equal(preparationCalls.length,prepCount);assert(!el('supplement-roi-proposals').disabled);});
async function beginSupplement(){const completion=ui.supplementProposals();await settle();const worker=uiWorkers.at(-1),request=worker.messages.at(-1)?.message;if(request?.type==='load'){worker.emit({type:'loaded',id:request.id,romEpoch:request.romEpoch,catalog});await settle();}return{completion,worker};}
function denseResult(req,overrides={}){return{...req.current,captureStamp:cloneCaptureStamp(req.captureStamp),proposals:[...req.current.proposals,{proposalId:`dense:${req.captureStamp.frameSerial}:0`,roi:{x:200,y:30,w:40,h:50},source:'frozen-dino-patch-cue',unknown:true}],denseRevision:'fixture',denseAdded:['fixture'],densePreparation:{templateCacheHits:64,templateCacheMisses:0,persistentRestored:64},denseTimings:{totalMs:500},unknown:{suggested:true,calibrated:false},...overrides};}
function emitDense(worker,req,result=denseResult(req)){worker.emit({type:'result',id:req.id,romEpoch:req.romEpoch,result});}
video.frameValue=99;video.currentTime=22;let denseJob=await beginSupplement(),denseRequest=denseJob.worker.messages.at(-1).message;
check('explicit supplement transfers frozen original pixels with the current provider and bank scope',()=>{assert.equal(denseRequest.type,'supplement');assert.equal(denseRequest.image.rgba[0],71);assert.equal(denseRequest.captureStamp.videoTime,20);assert.equal(denseRequest.inferenceBackend,'wasm');assert.deepEqual(denseRequest.modelIds,[...DEFAULT_MODELS]);assert.equal(denseRequest.variant,'_f');assert(!Object.hasOwn(denseRequest,'crop'));assert.strictEqual(denseJob.worker.messages.at(-1).transfer[0],denseRequest.image.rgba.buffer);});
const denseMessageCount=denseJob.worker.messages.length;await ui.supplementProposals();
check('duplicate supplement click is disabled and cannot queue a second job',()=>{assert(el('supplement-roi-proposals').disabled);assert.equal(denseJob.worker.messages.length,denseMessageCount);assert(!el('cancel').disabled);});
denseJob.worker.emit({type:'progress',id:denseRequest.id,romEpoch:20,phase:'embed',message:'64 poses',done:16,total:64});
check('supplement uses the existing progress gate',()=>{assert.equal(el('progress').value,16);assert.equal(el('status').textContent,'64 poses · 16 / 64');});
const cpuBefore=structuredClone(ui.state.proposalResult.proposals),classifyBefore=recognitionCount();emitDense(denseJob.worker,denseRequest);await denseJob.completion;
check('supplement appends after CPU order, reports separate cost and never classifies',()=>{assert.deepEqual(ui.state.proposalResult.proposals.slice(0,2),cpuBefore);assert.equal(el('roi-proposal-list').children.length,3);assert.equal(recognitionCount(),classifyBefore);assert.match(el('dense-proposal-note').textContent,/背景候補/);assert.match(el('dense-proposal-note').textContent,/再利用64/);assert(el('supplement-roi-proposals').disabled);});
await el('roi-proposal-list').children[2].click();
check('dense suggestion selects the existing unverified manual crop',()=>{assert.deepEqual(ui.state.roi,{x:200,y:30,w:40,h:50});assert.equal(recognitionCount(),classifyBefore);assert.match(el('proposal-status').textContent,/未確認/);});
ui.generateProposals();let finishDenseAssets;prepareInference=()=>new Promise(r=>{finishDenseAssets=r});denseJob=await beginSupplement();const denseAssets=preparationCalls.at(-1),baseDuringCancel=ui.state.proposalResult;await el('cancel').click();finishDenseAssets({});await denseJob.completion;
check('cancel during supplement asset preparation keeps CPU suggestions and rejects late preparation',()=>{assert(denseAssets.signal.aborted);assert.strictEqual(ui.state.proposalResult,baseDuringCancel);assert(!ui.state.busy);assert(!el('supplement-roi-proposals').disabled);});
prepareInference=async()=>({});denseJob=await beginSupplement();denseRequest=denseJob.worker.messages.at(-1).message;await el('clear-roi-proposals').click();emitDense(denseJob.worker,denseRequest);await denseJob.completion;
check('clearing overlays cancels the pending supplement and prevents late restoration',()=>{assert(denseJob.worker.terminated);assert.equal(ui.state.proposalResult,null);assert(!ui.state.busy);});
ui.generateProposals();denseJob=await beginSupplement();denseRequest=denseJob.worker.messages.at(-1).message;const wrongDenseStamp=cloneCaptureStamp(denseRequest.captureStamp);wrongDenseStamp.frameSerial++;emitDense(denseJob.worker,denseRequest,denseResult(denseRequest,{captureStamp:wrongDenseStamp}));await denseJob.completion;
check('mismatched dense result retains CPU list and usable retry controls',()=>{assert.equal(ui.state.proposalResult.proposals.length,2);assert.match(el('error').textContent,/一致しない/);assert(!ui.state.busy);assert(!el('supplement-roi-proposals').disabled);});
for(const defect of ['reorder','overflow','out-of-bounds']){denseJob=await beginSupplement();denseRequest=denseJob.worker.messages.at(-1).message;const result=denseResult(denseRequest);if(defect==='reorder')result.proposals.reverse();if(defect==='overflow')while(result.proposals.length<9)result.proposals.push(structuredClone(result.proposals[0]));if(defect==='out-of-bounds')result.proposals[2].roi.x=640;emitDense(denseJob.worker,denseRequest,result);await denseJob.completion;check(`malformed supplement ${defect} fails without damaging CPU suggestions`,()=>{assert.equal(ui.state.proposalResult.proposals.length,2);assert(!ui.state.busy);assert(!el('error').hidden);});}
denseJob=await beginSupplement();denseRequest=denseJob.worker.messages.at(-1).message;const sameCPU=ui.state.proposalResult;el('inference-backend').value='webgpu';await el('inference-backend').trigger('change');emitDense(denseJob.worker,denseRequest);await denseJob.completion;
check('provider change cancels in-flight supplement without mixing banks',()=>{assert(denseJob.worker.terminated);assert.strictEqual(ui.state.proposalResult,sameCPU);assert(!ui.state.busy);});
probeGPU=async()=>{throw Error('fixture GPU unsupported')};denseJob=await beginSupplement();await denseJob.completion;
check('failed GPU probe retains selected provider and CPU proposals',()=>{assert.strictEqual(ui.state.proposalResult,sameCPU);assert.equal(el('inference-backend').value,'webgpu');assert.match(el('error').textContent,/fixture GPU unsupported/);});
probeGPU=async()=>({});denseJob=await beginSupplement();denseRequest=denseJob.worker.messages.at(-1).message;ui.freeze();emitDense(denseJob.worker,denseRequest);await denseJob.completion;
check('new capture rejects late supplement and clears old CPU and dense boxes',()=>{assert.equal(ui.state.proposalResult,null);assert(!ui.state.busy);assert.equal(el('roi-proposal-list').children.length,0);});
ui.generateProposals();el('feature-method').value='histogram';await el('feature-method').trigger('change');prepCount=preparationCalls.length;await ui.supplementProposals();
check('supplement never silently switches classifier method',()=>{assert(el('supplement-roi-proposals').disabled);assert.equal(preparationCalls.length,prepCount);assert.equal(el('feature-method').value,'histogram');});
el('feature-method').value='dinov2';await el('feature-method').trigger('change');ui.state.proposalResult.proposals=Array.from({length:8},(_,i)=>({proposalId:`cpu${i}`,roi:{x:10+i*5,y:10,w:10,h:10}}));ui.invalidate('');prepCount=preparationCalls.length;await ui.supplementProposals();
check('full CPU budget skips assets, bank preparation and encoder',()=>{assert.equal(preparationCalls.length,prepCount);assert(el('supplement-roi-proposals').disabled);assert.match(el('dense-proposal-note').textContent,/すでに8候補/);});
Object.assign(video,{videoWidth:4096,videoHeight:3072});ui.freeze();proposalFactory=(image,captureStamp)=>({...defaultProposalFactory(image,captureStamp),proposals:[]});ui.generateProposals();prepCount=preparationCalls.length;await ui.supplementProposals();
check('oversized dense gameplay is blocked before assets or worker submission',()=>{assert.equal(preparationCalls.length,prepCount);assert.match(el('dense-proposal-note').textContent,/1024px/);});
proposalFactory=defaultProposalFactory;
// Connected automatic video loop: same Worker client, separate current boxes and historical ranks.
let observerClock=0,frameID=0;const frameCallbacks=new Map();video.requestVideoFrameCallback=fn=>{const id=++frameID;frameCallbacks.set(id,fn);return id;};video.cancelVideoFrameCallback=id=>frameCallbacks.delete(id);
ui.observer.now=()=>observerClock;ui.observer.propose=(image,captureStamp)=>({...defaultProposalFactory(image,captureStamp),trackingFrame:{}});ui.observer.tracker={reset(){},update(r){return{observed:r.proposals.map((p,i)=>({...p,id:`observer-track-${i}`,sightings:2})),unobserved:[],camera:{reliable:true}}}};
Object.assign(ui.state,{romFile:file,romEpoch:30,catalog,selected:new Set(DEFAULT_MODELS),sourceReady:true,sourceKind:'video',sourceId:'automatic-video',sourceEpoch:30});ui.client.loadedRomEpoch=30;
Object.assign(video,{videoWidth:640,videoHeight:480,readyState:4,seeking:false,ended:false,frameValue:111,currentTime:0,paused:true});
el('enable-roi-proposals').checked=true;el('scene-kind').value='field';el('exclude-center').checked=true;el('gameplay-layout').value='whole';el('feature-method').value='dinov2';el('inference-backend').value='wasm';el('variant').value='_f';el('preset').value='quick';el('video-observation-dense').checked=false;prepareInference=async()=>({});
const autoCount=()=>uiWorkers.reduce((n,w)=>n+w.messages.filter(m=>['prepare','recognize','supplement'].includes(m.message.type)).length,0);
async function fireFrame(ms,value=111){observerClock=ms;video.currentTime=ms/1000;video.frameValue=value;const next=frameCallbacks.entries().next().value;assert(next,'one video callback expected');frameCallbacks.delete(next[0]);next[1](ms,{mediaTime:ms/1000});await settle();}
async function preparedWorker(){await settle();const worker=uiWorkers.at(-1);let req=worker.messages.at(-1).message;if(req.type==='load'){worker.emit({type:'loaded',id:req.id,romEpoch:req.romEpoch,catalog});await settle();req=worker.messages.at(-1).message;}assert.equal(req.type,'prepare');return{worker,req};}
let nAuto=autoCount();await ui.startVideoObservation();let auto=await preparedWorker();
check('automatic loop starts only explicitly and requests real pose preparation with no crop',()=>{assert.equal(autoCount(),nAuto+1);assert(!Object.hasOwn(auto.req,'crop'));assert(!Object.hasOwn(auto.req,'image'));assert(ui.observer.running);assert(video.paused===false);assert(el('start-video-observation').disabled);assert(!el('stop-video-observation').disabled);assert.equal(frameCallbacks.size,1);assert.match(el('recognition-requirements').textContent,/動画の自動観測中/);});
for(let i=0;i<5;i++)await fireFrame(i*250,111+i);check('CPU observations progress during cold preparation without a query queue',()=>{assert.equal(ui.observer.stats.sampledFrames,5);assert.equal(auto.worker.messages.at(-1).message.type,'prepare');assert(!el('video-observation-view').hidden);assert.equal(frameCallbacks.size,1);});
auto.worker.emit({type:'result',id:auto.req.id,romEpoch:30,result:{prepared:true,timings:{templateCacheHits:64}}});await settle();let automaticRequest=auto.worker.messages.at(-1).message;
check('prepared loop dispatches newest frozen crop through existing classifier',()=>{assert.equal(automaticRequest.type,'recognize');assert.equal(automaticRequest.crop.rgba[0],115);assert.equal(automaticRequest.captureStamp.videoTime,1);assert.equal(automaticRequest.captureStamp.timestampBasis,'requestVideoFrameCallback.mediaTime');assert.equal(automaticRequest.inferenceBackend,'wasm');});
const runningRequests=autoCount();for(let i=5;i<15;i++)await fireFrame(i*250,111+i);
check('slow classification leaves current boxes updating with one pending worker request',()=>{assert.equal(autoCount(),runningRequests);assert.equal(ui.observer.stats.sampledFrames,15);assert.equal(ui.client.pending.size,1);assert.equal(frameCallbacks.size,1);});
emitResult(auto.worker,automaticRequest);await settle();
check('automatic result appears only in its own aged crop record, never manual or new-box rankings',()=>{assert.equal(el('video-observations').children.length,1);assert.equal(ui.state.observationRecords[0].captureStamp.videoTime,1);assert.match(ui.state.observationRecords[0].ageElement.textContent,/撮影から2.5秒/);assert.match(ui.state.observationRecords[0].ageElement.textContent,/引継ぎはしません/);assert.equal(ui.observer.latest.result.captureStamp.videoTime,3.5);assert(ui.observer.latest.result.proposals.every(p=>!p.rankings));assert.equal(ui.observer.stats.classificationsCompleted,1);});
check('next automatic request reads current pixels after slow inference',()=>{const req=auto.worker.messages.at(-1).message;assert.equal(req.type,'recognize');assert.equal(req.captureStamp.videoTime,3.5);assert.equal(req.crop.rgba[0],125);});
// A later native media position must never be combined with the last observed boxes.
const beforeHold = ui.observer.latest, beforeHoldJob = auto.worker.messages.at(-1).message, holdWorker = auto.worker;
video.currentTime = 3.777; video.frameValue = 201;
await el('pause-video-observation').click(); await video.trigger('pause');
const held = ui.observer.held, heldLabel = el('video-position-age').textContent;
check('explicit pause holds exact observed pixels, boxes and time, not the newer video frame',()=>{assert(video.paused);assert(!ui.observer.running);assert.equal(ui.observer.latest,null);assert.equal(held.image.rgba[0],125);assert.equal(held.result.captureStamp.videoTime,3.5);assert.equal(video.currentTime,3.777);assert.deepEqual(held.result.proposals,beforeHold.result.proposals);assert.equal(el('video-observation-view').context.paintedPixels[0],125);assert.deepEqual(el('video-observation-view').context.boxes,held.result.proposals.map(p=>Object.values(p.roi)));assert(!el('video-observation-view').hidden);assert.match(heldLabel,/固定した観測.*3.500秒/);assert.match(heldLabel,/同一フレーム/);assert.match(heldLabel,/現在の位置・敵の種類は未確認/);assert.equal(frameCallbacks.size,0);assert(holdWorker.terminated);assert.equal(ui.observer.active,null);assert.match(el('start-video-observation').textContent,/再開/);});
emitResult(holdWorker,beforeHoldJob);holdWorker.emit({type:'progress',id:beforeHoldJob.id,romEpoch:30,message:'late paused work'});await settle();
check('late inference and progress cannot change the held observation or append old ranks',()=>{assert.strictEqual(ui.observer.held,held);assert.equal(el('video-position-age').textContent,heldLabel);assert.equal(ui.state.observationRecords.length,1);assert(!el('video-observation-status').textContent.includes('late paused work'));});
const holdCount=autoCount();observerClock=99999;video.frameValue=202;await el('pause-video-observation').click();await video.trigger('pause');
check('repeat pause retains one snapshot indefinitely without playback, scheduling or a new capture',()=>{assert.strictEqual(ui.observer.held,held);assert.equal(ui.observer.latest,null);assert.equal(autoCount(),holdCount);assert.equal(frameCallbacks.size,0);assert(video.paused);assert(!el('video-observation-view').hidden);assert.equal(el('video-observation-view').context.paintedPixels[0],125);assert.equal(el('video-position-age').textContent,heldLabel);});
observerClock=4000;await el('start-video-observation').click();auto=await preparedWorker();
check('explicit observation resume releases the held buffer and starts fresh work only once',()=>{assert(ui.observer.running);assert.equal(ui.observer.held,null);assert.equal(ui.observer.latest,null);assert.equal(frameCallbacks.size,1);assert(!video.paused);assert(el('video-observation-view').hidden);assert.equal(ui.state.observationRecords.length,0);});
auto.worker.emit({type:'result',id:auto.req.id,romEpoch:30,result:{prepared:true}});await settle();await fireFrame(4000,141);
const beforeSeekRequest=auto.worker.messages.at(-1).message;await video.trigger('seeking');
check('seeking cancels callback and active worker, clears prior automatic observations',()=>{assert(!ui.observer.running);assert.equal(frameCallbacks.size,0);assert(auto.worker.terminated);assert.equal(ui.state.observationRecords.length,0);assert(el('video-observation-view').hidden);});
emitResult(auto.worker,beforeSeekRequest);await settle();check('late automatic response after seek cannot restore observations',()=>assert.equal(el('video-observations').children.length,0));
await ui.startVideoObservation();auto=await preparedWorker();doc.hidden=true;await documentEvents.trigger('visibilitychange');
check('hidden tab stops preparation and callbacks instead of accumulating work',()=>{assert(!ui.observer.running);assert(auto.worker.terminated);assert.equal(frameCallbacks.size,0);});
nAuto=autoCount();await ui.startVideoObservation();check('hidden page cannot start a new automatic preparation',()=>assert.equal(autoCount(),nAuto));doc.hidden=false;await documentEvents.trigger('visibilitychange');
check('returning to visible enables explicit restart without starting automatically',()=>{assert(!el('start-video-observation').disabled);assert(!ui.observer.running);assert.equal(frameCallbacks.size,0);});
await ui.startVideoObservation();auto=await preparedWorker();await el('stop-video-observation').click();auto.worker.emit({type:'result',id:auto.req.id,romEpoch:30,result:{prepared:true}});await settle();
check('stop during preparation cannot restart scheduling on late completion',()=>{assert(!ui.observer.running);assert.equal(frameCallbacks.size,0);assert.equal(ui.observer.active,null);});
await ui.startVideoObservation();auto=await preparedWorker();el('inference-backend').value='webgpu';await el('inference-backend').trigger('change');
check('backend changes stop the observer before a new provider can be used',()=>{assert(!ui.observer.running);assert(auto.worker.terminated);assert.equal(frameCallbacks.size,0);});
el('inference-backend').value='wasm';await el('inference-backend').trigger('change');await ui.startVideoObservation();auto=await preparedWorker();el('source-file').files=[];ui.selectSource();
check('source replacement stops all automatic jobs and releases current positions',()=>{assert(!ui.observer.running);assert.equal(ui.observer.latest,null);assert.equal(ui.state.observationRecords.length,0);assert.equal(frameCallbacks.size,0);});
Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'automatic-final',sourceEpoch:ui.state.sourceEpoch+1});await ui.startVideoObservation();auto=await preparedWorker();await win.trigger('pagehide');auto.worker.emit({type:'result',id:auto.req.id,romEpoch:30,result:{prepared:true}});await settle();
check('pagehide cancels automatic observation and rejects late preparation',()=>{assert(!ui.observer.running);assert.equal(frameCallbacks.size,0);assert.equal(ui.observer.active,null);});
// Pending play is also a cancelable start intent, before any Worker job exists.
await win.trigger('pageshow',{persisted:true});Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'pending-play-video',sourceEpoch:40,romFile:file,catalog,selected:new Set(DEFAULT_MODELS)});Object.assign(video,{videoWidth:640,videoHeight:480,readyState:4,seeking:false,ended:false,paused:true});el('video-observation-dense').checked=false;
for(const interrupt of ['seek','stop','pause','hidden','dense-setting','cancel']){
 let finishPlay;video.play=()=>new Promise(resolve=>{finishPlay=()=>{video.paused=false;resolve()}});const before=autoCount(),starting=ui.startVideoObservation();await settle();
 assert(ui.state.observationStarting);assert(!el('stop-video-observation').disabled);assert(el('start-video-observation').disabled);
 if(interrupt==='seek'){video.currentTime+=10;await video.trigger('seeking');}
 if(interrupt==='stop')await el('stop-video-observation').click();
 if(interrupt==='pause'){video.paused=true;await video.trigger('pause');}
 if(interrupt==='hidden'){doc.hidden=true;await documentEvents.trigger('visibilitychange');}
 if(interrupt==='dense-setting')await el('video-observation-dense').trigger('change');
 if(interrupt==='cancel')await el('cancel').click();
 finishPlay();await starting;await settle();
 check(`pending play cannot restart after ${interrupt}`,()=>{assert(!ui.observer.running);assert(!ui.state.observationStarting);assert.equal(frameCallbacks.size,0);assert.equal(autoCount(),before);});
 if(interrupt==='hidden'){doc.hidden=false;await documentEvents.trigger('visibilitychange');}
}
let rejectOldPlay;video.play=()=>new Promise((resolve,reject)=>{rejectOldPlay=reject});const oldStart=ui.startVideoObservation();await settle();await el('stop-video-observation').click();video.play=async()=>{video.paused=false};await ui.startVideoObservation();auto=await preparedWorker();const newestActive=ui.observer.active;rejectOldPlay(new Error('late old play error'));await oldStart;await settle();
check('old failed play cannot stop or clear a newer preparation',()=>{assert(ui.observer.running);assert.strictEqual(ui.observer.active,newestActive);assert(!auto.worker.terminated);});await el('stop-video-observation').click();
// Browser EOF replay implicitly seeks during play(). Explicit rewind must finish first.
let replayPlayCalls=0;
video.play=async()=>{replayPlayCalls++;if(video.ended){video.currentTime=0;video.seeking=true;await video.trigger('seeking');video.seeking=false;video.ended=false;await video.trigger('seeked');}video.paused=false;};
Object.assign(video,{ended:true,paused:true,seeking:false,currentTime:16,duration:16});el('video-observation-dense').checked=true;
const beforeReplay=autoCount(),replaySegment=ui.state.timelineSegment,replaying=ui.startVideoObservation();await settle();
check('EOF restart owns an explicit rewind before any play or inference',()=>{assert.equal(video.currentTime,0);assert.equal(replayPlayCalls,0);assert(ui.state.observationStarting);assert.equal(autoCount(),beforeReplay);});
video.seeking=true;await video.trigger('seeking');
check('owned rewind seeking preserves only the pending start and advances timeline',()=>{assert(ui.state.observationStarting);assert.equal(ui.state.timelineSegment,replaySegment+1);assert(!ui.observer.running);assert.equal(frameCallbacks.size,0);});
video.ended=false;video.seeking=false;await video.trigger('seeked');await replaying;auto=await preparedWorker();
check('EOF restart begins one dense-enabled preparation after seek completion',()=>{assert.equal(replayPlayCalls,1);assert(ui.observer.running);assert(ui.observer.config.denseSupplement);assert.equal(frameCallbacks.size,1);assert.equal(autoCount(),beforeReplay+1);});
auto.worker.emit({type:'result',id:auto.req.id,romEpoch:ui.state.romEpoch,result:{prepared:true}});await settle();await fireFrame(5000,144);
check('restarted loop samples current frames after natural end',()=>{assert.equal(ui.observer.stats.sampledFrames,1);assert.equal(ui.observer.latest.image.rgba[0],144);});await el('stop-video-observation').click();
for(const interrupt of ['stop','hidden','source','seek','duplicate-seeking','pause','error']){
 Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:`rewind-${interrupt}`,sourceEpoch:ui.state.sourceEpoch+1});Object.assign(video,{ended:true,paused:true,seeking:false,currentTime:16});
 const calls=replayPlayCalls,before=autoCount(),start=ui.startVideoObservation();await settle();video.seeking=true;await video.trigger('seeking');
 if(interrupt==='stop')await el('stop-video-observation').click();
 if(interrupt==='hidden'){doc.hidden=true;await documentEvents.trigger('visibilitychange');}
 if(interrupt==='source'){el('source-file').files=[];ui.selectSource();}
 if(interrupt==='seek'){video.currentTime=7;await video.trigger('seeking');}
 if(interrupt==='duplicate-seeking')await video.trigger('seeking');
 if(interrupt==='pause'){video.paused=true;await video.trigger('pause');}
 if(interrupt==='error')await video.trigger('error');
 video.seeking=false;video.ended=false;await video.trigger('seeked');await start;await settle();
 check(`pending EOF rewind rejects late seeked after ${interrupt}`,()=>{assert(!ui.observer.running);assert(!ui.state.observationStarting);assert.equal(replayPlayCalls,calls);assert.equal(autoCount(),before);assert.equal(frameCallbacks.size,0);});
 if(interrupt==='hidden'){doc.hidden=false;await documentEvents.trigger('visibilitychange');}
}
Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'rewind-cpu',sourceEpoch:ui.state.sourceEpoch+1});Object.assign(video,{ended:true,paused:true,seeking:false,currentTime:16});el('video-observation-dense').checked=false;
const cpuReplay=ui.startVideoObservation();await settle();video.seeking=true;await video.trigger('seeking');video.seeking=false;video.ended=false;await video.trigger('seeked');await cpuReplay;auto=await preparedWorker();
check('CPU-only EOF restart retains its unchanged mode and explicit Stop',()=>{assert(ui.observer.running);assert(!ui.observer.config.denseSupplement);});await el('stop-video-observation').click();
// Late seeked notifications cannot interrupt a newer rewind that is still seeking.
Object.assign(video,{ended:true,paused:true,seeking:false,currentTime:16});let staleRewind=ui.startVideoObservation();await settle();await el('stop-video-observation').click();await staleRewind;
Object.assign(video,{ended:true,paused:true,seeking:false,currentTime:16});const newRewind=ui.startVideoObservation();await settle();await video.trigger('seeked');
check('stale seeked before the newer rewind seeking event is ignored',()=>assert(ui.state.observationStarting));
video.seeking=true;await video.trigger('seeking');await video.trigger('seeked');
check('stale seeked cannot cancel a newer rewind still in progress',()=>{assert(ui.state.observationStarting);assert(!ui.observer.running);});
video.seeking=false;video.ended=false;await video.trigger('seeked');await newRewind;auto=await preparedWorker();
check('the newer rewind still starts once its own seek completes',()=>assert(ui.observer.running));await el('stop-video-observation').click();
// The independent display-age timer does no inference and handles missing video callbacks.
let timerSerial=0;const ageTimers=new Map();win.setTimeout=fn=>{const id=++timerSerial;ageTimers.set(id,fn);return id};win.clearTimeout=id=>ageTimers.delete(id);
await ui.startVideoObservation();auto=await preparedWorker();auto.worker.emit({type:'result',id:auto.req.id,romEpoch:ui.state.romEpoch,result:{prepared:true}});await settle();await fireFrame(10000,140);const beforeAgeJobs=autoCount();observerClock=12000;const ageTick=ageTimers.entries().next().value;assert(ageTick);ageTimers.delete(ageTick[0]);ageTick[1]();await settle();
check('buffering updates wall-clock age and hides stale boxes without starting work',()=>{assert.match(el('video-position-age').textContent,/撮影から2.0秒/);assert.match(el('video-position-age').textContent,/現在は未観測/);assert(el('video-observation-view').hidden);assert.equal(autoCount(),beforeAgeJobs);assert.equal(ageTimers.size,1);});await el('stop-video-observation').click();
check('stop cancels both frame and display-age callbacks',()=>{assert.equal(ageTimers.size,0);assert.equal(frameCallbacks.size,0);});delete win.setTimeout;delete win.clearTimeout;
// Actual shrine proposer through both page paths. Only browser/Worker APIs are fixtures;
// the proposal algorithm, tracker, crop contract and observer scheduler are real.
const warmPixels = new Uint8ClampedArray(256 * 192 * 4);
for (let i = 0; i < 256 * 192; i++) warmPixels.set([20,70,150,255], i * 4);
const paintWarm = (x,y,w,h,c) => { for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)warmPixels.set([...c,255],(yy*256+xx)*4); };
paintWarm(5,40,180,125,[90,85,80]);paintWarm(30,60,20,30,[200,50,30]);
Object.assign(video,{videoWidth:256,videoHeight:192,frameRGBA:warmPixels,ended:false,seeking:false,paused:true,currentTime:13});
Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'warm-integration',sourceEpoch:ui.state.sourceEpoch+1});
el('enable-roi-proposals').checked=true;el('scene-kind').value='field';el('exclude-center').checked=true;el('gameplay-layout').value='whole';el('video-observation-dense').checked=false;
proposalFactory=proposeEnemyROIs;ui.observer.propose=proposeEnemyROIs;ui.observer.tracker=new EnemyProposalTracker();
ui.freeze();await el('generate-roi-proposals').click();
const warmFrozen=ui.state.proposalResult,warmROI=warmFrozen.proposals[0]?.roi;
check('enabled shrine page really recovers the compact frozen component',()=>{assert.equal(proposalCalls.at(-1).options.oversizedWarmSplit,true);assert.equal(warmFrozen.warmSplitExperiment.added,1);assert.equal(warmFrozen.proposals.length,1);assert.equal(warmFrozen.proposals[0].proposalSource,'oversized-warm-chroma-split');assert(warmROI.x<=30&&warmROI.y<=60&&warmROI.x+warmROI.w>=50&&warmROI.y+warmROI.h>=90);});
check('the same pixels stay unrecovered for outside callers using the core default',()=>{assert.equal(proposeEnemyROIs({width:256,height:192,rgba:warmPixels},warmFrozen.captureStamp,{profile:'shrine-blue-v1'}).proposals.length,0);});
await el('roi-proposal-list').children[0].click();dinoJob=await beginScoring();dinoRequest=dinoJob.worker.messages.at(-1).message;
check('compact frozen proposal reaches the unchanged classifier with exact crop pixels',()=>{assert.equal(dinoRequest.type,'recognize');assert.deepEqual(dinoRequest.captureStamp.enemyROI,warmROI);for(let y=0;y<warmROI.h;y++)for(let x=0;x<warmROI.w;x++)assert.deepEqual(dinoRequest.crop.rgba.subarray((y*warmROI.w+x)*4,(y*warmROI.w+x+1)*4),warmPixels.subarray(((y+warmROI.y)*256+x+warmROI.x)*4,((y+warmROI.y)*256+x+warmROI.x+1)*4));assert(!Object.hasOwn(dinoRequest,'oversizedWarmSplit'));});
emitResult(dinoJob.worker,dinoRequest);await dinoJob.completion;
await ui.startVideoObservation();auto=await preparedWorker();const warmPreparation=auto.req;
check('page enables warm mode but keeps pose-cache preparation scope unchanged',()=>{assert.equal(ui.observer.config.oversizedWarmSplit,true);assert.deepEqual(Object.keys(warmPreparation).sort(),['featureMethod','id','inferenceBackend','modelIds','preset','romEpoch','type','variant'].sort());assert.deepEqual(warmPreparation.modelIds,[...DEFAULT_MODELS]);assert.equal(warmPreparation.variant,'_f');assert.equal(warmPreparation.preset,'quick');assert.equal(warmPreparation.inferenceBackend,'wasm');});
auto.worker.emit({type:'result',id:auto.req.id,romEpoch:ui.state.romEpoch,result:{prepared:true}});await settle();await fireFrame(13000);
const warmVideo=ui.observer.latest.result,warmVideoRequest=auto.worker.messages.at(-1).message;
check('page to real observer enables the same warm ROI and bounded original-pixel request',()=>{assert.equal(warmVideo.warmSplitExperiment.added,1);assert.deepEqual(warmVideo.proposals.map(p=>p.roi),warmFrozen.proposals.map(p=>p.roi));assert.equal(warmVideoRequest.type,'recognize');assert.deepEqual(warmVideoRequest.captureStamp.enemyROI,warmROI);assert.deepEqual(warmVideoRequest.crop.rgba,dinoRequest.crop.rgba);assert.equal(warmVideoRequest.captureStamp.videoTime,13);assert.equal(ui.observer.stats.maxActiveJobs,1);assert(warmVideo.proposals.length<=8);});
const oldWarmWorker=auto.worker,trackerGeneration=ui.observer.tracker.generation;let cacheClears=0;clearLocalFeatures=async()=>{cacheClears++;};
el('enable-roi-proposals').checked=false;await el('enable-roi-proposals').trigger('change');emitResult(oldWarmWorker,warmVideoRequest);await settle();
check('profile toggle cancels warm work and resets tracking without erasing pose caches',()=>{assert(!ui.observer.running);assert.equal(ui.observer.latest,null);assert.equal(ui.observer.tracker.previous,null);assert.equal(ui.observer.tracker.tracks.length,0);assert(ui.observer.tracker.generation>trackerGeneration);assert.equal(ui.state.proposalResult,null);assert.equal(ui.state.observationRecords.length,0);assert.equal(frameCallbacks.size,0);assert(oldWarmWorker.terminated);assert.equal(cacheClears,0);});
const blockedCalls=proposalCalls.length,blockedJobs=autoCount();await ui.generateProposals();await ui.startVideoObservation();
check('disabled shrine gate blocks both real paths before any proposal or inference',()=>{assert.equal(proposalCalls.length,blockedCalls);assert.equal(autoCount(),blockedJobs);assert(!ui.observer.running);});
el('enable-roi-proposals').checked=true;await el('enable-roi-proposals').trigger('change');
check('reenabling shrine does not automatically revive stale proposals or work',()=>{assert.equal(ui.state.proposalResult,null);assert(!ui.observer.running);assert.equal(autoCount(),blockedJobs);});
await ui.startVideoObservation();auto=await preparedWorker();
check('explicit shrine restart preserves the same bank key inputs',()=>{for(const key of ['romEpoch','modelIds','variant','preset','featureMethod','inferenceBackend'])assert.deepEqual(auto.req[key],warmPreparation[key]);assert.equal(cacheClears,0);assert.equal(ui.observer.config.oversizedWarmSplit,true);});
await el('stop-video-observation').click();el('scene-kind').value='unspecified';await el('scene-kind').trigger('change');const offSceneCalls=proposalCalls.length,offSceneJobs=autoCount();await ui.generateProposals();await ui.startVideoObservation();
check('unknown scene remains blocked even with the shrine checkbox enabled',()=>{assert.equal(proposalCalls.length,offSceneCalls);assert.equal(autoCount(),offSceneJobs);assert(!ui.observer.running);});
check('UI states the warm shrine assumption and extra background/classification cost',()=>{assert.match(html,/青い床と暖色の体/);assert.match(html,/灰色のメタル系や他のマップ/);assert.match(html,/背景候補と分類コスト/);});
// Reproduce the reported ROM + OBS video, but still-disabled Video Start journey.
delete video.frameRGBA;Object.assign(video,{videoWidth:1920,videoHeight:1080,paused:true,seeking:false,ended:false,currentTime:0,readyState:4});
Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'reported-disabled-start',sourceEpoch:ui.state.sourceEpoch+1,romFile:file,catalog});
el('enable-roi-proposals').checked=true;el('scene-kind').value='unspecified';el('gameplay-layout').value='whole';el('exclude-center').checked=false;el('feature-method').value='histogram';el('variant').value='_f';el('preset').value='quick';el('video-observation-dense').checked=true;el('inference-backend').value='webgpu';ui.state.selected=new Set(DEFAULT_MODELS);ui.freeze();
const reportedMissing=el('video-observation-requirements').textContent;
check('reported checkbox-on state shows every remaining blocker together',()=>{assert(el('start-video-observation').disabled);for(const term of [/DINOv2/,/場面をフィールド/,/中央の除外/,/4:3/])assert.match(reportedMissing,term);assert(!el('apply-shrine-video-preset').hidden);});
el('variant').value='both';el('preset').value='standard';ui.state.selected=new Set(['z999x']);await el('variant').trigger('change');
check('variant, preset and model blockers are also reported together',()=>{for(const term of [/フィールドモデル/,/クイック/,/初期の4モデル/])assert.match(el('video-observation-requirements').textContent,term);});
const jobsBeforePreset=autoCount(),assetsBeforePreset=preparationCalls.length;await el('apply-shrine-video-preset').click();
check('one explicit OBS-shrine preset makes the loaded screenshot journey ready',()=>{assert(!el('start-video-observation').disabled);assert(el('enable-roi-proposals').checked);assert.equal(el('scene-kind').value,'field');assert.equal(el('gameplay-layout').value,'obs-right-upper');assert(el('exclude-center').checked);assert.equal(el('feature-method').value,'dinov2');assert.equal(el('variant').value,'_f');assert.equal(el('preset').value,'quick');assert.deepEqual([...ui.state.selected],[...DEFAULT_MODELS]);assert.match(el('video-observation-requirements').textContent,/準備できました/);});
check('preset preserves backend and optional DINO choice without playback or inference',()=>{assert.equal(el('inference-backend').value,'webgpu');assert(el('video-observation-dense').checked);assert(video.paused);assert(!ui.observer.running);assert.equal(autoCount(),jobsBeforePreset);assert.equal(preparationCalls.length,assetsBeforePreset);assert.equal(frameCallbacks.size,0);});
check('missing crop explanation survives preset and method changes',()=>{assert(el('start').disabled);assert.match(el('recognition-requirements').textContent,/候補ボタンを1つ選んで/);});
await el('feature-method').trigger('change');check('general settings status cannot replace the persistent crop prerequisite',()=>{assert.match(el('status').textContent,/設定を変更/);assert.match(el('recognition-requirements').textContent,/固定画像上で敵を囲む/);});
// The preset resets/cancels old work through the normal configuration path.
el('inference-backend').value='wasm';el('video-observation-dense').checked=false;await ui.startVideoObservation();auto=await preparedWorker();const beforeRepeat=autoCount(),repeatOld=auto;
await el('apply-shrine-video-preset').click();repeatOld.worker.emit({type:'result',id:repeatOld.req.id,romEpoch:ui.state.romEpoch,result:{prepared:true}});await settle();
check('repeated preset cancels preparation and rejects late completion without restarting',()=>{assert(repeatOld.worker.terminated);assert(!ui.observer.running);assert.equal(ui.observer.active,null);assert.equal(frameCallbacks.size,0);assert.equal(autoCount(),beforeRepeat);assert.equal(ui.state.observationRecords.length,0);assert.equal(el('inference-backend').value,'wasm');assert(!el('video-observation-dense').checked);assert(!el('start-video-observation').disabled);});
Object.assign(video,{videoWidth:4096,videoHeight:3072});await el('apply-shrine-video-preset').click();
check('preset cannot bypass the real video allocation and gameplay-size limits',()=>{assert(el('start-video-observation').disabled);assert.match(el('video-observation-requirements').textContent,/2,097,152/);assert.match(el('video-observation-requirements').textContent,/1024px/);assert(!ui.observer.running);});
Object.assign(video,{videoWidth:1920,videoHeight:500});await el('apply-shrine-video-preset').click();
check('preset exposes an out-of-bounds OBS panel instead of enabling Start',()=>{assert(el('start-video-observation').disabled);assert.match(el('video-observation-requirements').textContent,/はみ出/);});
Object.assign(video,{videoWidth:1920,videoHeight:1080});ui.state.sourceKind='image';await el('apply-shrine-video-preset').click();
check('preset cannot make an image input a video',()=>{assert(el('start-video-observation').disabled);assert.match(el('video-observation-requirements').textContent,/再生できる動画/);});
ui.state.sourceKind='video';ui.state.capture=null;ui.state.roi=null;await el('feature-method').trigger('change');
check('loaded video without a capture gives the exact Freeze action for ordinary recognition',()=>{assert(el('start').disabled);assert.match(el('recognition-requirements').textContent,/フリーズして範囲を選ぶ/);});
ui.freeze();ui.setROI({x:1000,y:150,w:60,h:80});ui.state.selected=new Set();await el('feature-method').trigger('change');
check('no model selection has a persistent actionable reason',()=>{assert(el('start').disabled);assert.match(el('recognition-requirements').textContent,/1〜4種類選択/);});
ui.state.selected=new Set(catalog.map(m=>m.modelId));await el('feature-method').trigger('change');
check('excess model selection reports the existing four-model cap',()=>{assert(el('start').disabled);assert.match(el('recognition-requirements').textContent,/4種類以内/);});
ui.state.catalog=[];await el('feature-method').trigger('change');
check('missing ROM catalog points to the existing reread recovery action',()=>{assert(el('start').disabled);assert.match(el('recognition-requirements').textContent,/NDSを再読込/);});
check('preset assumptions and unchanged start action are explicit in HTML',()=>{assert.match(html,/OBS左右配置の右上DS画面で録画した動画用/);assert.match(html,/AIの実行方式は変えません/);assert.match(html,/DINO補助は任意/);assert.match(html,/id="start"[^>]*aria-describedby="recognition-requirements"/);assert.match(html,/id="start-video-observation"[^>]*aria-describedby="video-observation-requirements"/);});
// Original error data survives the real client boundary and every cleanup path.
const diagnosticWorker=new MockWorker(),diagnosticClient=new RecognitionWorkerClient({factory:()=>diagnosticWorker});
const diagnosticPromise=diagnosticClient.prepare({type:'prepare',id:'diagnostic',romEpoch:99});
const diagnosticFailure={name:'TypeError',message:'fixture ORT initialization failed',stack:'TypeError: fixture ORT initialization failed\n    at fixtureRuntime:7',stage:'webgpu-init'};
diagnosticWorker.emit({type:'error',id:'other',romEpoch:99,message:'stale',error:diagnosticFailure});
check('structured error still requires the current request identity',()=>assert.equal(diagnosticClient.pending.size,1));
diagnosticWorker.emit({type:'error',id:'diagnostic',romEpoch:99,message:diagnosticFailure.message,error:diagnosticFailure});
let receivedDiagnostic;try{await diagnosticPromise}catch(e){receivedDiagnostic=e}
check('Worker error preserves original name, message, stack and stage',()=>{assert(receivedDiagnostic instanceof Error);for(const k of ['name','message','stack','stage'])assert.equal(receivedDiagnostic[k],diagnosticFailure[k]);});diagnosticClient.terminate();
ui.state.catalog=catalog;ui.state.selected=new Set(DEFAULT_MODELS);ui.state.sourceKind='video';Object.assign(video,{videoWidth:1920,videoHeight:1080,paused:true,seeking:false,ended:false});await el('apply-shrine-video-preset').click();el('inference-backend').value='webgpu';await el('inference-backend').trigger('change');
const probeFailure=Object.assign(new TypeError('fixture adapter request rejected'),{stack:'TypeError: fixture adapter request rejected\n    at requestAdapter:11'});probeGPU=async()=>{throw probeFailure};
await ui.startVideoObservation();await settle();let rejectionWorker=uiWorkers.at(-1),rejectionRequest=rejectionWorker.messages.at(-1).message;if(rejectionRequest.type==='load'){rejectionWorker.emit({type:'loaded',id:rejectionRequest.id,romEpoch:rejectionRequest.romEpoch,catalog});await settle();}
check('video GPU-probe rejection exposes the original failure and releases all busy flags',()=>{assert.match(el('error').textContent,/webgpu-probe.*TypeError: fixture adapter request rejected/);assert.equal(el('error-stack').textContent.includes(probeFailure.stack),true);assert(!el('error-details').hidden);assert(!ui.state.busy);assert(!ui.state.loading);assert(!ui.state.observationStarting);assert(!ui.observer.running);assert(!el('start-video-observation').disabled);assert.equal(el('inference-backend').value,'webgpu');assert.equal(frameCallbacks.size,0);});
el('inference-backend').value='wasm';await el('inference-backend').trigger('change');check('explicit CPU selection remains restartable after a video GPU failure',()=>assert(!el('start-video-observation').disabled));
// Worker-side session initialization rejection has the same visible detail and cleanup.
probeGPU=async()=>({});el('inference-backend').value='webgpu';await el('inference-backend').trigger('change');await ui.startVideoObservation();auto=await preparedWorker();auto.worker.emit({type:'error',id:auto.req.id,romEpoch:ui.state.romEpoch,message:diagnosticFailure.message,error:diagnosticFailure});await settle();
check('video Worker init rejection retains stack/stage and permits explicit retry',()=>{assert.match(el('error').textContent,/webgpu-init.*TypeError: fixture ORT initialization failed/);assert(el('error-stack').textContent.includes(diagnosticFailure.stack));assert(!ui.state.busy&&!ui.state.loading&&!ui.state.observationStarting&&!ui.observer.running);assert(!el('start-video-observation').disabled);assert.equal(el('inference-backend').value,'webgpu');});
// The manual crop path reports the original probe stage as well.
ui.freeze();ui.setROI({x:1000,y:150,w:60,h:80});probeGPU=async()=>{throw probeFailure};dinoJob=await beginScoring();await dinoJob.completion;
check('manual GPU failure exposes original detail while leaving explicit retry usable',()=>{assert.match(el('error').textContent,/webgpu-probe.*TypeError/);assert(el('error-stack').textContent.includes(probeFailure.stack));assert(!ui.state.busy&&!ui.state.loading);assert(!el('start').disabled);assert.equal(el('inference-backend').value,'webgpu');});
el('inference-backend').value='wasm';await el('inference-backend').trigger('change');check('manual explicit CPU choice enables Start without a fallback inference',()=>{assert(!el('start').disabled);assert(!ui.state.busy);});
// Hold/reset journeys use the actual observer and real draw calls through this DOM harness.
Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'hold-reset',sourceEpoch:ui.state.sourceEpoch+1,romFile:file,catalog,selected:new Set(DEFAULT_MODELS)});
Object.assign(video,{videoWidth:640,videoHeight:480,readyState:4,seeking:false,ended:false,paused:true});
el('enable-roi-proposals').checked=true;el('scene-kind').value='field';el('exclude-center').checked=true;el('gameplay-layout').value='whole';el('feature-method').value='dinov2';el('inference-backend').value='wasm';el('variant').value='_f';el('preset').value='quick';el('video-observation-dense').checked=false;prepareInference=async()=>({});
ui.observer.propose=(image,captureStamp)=>({...defaultProposalFactory(image,captureStamp),trackingFrame:{}});
for(const reset of ['seek','configuration','source','rom','native-play','stop']){
 Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:`hold-${reset}`,romFile:file,catalog,selected:new Set(DEFAULT_MODELS)});
 await ui.startVideoObservation();auto=await preparedWorker();await fireFrame(15000,177);
 video.paused=true;await video.trigger('pause');const resetHeld=ui.observer.held;
 check(`native pause before ${reset} retains preview even during preparation`,()=>{assert(resetHeld);assert(!ui.observer.running);assert(!el('video-observation-view').hidden);assert.equal(resetHeld.image.rgba[0],177);assert.equal(frameCallbacks.size,0);});
 if(reset==='seek'){video.currentTime=16;await video.trigger('seeking');}
 if(reset==='configuration')await el('inference-backend').trigger('change');
 if(reset==='source'){el('source-file').files=[];ui.selectSource();}
 if(reset==='rom'){el('rom-file').files=[];await ui.selectROM();}
 if(reset==='native-play'){video.paused=false;await video.trigger('play');}
 if(reset==='stop')await el('stop-video-observation').click();
 check(`${reset} clears held provenance and pixels without restarting observation`,()=>{assert.equal(ui.observer.held,null);assert.equal(ui.observer.latest,null);assert(!ui.observer.running);assert.equal(frameCallbacks.size,0);assert(el('video-observation-view').hidden);assert.equal(el('video-observation-view').width,0);assert(!el('video-position-age').textContent.includes('固定した観測'));});
}
await ui.startVideoObservation();auto=await preparedWorker();await el('pause-video-observation').click();
check('pause before first observation stops media without fabricating a frame',()=>{assert(video.paused);assert.equal(ui.observer.held,null);assert.equal(ui.observer.latest,null);assert(!ui.observer.running);assert.equal(frameCallbacks.size,0);assert.match(el('video-observation-status').textContent,/まだありません/);});
// Preview filtering is presentational only, including held frames and historical crops.
Object.assign(ui.state,{sourceReady:true,sourceKind:'video',sourceId:'filtered-preview',sourceEpoch:ui.state.sourceEpoch+1,romFile:file,catalog,selected:new Set(DEFAULT_MODELS)});
Object.assign(video,{videoWidth:640,videoHeight:480,readyState:4,seeking:false,ended:false,paused:true});
const allPreviewCandidates=Object.freeze(Array.from({length:8},(_,i)=>Object.freeze({proposalId:`original-${i+1}`,roi:Object.freeze({x:10+i*70,y:30+i*5,w:30,h:40})})));
const originalPreviewCandidates=structuredClone(allPreviewCandidates);
ui.observer.propose=(image,captureStamp)=>({captureStamp:cloneCaptureStamp(captureStamp),proposals:allPreviewCandidates,trackingFrame:{}});
ui.observer.tracker={reset(){},update(r){return{observed:r.proposals.map((p,i)=>({...p,id:`preview-track-${i}`,sightings:2})),unobserved:[],camera:{reliable:true}}}};
await ui.startVideoObservation();auto=await preparedWorker();await fireFrame(20000,150);
const previewCanvas=el('video-observation-view'),previewContext=previewCanvas.context;
// Exercise the renderer with immutable input, independently of the observer's clones.
ui.observer.onPositions({...ui.observer.latest,result:Object.freeze({...ui.observer.latest.result,proposals:allPreviewCandidates})});
check('preview draws only original numbers 1 and 2 without mutating eight candidates',()=>{assert.deepEqual(previewContext.boxes,allPreviewCandidates.slice(0,2).map(p=>Object.values(p.roi)));assert.deepEqual(previewContext.labels,['1','2']);assert.deepEqual(allPreviewCandidates,originalPreviewCandidates);assert.equal(ui.observer.latest.result.proposals.length,8);assert.deepEqual(ui.observer.latest.result.proposals.map(p=>p.proposalId),allPreviewCandidates.map(p=>p.proposalId));assert.match(el('video-position-age').textContent,/表示 2枠 \/ 内部候補 8枠/);});
auto.worker.emit({type:'result',id:auto.req.id,romEpoch:ui.state.romEpoch,result:{prepared:true}});await settle();
const historicalPreviewRequest=auto.worker.messages.at(-1).message;
await fireFrame(20500,170);
const currentPreviewBoxes=structuredClone(previewContext.boxes),currentPreviewLabels=[...previewContext.labels];
emitResult(auto.worker,historicalPreviewRequest);await settle();
check('actual classified crop keeps its original pixels and time without replacing newer overlay',()=>{const item=ui.state.observationRecords[0],card=el('video-observations').children[0];assert.equal(item.captureStamp.videoTime,20);assert.deepEqual(item.roi,historicalPreviewRequest.captureStamp.enemyROI);assert.equal(item.thumbnail.context.snapshot,150);assert.match(item.thumbnail.getAttribute('aria-label'),/実際に照合した/);assert.match(card.children[0].textContent,/実際に照合した切り抜き.*20.000秒/);assert.equal(ui.observer.latest.result.captureStamp.videoTime,20.5);assert.equal(previewContext.paintedPixels[0],170);assert.deepEqual(previewContext.boxes,currentPreviewBoxes);assert.deepEqual(previewContext.labels,currentPreviewLabels);assert(ui.observer.latest.result.proposals.every(p=>!p.rankings));});
// Ordinals come from the classified capture, never a lookup in the current proposal set.
ui.observer.onObservation({captureStamp:cloneCaptureStamp(historicalPreviewRequest.captureStamp),roi:{...historicalPreviewRequest.captureStamp.enemyROI},preview:{width:historicalPreviewRequest.crop.width,height:historicalPreviewRequest.crop.height,rgba:historicalPreviewRequest.crop.rgba.slice()},proposalOrdinal:7,candidateSource:'cpu-component',result:{rankings:[]},positionObservedAt:20000,dispatchedAt:20000,completedAt:20500});
check('historical card retains the supplied original ordinal instead of a displayed-box index',()=>{assert.match(el('video-observations').children[0].children[0].textContent,/20.000秒.*この時刻の枠 7/);assert.equal(ui.state.observationRecords[0].proposalOrdinal,7);assert.deepEqual(previewContext.labels,['1','2']);assert.equal(previewContext.paintedPixels[0],170);});
const filterJobsBeforePause=autoCount(),pendingFilteredRequest=auto.worker.messages.at(-1).message;
video.currentTime=20.777;video.frameValue=199;await el('pause-video-observation').click();
const filteredHeld=ui.observer.held,filteredHeldLabel=el('video-position-age').textContent;
check('held filtered preview keeps the same two boxes, eight internal candidates and immutable time',()=>{assert(filteredHeld);assert(Object.isFrozen(filteredHeld.result.captureStamp));assert.equal(filteredHeld.result.captureStamp.videoTime,20.5);assert.equal(filteredHeld.image.rgba[0],170);assert.equal(filteredHeld.result.proposals.length,8);assert.deepEqual(previewContext.boxes,currentPreviewBoxes);assert.deepEqual(previewContext.labels,['1','2']);assert.equal(previewContext.paintedPixels[0],170);assert.match(filteredHeldLabel,/20.500秒.*表示 2枠 \/ 内部候補 8枠/);assert.match(filteredHeldLabel,/同一フレーム/);assert.equal(autoCount(),filterJobsBeforePause);assert.equal(frameCallbacks.size,0);});
emitResult(auto.worker,pendingFilteredRequest);await settle();observerClock=90000;await el('pause-video-observation').click();
check('late result and repeat pause cannot repaint the filtered held frame',()=>{assert.strictEqual(ui.observer.held,filteredHeld);assert.equal(el('video-position-age').textContent,filteredHeldLabel);assert.deepEqual(previewContext.boxes,currentPreviewBoxes);assert.deepEqual(previewContext.labels,['1','2']);assert.equal(previewContext.paintedPixels[0],170);assert.equal(ui.state.observationRecords.length,2);});
el('source-file').files=[];ui.selectSource();
check('source replacement clears filtered frame, counts and historical crops without starting work',()=>{assert.equal(ui.observer.held,null);assert.equal(ui.observer.latest,null);assert(previewCanvas.hidden);assert.equal(previewCanvas.width,0);assert.equal(previewCanvas.height,0);assert(!el('video-position-age').textContent.includes('内部候補'));assert.equal(ui.state.observationRecords.length,0);assert.equal(el('video-observations').children.length,0);assert.equal(autoCount(),filterJobsBeforePause);assert.equal(frameCallbacks.size,0);});
check('HTML explains two original-number boxes and distinct actual classified crops',()=>{assert.match(html,/先頭2枠（元の番号1・2）/);assert.match(html,/内部では最大8候補を保持/);assert.match(html,/実際に照合した切り抜き/);});
await win.trigger('pagehide');
console.log(`\n${passed} UI and lifecycle checks passed (Node DOM harness; no browser launched).`);
