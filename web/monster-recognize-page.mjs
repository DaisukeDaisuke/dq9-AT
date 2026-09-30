/* Local-only experimental UI. The scoring worker owns ROM parsing and rendering. */
export const LIMITS = Object.freeze({ romBytes: 512 * 1024 * 1024, sourceSide: 4096, roiSide: 1024, models: 4 });
export const DEFAULT_MODELS = Object.freeze(['z019b', 'z021a', 'z064a', 'z000c']);
const STAMP_KEYS = ['sourceId', 'sourceEpoch', 'timelineSegment', 'frameSerial', 'romEpoch', 'sourceFrame', 'videoTime', 'timestampBasis', 'capturedAt', 'enemyROI'];
const abortError = () => Object.assign(new Error('処理を中止しました。'), { name: 'AbortError' });

export function cloneCaptureStamp(stamp) {
  return Object.fromEntries(STAMP_KEYS.map(key => [key, typeof stamp[key] === 'object' && stamp[key] !== null ? { ...stamp[key] } : stamp[key]]));
}
export function stampEquals(left, right) {
  if (!left || !right) return false;
  return STAMP_KEYS.every(key => {
    if (key === 'sourceFrame') return left[key]?.width === right[key]?.width && left[key]?.height === right[key]?.height;
    if (key === 'enemyROI') return ['x', 'y', 'w', 'h'].every(axis => left[key]?.[axis] === right[key]?.[axis]);
    return left[key] === right[key];
  });
}
export function validateROI(rect, frame) {
  if (!rect || !frame || !['x', 'y', 'w', 'h'].every(key => Number.isInteger(rect[key]))) throw new Error('範囲は整数のピクセル座標で指定してください。');
  const { x, y, w, h } = rect;
  if (x < 0 || y < 0 || w < 1 || h < 1 || w > LIMITS.roiSide || h > LIMITS.roiSide || x + w > frame.width || y + h > frame.height) {
    throw new Error('範囲は元画像の内側で、幅・高さを1〜1024 pxにしてください。');
  }
  return { x, y, w, h };
}
export function pointerROI(start, end, frame) {
  const x = Math.min(frame.width - 1, Math.max(0, Math.floor(Math.min(start.x, end.x))));
  const y = Math.min(frame.height - 1, Math.max(0, Math.floor(Math.min(start.y, end.y))));
  const w = Math.min(LIMITS.roiSide, frame.width - x, Math.max(1, Math.ceil(Math.abs(start.x - end.x))));
  const h = Math.min(LIMITS.roiSide, frame.height - y, Math.max(1, Math.ceil(Math.abs(start.y - end.y))));
  return { x, y, w, h };
}

/** A scoring request is tied to a cloned frozen capture, never to live video state. */
export class RequestGate {
  constructor() { this.revision = 0; this.active = null; }
  invalidate() { this.revision++; this.active = null; }
  begin(id, romEpoch, captureStamp) {
    this.active = { id, romEpoch, revision: this.revision, captureStamp: cloneCaptureStamp(captureStamp) };
    return this.active;
  }
  accepts(message) {
    const active = this.active;
    return !!active && active.revision === this.revision && message.id === active.id && message.romEpoch === active.romEpoch
      && (message.type !== 'result' || stampEquals(message.result?.captureStamp, active.captureStamp));
  }
}

/** Termination also invalidates File.arrayBuffer reads that have not completed yet. */
export class RecognitionWorkerClient {
  constructor({ factory = () => new Worker(new URL('./monster-recognition-worker.mjs', import.meta.url), { type: 'module' }), onProgress = () => {} } = {}) {
    this.factory = factory; this.onProgress = onProgress; this.worker = null; this.generation = 0; this.pending = new Map(); this.loadedRomEpoch = null;
  }
  createWorker() {
    if (this.worker) return this.worker;
    const worker = this.factory(); const generation = this.generation;
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker || this.generation !== generation) return;
      const pending = this.pending.get(data.id);
      if (!pending || data.romEpoch !== pending.romEpoch) return;
      if (data.type === 'progress') { this.onProgress(data); return; }
      if (data.type !== 'error' && data.type !== pending.expected) return;
      this.pending.delete(data.id);
      if (data.type === 'error') pending.reject(new Error(data.message || '照合処理に失敗しました。'));
      else pending.resolve(data);
    };
    worker.onerror = event => {
      if (this.worker !== worker) return;
      const error = new Error(event.message || 'Workerを起動できませんでした。このページをHTTP(S)で開いてください。');
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear(); this.terminate();
    };
    return worker;
  }
  request(message, transfer, expected) {
    const worker = this.createWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(message.id, { resolve, reject, expected, romEpoch: message.romEpoch });
      try { worker.postMessage(message, transfer); } catch (error) { this.pending.delete(message.id); reject(error); }
    });
  }
  async load(file, romEpoch, id) {
    const generation = this.generation;
    if (!file || file.size > LIMITS.romBytes) throw new Error('NDSファイルは512 MiB以下を選択してください。');
    let rom;
    try { rom = await file.arrayBuffer(); }
    catch (error) { if (generation !== this.generation) throw abortError(); throw error; }
    if (generation !== this.generation) throw abortError();
    const reply = await this.request({ type: 'load', id, romEpoch, rom }, [rom], 'loaded');
    if (generation !== this.generation) throw abortError();
    this.loadedRomEpoch = romEpoch;
    return reply.catalog;
  }
  recognize(message) { return this.request(message, [message.crop.rgba.buffer], 'result'); }
  terminate() {
    this.generation++; this.worker?.terminate(); this.worker = null; this.loadedRomEpoch = null;
    for (const pending of this.pending.values()) pending.reject(abortError());
    this.pending.clear();
  }
}

export function mountRecognitionPage(document, window) {
  const $ = id => document.getElementById(id);
  const video = $('source-video'); const view = $('frozen-view'); const viewCtx = view.getContext('2d');
  const frozen = document.createElement('canvas'); const frozenCtx = frozen.getContext('2d', { willReadFrequently: true });
  const cropView = $('crop-preview'); const cropCtx = cropView.getContext('2d');
  const gate = new RequestGate();
  const state = {
    romFile: null, romEpoch: 0, sourceEpoch: 0, sourceId: null, sourceURL: null, sourceKind: null, image: null,
    sourceReady: false, timelineSegment: 0, frameSerial: 0, capture: null, roi: null, catalog: [], selected: new Set(DEFAULT_MODELS),
    busy: false, loading: false, loadPromise: null, lastResult: null, sequence: 0, drag: null, drawMode: true, disposed: false,
  };
  const client = new RecognitionWorkerClient({ onProgress: message => {
    if (!gate.accepts(message)) return;
    if (Number.isFinite(message.total) && message.total > 0) {
      $('progress').max = message.total; $('progress').value = Math.max(0, Math.min(message.done || 0, message.total));
    } else $('progress').removeAttribute('value');
    status(`${message.message || phaseName(message.phase)}${message.total ? ` · ${message.done || 0} / ${message.total}` : ''}`);
  } });
  const nextID = () => `request-${++state.sequence}`;
  function phaseName(phase) { return ({ render: 'モデル画像を生成中', score: '切り抜きと比較中', load: 'NDSを読込中' })[phase] || '照合中'; }
  function status(text) { $('status').textContent = text; }
  function error(text = '') { $('error').textContent = text; $('error').hidden = !text; }
  function selectedIDs() { return [...state.selected].filter(id => state.catalog.some(model => model.modelId === id)); }
  function ready() { const count = selectedIDs().length; return !!state.romFile && !!state.capture && !!state.roi && count > 0 && count <= LIMITS.models; }
  function controls() {
    $('freeze').disabled = !state.sourceReady;
    $('play-pause').disabled = !state.sourceReady || state.sourceKind !== 'video';
    $('video-seek').disabled = !state.sourceReady || !Number.isFinite(video.duration) || video.duration <= 0;
    $('redraw-roi').disabled = !state.capture;
    $('roi-fields').disabled = !state.capture;
    $('start').disabled = !ready() || state.busy || state.loading;
    const canReloadROM = !!state.romFile && !state.loading && !state.busy && !state.catalog.length;
    $('restart').disabled = !(ready() || canReloadROM) || (state.loading && !state.busy);
    $('restart').textContent = canReloadROM ? 'NDSを再読込' : '最初から再照合';
    $('cancel').disabled = !state.busy && !state.loading;
    $('model-filter').disabled = !state.catalog.length;
  }
  function clearResults() {
    state.lastResult = null; $('rankings').replaceChildren(); $('coverage-section').hidden = true; $('result-empty').hidden = false;
    $('result-empty').textContent = '固定した画像の敵を囲み、候補を選んで照合してください。';
    $('result-timing').textContent = '';
    $('unknown-status').textContent = '候補外・判別不能の可能性を常に残します。照合後も、順位だけで種類を確定しないでください。';
  }
  function invalidate(reason, { terminate = state.busy, clear = true } = {}) {
    gate.invalidate();
    if (terminate) { client.terminate(); state.loadPromise = null; state.loading = false; }
    state.busy = false;
    if (clear) clearResults();
    $('progress').max = 1; $('progress').value = 0;
    if (reason) status(reason);
    controls();
  }
  function dropCapture() {
    state.capture = null; state.roi = null; state.drag = null; state.drawMode = true;
    frozen.width = 0; frozen.height = 0; view.width = 640; view.height = 360;
    viewCtx.clearRect(0, 0, view.width, view.height); $('frozen-wrap').classList.add('empty'); $('frozen-placeholder').hidden = false;
    cropView.hidden = true; $('crop-placeholder').hidden = false; $('crop-size').textContent = '範囲を選択してください';
    $('capture-metadata').replaceChildren(); $('capture-help').textContent = '動画の見やすい位置でフリーズするか、画像を開いてください。';
    controls();
  }
  function makeElement(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
  function metadata() {
    const list = $('capture-metadata'); list.replaceChildren();
    if (!state.capture) return;
    const stamp = { ...state.capture, enemyROI: state.roi ? { ...state.roi } : null };
    for (const key of STAMP_KEYS) { list.append(makeElement('dt', key), makeElement('dd', typeof stamp[key] === 'object' ? JSON.stringify(stamp[key]) : String(stamp[key]))); }
  }
  function paint() {
    if (!state.capture) return;
    viewCtx.clearRect(0, 0, view.width, view.height); viewCtx.drawImage(frozen, 0, 0);
    const r = state.roi;
    if (r) {
      const scale = Math.max(1, view.width / Math.max(1, view.getBoundingClientRect().width));
      viewCtx.save(); viewCtx.fillStyle = 'rgba(2, 10, 18, .52)';
      viewCtx.fillRect(0, 0, view.width, r.y); viewCtx.fillRect(0, r.y + r.h, view.width, view.height - r.y - r.h);
      viewCtx.fillRect(0, r.y, r.x, r.h); viewCtx.fillRect(r.x + r.w, r.y, view.width - r.x - r.w, r.h);
      viewCtx.strokeStyle = '#bcffe9'; viewCtx.lineWidth = 2 * scale; viewCtx.strokeRect(r.x, r.y, r.w, r.h);
      viewCtx.fillStyle = '#bcffe9'; viewCtx.fillRect(r.x + r.w - 5 * scale, r.y + r.h - 5 * scale, 10 * scale, 10 * scale);
      viewCtx.restore();
      cropView.width = r.w; cropView.height = r.h; cropCtx.imageSmoothingEnabled = false;
      cropCtx.drawImage(frozen, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      cropView.hidden = false; $('crop-placeholder').hidden = true; $('crop-size').textContent = `${r.w} × ${r.h} px · x ${r.x}, y ${r.y}`;
    }
  }
  function setROI(rect, { invalidateResult = true } = {}) {
    if (!state.capture) return;
    const roi = validateROI(rect, state.capture.sourceFrame);
    if (invalidateResult) invalidate('範囲を変更しました。この切り抜きで照合できます。');
    state.roi = roi;
    for (const key of ['x', 'y', 'w', 'h']) $(`roi-${key}`).value = roi[key];
    state.drawMode = false; $('redraw-roi').textContent = '範囲を描き直す';
    paint(); metadata(); controls();
  }
  function freeze() {
    if (!state.sourceReady) return;
    if (state.sourceKind === 'video' && (video.seeking || video.readyState < 2)) { error('動画の読み込み・シークが終わってからフリーズしてください。'); return; }
    const source = state.sourceKind === 'video' ? video : state.image;
    const width = state.sourceKind === 'video' ? video.videoWidth : state.image.naturalWidth;
    const height = state.sourceKind === 'video' ? video.videoHeight : state.image.naturalHeight;
    if (!width || !height || width > LIMITS.sourceSide || height > LIMITS.sourceSide) { error('固定する元画像は幅・高さとも4096 px以下にしてください。'); return; }
    video.pause(); invalidate(); error();
    frozen.width = width; frozen.height = height; frozenCtx.drawImage(source, 0, 0, width, height);
    view.width = width; view.height = height;
    state.capture = {
      sourceId: state.sourceId, sourceEpoch: state.sourceEpoch, timelineSegment: state.timelineSegment, frameSerial: ++state.frameSerial,
      romEpoch: state.romEpoch, sourceFrame: { width, height }, videoTime: state.sourceKind === 'video' ? video.currentTime : null,
      timestampBasis: state.sourceKind === 'video' ? 'video.currentTime (approximate)' : 'local-image', capturedAt: new Date().toISOString(), enemyROI: null,
    };
    state.roi = null; state.drawMode = true; state.drag = null;
    $('frozen-wrap').classList.remove('empty'); $('frozen-placeholder').hidden = true;
    cropView.hidden = true; $('crop-placeholder').hidden = false; $('crop-size').textContent = '範囲を選択してください';
    $('roi-x').value = 0; $('roi-y').value = 0; $('roi-w').value = Math.min(128, width); $('roi-h').value = Math.min(128, height);
    $('roi-x').max = width - 1; $('roi-y').max = height - 1;
    $('roi-w').max = Math.min(LIMITS.roiSide, width); $('roi-h').max = Math.min(LIMITS.roiSide, height);
    $('capture-help').textContent = `${width} × ${height} pxを固定しました${state.sourceKind === 'video' ? `（動画 ${video.currentTime.toFixed(3)} 秒・概算）` : ''}。動画を動かしても、この画像と切り抜きは変わりません。`;
    $('redraw-roi').textContent = 'ドラッグで範囲を選択';
    paint(); metadata(); controls(); status('固定した画像上で敵を囲むか、数値で範囲を適用してください。');
  }
  function labels(model) {
    const species = (model.speciesCandidates || []).map(item => item.nameJa || item.nameEn || item.idHex || String(item.monsterId));
    return species.length ? species.join(' / ') : '名前未対応';
  }
  function renderCatalog() {
    const list = $('model-list'); list.replaceChildren(); const filter = $('model-filter').value.trim().toLowerCase();
    const models = state.catalog.filter(model => `${model.modelId} ${labels(model)}`.toLowerCase().includes(filter));
    for (const model of models) {
      const label = makeElement('label', undefined, `model-option${state.selected.has(model.modelId) ? ' selected' : ''}`);
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = model.modelId; input.checked = state.selected.has(model.modelId);
      input.addEventListener('change', () => {
        if (input.checked && selectedIDs().length >= LIMITS.models) { input.checked = false; error('モデル候補は最大4種類です。先に別の候補を外してください。'); return; }
        input.checked ? state.selected.add(model.modelId) : state.selected.delete(model.modelId);
        error(); invalidate('候補を変更しました。選択したモデルの範囲だけを再照合します。');
        label.classList.toggle('selected', input.checked); updateSelection();
      });
      const text = makeElement('span', labels(model)); text.append(makeElement('small', model.modelId)); label.append(input, text); list.append(label);
    }
    if (!models.length) list.append(makeElement('p', state.catalog.length ? '一致する候補がありません。' : 'NDSを読み込むと候補が表示されます。', 'muted'));
    updateSelection();
  }
  function updateSelection() {
    const ids = selectedIDs(); $('model-count').textContent = `${ids.length} / ${LIMITS.models}`;
    $('selection-summary').textContent = ids.length ? `選択中: ${ids.join(' / ')} · この範囲外は比較しません。` : '候補を1〜4種類選択してください。';
    controls();
  }
  async function ensureLoaded() {
    if (client.loadedRomEpoch === state.romEpoch) return;
    if (state.loadPromise) return state.loadPromise;
    const file = state.romFile; const epoch = state.romEpoch;
    if (!file) throw new Error('NDSファイルを選択してください。');
    const loadGeneration = client.generation;
    state.loading = true; $('rom-status').textContent = `${file.name} · 読込中`; controls();
    const promise = client.load(file, epoch, nextID()); state.loadPromise = promise;
    try {
      const catalog = await promise;
      if (epoch !== state.romEpoch || loadGeneration !== client.generation || state.disposed) throw abortError();
      state.catalog = Array.isArray(catalog) ? catalog : [];
      state.selected = new Set([...state.selected].filter(id => state.catalog.some(model => model.modelId === id)));
      $('rom-status').textContent = `${file.name} · ${state.catalog.length}モデルを読込済み`;
      renderCatalog();
    } catch (failure) {
      if (epoch === state.romEpoch && loadGeneration === client.generation && failure.name !== 'AbortError') $('rom-status').textContent = `${file.name} · 読込に失敗`;
      throw failure;
    } finally {
      if (state.loadPromise === promise) { state.loadPromise = null; state.loading = false; controls(); }
    }
  }
  async function selectROM() {
    invalidate('', { terminate: true }); state.romEpoch++; state.catalog = []; state.selected = new Set(DEFAULT_MODELS); dropCapture(); error();
    const file = $('rom-file').files?.[0]; state.romFile = null; renderCatalog();
    if (!file) { $('rom-status').textContent = '未選択'; controls(); return; }
    if (file.size > LIMITS.romBytes || file.size === 0) { $('rom-status').textContent = '選択できません'; error('NDSは空でない512 MiB以下のファイルを選択してください。'); controls(); return; }
    state.romFile = file; const epoch = state.romEpoch;
    status('NDSからローカルのモデル一覧を読み込んでいます。');
    try {
      await ensureLoaded();
      if (epoch !== state.romEpoch) return;
      status('NDSの準備ができました。画像を固定して、敵の範囲を選択してください。');
      if (state.sourceReady && state.sourceKind === 'image') freeze();
    } catch (failure) { if (failure.name !== 'AbortError' && epoch === state.romEpoch) { error(failure.message); status('NDSを読み込めませんでした。別のファイルを選択して再試行してください。'); } }
    controls();
  }
  function releaseSource() {
    video.pause(); video.removeAttribute('src'); video.load();
    if (state.image) { state.image.onload = null; state.image.onerror = null; state.image.removeAttribute('src'); }
    state.image = null;
    if (state.sourceURL) URL.revokeObjectURL(state.sourceURL);
    state.sourceURL = null; state.sourceReady = false;
  }
  function selectSource() {
    invalidate('入力ファイルを変更しました。画像を固定し直してください。'); dropCapture(); error(); releaseSource();
    state.sourceEpoch++; state.timelineSegment = 0; state.frameSerial = 0; state.sourceKind = null; state.sourceId = null;
    $('video-area').hidden = true;
    const file = $('source-file').files?.[0];
    if (!file) { $('source-status').textContent = '未選択'; controls(); return; }
    const imageFile = /^image\/(png|jpeg|webp|bmp|gif|avif)$/.test(file.type) || /\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(file.name);
    const videoFile = /^video\//.test(file.type) || /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)$/i.test(file.name);
    if (!imageFile && !videoFile) { error('ブラウザーで再生できる動画、またはPNG / JPEG / WebPなどの画像を選択してください。'); $('source-status').textContent = '未対応のファイル形式'; controls(); return; }
    state.sourceId = `local-${state.sourceEpoch}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    state.sourceURL = URL.createObjectURL(file); const epoch = state.sourceEpoch;
    $('source-status').textContent = `${file.name} · 読込中`;
    if (imageFile) {
      state.sourceKind = 'image'; const img = new window.Image(); state.image = img;
      img.onload = () => {
        if (state.sourceEpoch !== epoch) return;
        if (img.naturalWidth > LIMITS.sourceSide || img.naturalHeight > LIMITS.sourceSide || !img.naturalWidth || !img.naturalHeight) {
          error('画像は幅・高さとも4096 px以下を選択してください。'); $('source-status').textContent = `${file.name} · サイズ上限を超えています`; releaseSource(); controls(); return;
        }
        state.sourceReady = true; $('source-status').textContent = `${file.name} · ${img.naturalWidth} × ${img.naturalHeight} px`; freeze();
      };
      img.onerror = () => { if (state.sourceEpoch === epoch) { error('この画像を読み込めませんでした。別の画像を選択してください。'); releaseSource(); controls(); } };
      img.src = state.sourceURL;
    } else {
      state.sourceKind = 'video'; $('video-area').hidden = false;
      video.onloadeddata = () => {
        if (state.sourceEpoch !== epoch) return;
        state.sourceReady = true; $('source-status').textContent = `${file.name} · ${video.videoWidth} × ${video.videoHeight} px`;
        updateVideoTime(); controls(); status('動画の位置を合わせて「フリーズして範囲を選ぶ」を押してください。');
      };
      video.onerror = () => { if (state.sourceEpoch === epoch && state.sourceKind === 'video' && video.getAttribute('src')) { error('この動画を再生できませんでした。ブラウザー対応形式の動画を選択してください。'); state.sourceReady = false; controls(); } };
      video.src = state.sourceURL; video.load();
    }
    controls();
  }
  function timeText(value) { if (!Number.isFinite(value)) return '--:--'; const minutes = Math.floor(value / 60); return `${minutes}:${String(Math.floor(value % 60)).padStart(2, '0')}`; }
  function updateVideoTime() {
    $('video-time').textContent = `${timeText(video.currentTime)} / ${timeText(video.duration)}`;
    $('video-seek').max = Number.isFinite(video.duration) ? video.duration : 0; $('video-seek').value = video.currentTime || 0;
    $('play-pause').textContent = video.paused ? '再生' : '一時停止';
  }
  function point(event) {
    const rect = view.getBoundingClientRect(); return { x: Math.max(0, Math.min(view.width, (event.clientX - rect.left) * view.width / rect.width)), y: Math.max(0, Math.min(view.height, (event.clientY - rect.top) * view.height / rect.height)) };
  }
  function pointerDown(event) {
    if (!state.capture || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault(); const start = point(event); const r = state.roi; const scale = view.width / Math.max(1, view.getBoundingClientRect().width);
    let mode = 'draw';
    if (r && !state.drawMode && !event.shiftKey) {
      if (Math.abs(start.x - r.x - r.w) < 14 * scale && Math.abs(start.y - r.y - r.h) < 14 * scale) mode = 'resize';
      else if (start.x >= r.x && start.x <= r.x + r.w && start.y >= r.y && start.y <= r.y + r.h) mode = 'move';
    }
    invalidate('範囲を調整中です。'); error(); state.drag = { pointerId: event.pointerId, start, mode, original: r ? { ...r } : null };
    view.setPointerCapture(event.pointerId);
    if (mode === 'draw') setROI(pointerROI(start, start, state.capture.sourceFrame), { invalidateResult: false });
  }
  function pointerMove(event) {
    const drag = state.drag; if (!drag || drag.pointerId !== event.pointerId || !state.capture) return;
    const end = point(event); const frame = state.capture.sourceFrame; let roi;
    if (drag.mode === 'move') {
      roi = { ...drag.original, x: Math.round(Math.max(0, Math.min(frame.width - drag.original.w, drag.original.x + end.x - drag.start.x))), y: Math.round(Math.max(0, Math.min(frame.height - drag.original.h, drag.original.y + end.y - drag.start.y))) };
    } else if (drag.mode === 'resize') {
      roi = { ...drag.original, w: Math.round(Math.max(1, Math.min(LIMITS.roiSide, frame.width - drag.original.x, end.x - drag.original.x))), h: Math.round(Math.max(1, Math.min(LIMITS.roiSide, frame.height - drag.original.y, end.y - drag.original.y))) };
    } else roi = pointerROI(drag.start, end, frame);
    setROI(roi, { invalidateResult: false });
  }
  function pointerEnd(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    if (event.type !== 'pointercancel') pointerMove(event);
    state.drag = null;
    if (view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId);
    status('この切り抜きで照合できます。敵全体が入り、背景が少なくなるよう調整してください。'); controls();
  }
  async function recognize({ restart = false } = {}) {
    if (!ready()) return;
    if (state.busy && !restart) return;
    invalidate('', { terminate: restart || state.busy }); error();
    const id = nextID(); const epoch = state.romEpoch;
    const captureStamp = cloneCaptureStamp({ ...state.capture, enemyROI: { ...state.roi } });
    const modelIds = selectedIDs(); const variant = $('variant').value; const preset = $('preset').value;
    const r = captureStamp.enemyROI; const crop = { width: r.w, height: r.h, rgba: frozenCtx.getImageData(r.x, r.y, r.w, r.h).data };
    gate.begin(id, epoch, captureStamp); state.busy = true; controls(); $('progress').removeAttribute('value');
    status(client.loadedRomEpoch === epoch ? '選択したモデルを照合中です。' : 'NDSを再読込しています。中止後の再開時は最初から準備します。');
    try {
      await ensureLoaded();
      if (!gate.accepts({ id, romEpoch: epoch })) return;
      const message = await client.recognize({ type: 'recognize', id, romEpoch: epoch, captureStamp, crop, modelIds, variant, preset });
      if (!gate.accepts(message)) {
        if (gate.accepts({ id, romEpoch: epoch })) { state.busy = false; error('取得フレーム情報が一致しない結果を破棄しました。再照合してください。'); status('結果は表示していません。'); controls(); }
        return;
      }
      state.busy = false; state.lastResult = message.result; renderResults(); $('progress').max = 1; $('progress').value = 1;
      status('照合が終わりました。表示順位は選択したモデル内の比較結果です。候補外・判別不能の可能性があります。'); controls();
    } catch (failure) {
      if (!gate.accepts({ id, romEpoch: epoch })) return;
      state.busy = false; $('progress').max = 1; $('progress').value = 0; controls();
      if (failure.name !== 'AbortError') { error(failure.message); status('照合を完了できませんでした。候補や探索設定を調整して再試行できます。'); }
    }
  }
  function renderResults() {
    const result = state.lastResult; if (!result) return;
    $('result-empty').hidden = !!result.rankings?.length; $('result-empty').textContent = '比較できる候補がありませんでした。下の比較範囲と制約を確認してください。';
    $('rankings').replaceChildren();
    for (const [index, rank] of (result.rankings || []).slice(0, Number($('top-k').value)).entries()) {
      const card = makeElement('li', undefined, 'rank-card'); const heading = makeElement('header');
      heading.append(makeElement('span', String(index + 1), 'rank-number'), makeElement('h3', rank.modelId)); card.append(heading);
      const thumbnail = rank.thumbnail;
      if (thumbnail?.width > 0 && thumbnail?.height > 0 && thumbnail.width <= 1024 && thumbnail.height <= 1024 && thumbnail.rgba?.length === thumbnail.width * thumbnail.height * 4) {
        const canvas = document.createElement('canvas'); canvas.width = thumbnail.width; canvas.height = thumbnail.height;
        canvas.setAttribute('aria-label', `${rank.modelId}の比較に使った姿勢`);
        const context = canvas.getContext('2d'); const pixels = context.createImageData(thumbnail.width, thumbnail.height); pixels.data.set(thumbnail.rgba); context.putImageData(pixels, 0, 0); card.append(canvas);
      }
      card.append(makeElement('p', labels(rank), 'species'));
      card.append(makeElement('p', `距離 ${Number.isFinite(rank.distance) ? rank.distance.toFixed(4) : '取得できません'}`, 'score'));
      card.append(makeElement('p', '小さいほど近い · 確率ではありません', 'muted'));
      if ((rank.speciesCandidates || []).length > 1) card.append(makeElement('p', '同じモデルに複数の種類が対応しています。モデル順位だけでは種類を区別できません。'));
      const pose = rank.bestPose;
      if (pose) card.append(makeElement('p', `姿勢: ${pose.variant || '通常'} / ${pose.clip || 'bind'} / frame ${pose.frame ?? '—'} / yaw ${pose.yaw ?? '—'} / pitch ${pose.pitch ?? '—'}`, 'pose'));
      $('rankings').append(card);
    }
    const unknown = result.unknown || {};
    $('unknown-status').textContent = `候補外・判別不能を含む未確定の結果です。${unknown.reason ? ` ${unknown.reason}` : ''} 受理判定のしきい値は未検証です。1位でも確定ではありません。`;
    const coverage = result.coverage || {}; const valueText = value => Array.isArray(value) ? `${value.length} (${value.map(item => typeof item === 'object' ? item.modelId || '' : item).join(', ')})` : value ?? '不明';
    $('coverage').textContent = `要求モデル: ${valueText(coverage.requestedModels)} · 比較できたモデル: ${valueText(coverage.completedModels)} · 生成した比較画像: ${coverage.renderedTemplates ?? '不明'}${coverage.scope ? ` · 範囲: ${typeof coverage.scope === 'string' ? coverage.scope : JSON.stringify(coverage.scope)}` : ''}`;
    $('unsupported').replaceChildren(...(coverage.unsupported || []).map(item => makeElement('li', `${item.modelId}: ${item.reason}`)));
    $('limitations').replaceChildren(...['CPUによる実験的な照合です。敵の範囲は手動で指定しています。', '順位は選択したモデルと生成できた姿勢の範囲だけで比較しています。候補外の敵は判別できません。', ...(result.limitations || [])].map(text => makeElement('li', text)));
    const stamp = result.captureStamp;
    $('result-capture').textContent = `固定画像 #${stamp.frameSerial} · ${stamp.videoTime === null ? '画像入力' : `動画 ${stamp.videoTime.toFixed(3)} 秒（概算）`} · 範囲 x ${stamp.enemyROI.x}, y ${stamp.enemyROI.y}, ${stamp.enemyROI.w} × ${stamp.enemyROI.h} px · ${stamp.capturedAt}`;
    $('result-timing').textContent = Number.isFinite(result.elapsedMs) ? `${(result.elapsedMs / 1000).toFixed(1)} 秒` : '';
    $('coverage-section').hidden = false;
  }
  $('rom-file').addEventListener('change', selectROM); $('source-file').addEventListener('change', selectSource); $('freeze').addEventListener('click', freeze);
  $('play-pause').addEventListener('click', async () => { if (!video.paused) video.pause(); else try { await video.play(); } catch (failure) { error(`動画を再生できません: ${failure.message}`); } });
  $('video-seek').addEventListener('input', () => { if (Number.isFinite(video.duration)) video.currentTime = Number($('video-seek').value); });
  for (const event of ['timeupdate', 'durationchange', 'play', 'pause', 'loadedmetadata']) video.addEventListener(event, updateVideoTime);
  video.addEventListener('seeking', () => { state.timelineSegment++; });
  $('redraw-roi').addEventListener('click', () => { state.drawMode = true; $('redraw-roi').textContent = 'ドラッグで新しい範囲を選択'; status('固定した画像上で、新しい範囲をドラッグしてください。'); });
  $('apply-roi').addEventListener('click', () => { try { error(); setROI(Object.fromEntries(['x', 'y', 'w', 'h'].map(key => [key, Number($(`roi-${key}`).value)]))); } catch (failure) { error(failure.message); } });
  for (const key of ['x', 'y', 'w', 'h']) $(`roi-${key}`).addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $('apply-roi').click(); } });
  view.addEventListener('pointerdown', pointerDown); view.addEventListener('pointermove', pointerMove); view.addEventListener('pointerup', pointerEnd); view.addEventListener('pointercancel', pointerEnd);
  $('model-filter').addEventListener('input', renderCatalog);
  for (const id of ['variant', 'preset']) $(id).addEventListener('change', () => invalidate('探索設定を変更しました。同じ切り抜きで再照合できます。'));
  $('top-k').addEventListener('change', renderResults);
  $('start').addEventListener('click', () => recognize());
  $('restart').addEventListener('click', async () => {
    if (ready()) { await recognize({ restart: true }); return; }
    if (!state.romFile || state.loading) return;
    error(); status('保持しているNDSを読み込み直しています。');
    try { await ensureLoaded(); status('NDSの準備ができました。画像を固定して範囲を選択してください。'); }
    catch (failure) { if (failure.name !== 'AbortError') error(failure.message); }
    controls();
  });
  $('cancel').addEventListener('click', () => { invalidate('処理を中止しました。再照合すると、NDSを読み直して最初から実行します。', { terminate: true }); $('rom-status').textContent = state.romFile ? `${state.romFile.name} · 再照合時に再読込` : '未選択'; });
  window.addEventListener('resize', paint);
  window.addEventListener('pagehide', () => { state.disposed = true; gate.invalidate(); client.terminate(); releaseSource(); });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    state.disposed = false; state.loadPromise = null; state.loading = false;
    invalidate('ページに戻りました。入力画像・動画を選び直してください。', { terminate: true }); dropCapture();
    $('source-file').value = ''; $('source-status').textContent = '画像・動画を選び直してください';
  });
  controls();
  return { state, gate, client, freeze, recognize, invalidate, selectROM, selectSource, setROI };
}

if (typeof document !== 'undefined' && document.getElementById('rom-file')) mountRecognitionPage(document, window);
