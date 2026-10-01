/* Local-only experimental UI. The scoring worker owns ROM parsing and rendering. */
import { getFieldExclusion } from './monster-field-mask.mjs';
import { proposeEnemyROIs } from './monster-position-proposals.mjs';
export const LIMITS = Object.freeze({ romBytes: 512 * 1024 * 1024, sourceSide: 4096, roiSide: 1024, models: 4 });
export const DEFAULT_MODELS = Object.freeze(['z019b', 'z021a', 'z064a', 'z000c']);
export const CENTER_MASK = Object.freeze({ x: .42, y: .36, w: .16, h: .24 });
const STAMP_KEYS = ['sourceId', 'sourceEpoch', 'timelineSegment', 'frameSerial', 'romEpoch', 'sourceFrame', 'videoTime', 'timestampBasis', 'capturedAt', 'enemyROI', 'featureMethod', 'inferenceBackend', 'sceneContext'];
const abortError = () => Object.assign(new Error('処理を中止しました。'), { name: 'AbortError' });
const defaultProbeWebGPU = options => import('./monster-dinov2.mjs').then(m => m.probeDinoWebGPU(options));
const defaultClearFeatureCache = () => import('./monster-feature-cache.mjs').then(m => m.createFeatureBankStore().clear());
const defaultEnsureInferenceAssets = async options => (await import('./monster-inference-assets.mjs')).ensureInferenceAssets(options);
const cloneValue = value => value === null || typeof value !== 'object' ? value : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
const sameRect = (left, right) => left === right || !!left && !!right && ['x', 'y', 'w', 'h'].every(key => left[key] === right[key]);

export function gameplayROIForLayout(layout, frame, manual) {
  if (!frame) return null;
  let rect;
  if (layout === 'obs-right-upper') { const x = Math.floor(frame.width / 2); const w = frame.width - x; rect = { x, y: 0, w, h: Math.round(w * 3 / 4) }; }
  else if (layout === 'stacked-lower') { const y = Math.floor(frame.height / 2); rect = { x: 0, y, w: frame.width, h: frame.height - y }; }
  else if (layout === 'manual') rect = manual;
  else rect = { x: 0, y: 0, w: frame.width, h: frame.height };
  if (!rect || !['x', 'y', 'w', 'h'].every(key => Number.isInteger(rect[key])) || rect.x < 0 || rect.y < 0 || rect.w < 1 || rect.h < 1 || rect.x + rect.w > frame.width || rect.y + rect.h > frame.height) throw new Error('ゲーム画面の範囲が元画像からはみ出しています。配置または数値を修正してください。');
  return { ...rect };
}

export function cloneCaptureStamp(stamp) {
  return Object.fromEntries(STAMP_KEYS.map(key => [key, cloneValue(stamp[key])]));
}
export function stampEquals(left, right) {
  if (!left || !right) return false;
  return STAMP_KEYS.every(key => {
    if (key === 'sourceFrame') return left[key]?.width === right[key]?.width && left[key]?.height === right[key]?.height;
    if (key === 'enemyROI') return ['x', 'y', 'w', 'h'].every(axis => left[key]?.[axis] === right[key]?.[axis]);
    if (key === 'sceneContext') return left[key] === right[key] || !!left[key] && !!right[key] && left[key].kind === right[key].kind && left[key].excludeCenter === right[key].excludeCenter && sameRect(left[key].gameplayROI, right[key].gameplayROI) && sameRect(left[key].maskNormalized, right[key].maskNormalized);
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
  supplement(message) { return this.request(message, [message.image.rgba.buffer], 'result'); }
  terminate() {
    this.generation++; this.worker?.terminate(); this.worker = null; this.loadedRomEpoch = null;
    for (const pending of this.pending.values()) pending.reject(abortError());
    this.pending.clear();
  }
}

export function mountRecognitionPage(document, window, { ensureInferenceAssets = defaultEnsureInferenceAssets, probeWebGPU = defaultProbeWebGPU, clearFeatureCache = defaultClearFeatureCache, proposeROIs = proposeEnemyROIs } = {}) {
  const $ = id => document.getElementById(id);
  const video = $('source-video'); const view = $('frozen-view'); const viewCtx = view.getContext('2d');
  const frozen = document.createElement('canvas'); const frozenCtx = frozen.getContext('2d', { willReadFrequently: true });
  const cropView = $('crop-preview'); const cropCtx = cropView.getContext('2d');
  const gate = new RequestGate();
  const state = {
    romFile: null, romEpoch: 0, sourceEpoch: 0, sourceId: null, sourceURL: null, sourceKind: null, image: null,
    sourceReady: false, timelineSegment: 0, frameSerial: 0, capture: null, roi: null, catalog: [], selected: new Set(DEFAULT_MODELS),
    proposalResult: null, selectedProposalId: null, denseStatus: '', denseBusy: false,
    busy: false, loading: false, loadPromise: null, lastResult: null, sequence: 0, drag: null, drawMode: true, disposed: false, assetAbort: null, clearingCache: false,
  };
  const client = new RecognitionWorkerClient({ onProgress: message => {
    if (!gate.accepts(message)) return;
    if (Number.isFinite(message.total) && message.total > 0) {
      $('progress').max = message.total; $('progress').value = Math.max(0, Math.min(message.done || 0, message.total));
    } else $('progress').removeAttribute('value');
    status(`${message.message || phaseName(message.phase)}${message.total ? ` · ${message.done || 0} / ${message.total}` : ''}`);
  } });
  const nextID = () => `request-${++state.sequence}`;
  function phaseName(phase) { return ({ render: 'モデル画像を生成中', score: '切り抜きと比較中', load: 'NDSを読込中', download: '公開AIモデルを準備中', init: 'DINOv2を初期化中', embed: 'DINOv2画像特徴を計算中' })[phase] || '照合中'; }
  function status(text) { $('status').textContent = text; }
  function error(text = '') { $('error').textContent = text; $('error').hidden = !text; }
  function selectedIDs() { return [...state.selected].filter(id => state.catalog.some(model => model.modelId === id)); }
  function featureMethod() { return $('feature-method').value === 'dinov2' ? 'dinov2' : 'histogram'; }
  function inferenceBackend() { return $('inference-backend').value === 'webgpu' ? 'webgpu' : 'wasm'; }
  function gameplayROI() { return gameplayROIForLayout($('gameplay-layout').value, state.capture?.sourceFrame, Object.fromEntries(['x', 'y', 'w', 'h'].map(key => [key, Number($(`gameplay-${key}`).value)]))); }
  function sceneContext() {
    const kind = $('scene-kind').value === 'field' ? 'field' : 'unspecified';
    return { kind, gameplayROI: kind === 'field' ? gameplayROI() : null, excludeCenter: kind === 'field' && !!$('exclude-center').checked, maskNormalized: { ...CENTER_MASK } };
  }
  function currentStamp() { return { ...state.capture, enemyROI: state.roi ? { ...state.roi } : null, featureMethod: featureMethod(), inferenceBackend: inferenceBackend(), sceneContext: sceneContext() }; }
  function configurationIssue() {
    if (featureMethod() === 'dinov2' && ($('variant').value === 'both' || $('preset').value !== 'quick')) return 'DINOv2は単一のモデル種類とクイック探索のみ対応します。設定を選び直してください。';
    try { if (state.capture && $('scene-kind').value === 'field') gameplayROI(); } catch (failure) { return failure.message; }
    return '';
  }
  function ready() { if (state.clearingCache) return false; const count = selectedIDs().length; return !!state.romFile && !!state.capture && !!state.roi && count > 0 && count <= LIMITS.models && !configurationIssue(); }
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
    const dino = featureMethod() === 'dinov2'; $('dino-constraints').hidden = !dino; $('inference-backend-control').hidden = !dino; $('clear-feature-cache').disabled = state.clearingCache;
    $('backend-note').textContent = !dino ? '' : inferenceBackend() === 'webgpu' ? 'WebGPU / FP16: shader-f16対応GPUが必要です。形状など一部の処理はCPUを併用する場合があります。未対応ならCPU/WASMを選択してください。' : 'CPU / WASM・int8: 従来と同じ推論です。保存済みの姿勢特徴は再利用します。';
    $('feature-note').textContent = dino ? 'DINOv2のcosine類似度を比較します。大きいほど近く、確率ではありません。' : '色の分布を比較します。追加のAIモデルはダウンロードしません。';
    const issue = configurationIssue(); $('configuration-error').textContent = issue; $('configuration-error').hidden = !issue;
    $('gameplay-fields').hidden = $('gameplay-layout').value !== 'manual'; $('gameplay-fields').disabled = !state.capture;
    updateSceneView();
    const proposalProblem = proposalIssue();
    $('generate-roi-proposals').disabled = !!proposalProblem || state.busy || state.loading || state.clearingCache;
    if ($('enable-roi-proposals').checked && proposalProblem && !state.proposalResult) $('proposal-status').textContent = proposalProblem;
    $('clear-roi-proposals').disabled = !state.proposalResult;
    const denseProblem = denseIssue();
    $('supplement-roi-proposals').disabled = !!denseProblem || state.busy || state.loading || state.clearingCache;
    $('dense-proposal-note').textContent = state.denseStatus || denseProblem || '任意の補助です。64姿勢を準備・再利用し、固定画像を1回だけ処理します。追加候補にも背景が含まれ、選んだ後の分類時間が別途かかります。';
  }
  function proposalIssue() {
    if (state.disposed) return 'ページを読み直してください。';
    if (!$('enable-roi-proposals').checked) return '領域候補を使う場合は、実験のチェックを入れてください。';
    if (!state.capture) return '先に動画のフレームを固定するか画像を開いてください。';
    try {
      const scene = sceneContext();
      if (scene.kind !== 'field') return 'フィールドであると明示指定してください。';
      if (!scene.excludeCenter) return '領域候補を使うには、上の中央除外を有効にしてください。';
      if (Math.abs(scene.gameplayROI.w / scene.gameplayROI.h - 4 / 3) >= .04) return '4:3のゲーム画面の範囲を指定してください。';
    } catch (failure) { return failure.message; }
    return '';
  }
  function denseIssue() {
    const issue = proposalIssue(); if (issue) return issue;
    if (!proposalsMatchCapture()) return '先にCPUの領域候補を作ってください。';
    if (state.proposalResult.proposals.length >= 8) return 'すでに8候補あるため、DINO補助は実行しません。';
    if (state.proposalResult.denseRevision) return 'この固定画像は補助済みです。再実行する場合はCPU候補を作り直してください。';
    if (!state.romFile) return 'DINO補助にはNDSの読込が必要です。';
    if (featureMethod() !== 'dinov2' || $('preset').value !== 'quick' || $('variant').value !== '_f') return 'DINO補助は「DINOv2」・フィールドモデル（_f）・クイックで使えます。設定は自動変更しません。';
    const ids = selectedIDs(); if (ids.length !== 4 || !DEFAULT_MODELS.every(id => ids.includes(id))) return 'DINO補助には初期の4モデル（z019b / z021a / z064a / z000c）を選択してください。';
    const game = gameplayROI(); if (game.w * 3 !== game.h * 4 || game.w > 1024 || game.h > 1024 || game.w * game.h > 1024 ** 2) return 'DINO補助のゲーム範囲は正確な4:3で各辺1024px以下にしてください。';
    return '';
  }
  async function supplementProposals() {
    if (state.busy || state.loading || state.clearingCache) return;
    const issue = denseIssue(); if (issue) { error(issue); return; }
    const sourceSet = state.proposalResult;
    invalidate(''); error();
    const id = nextID(), epoch = state.romEpoch, captureStamp = cloneCaptureStamp(currentStamp()), backend = captureStamp.inferenceBackend;
    const current = structuredClone({ ...sourceSet, captureStamp }); delete current.trackingFrame;
    // The private frozen canvas owns these bytes; overlays and live video are never sampled.
    let image;
    gate.begin(id, epoch, captureStamp); state.busy = true; state.denseBusy = true; state.denseStatus = 'DINO補助を準備中です。下の中止ボタンで止められます。'; controls();
    const preparation = new AbortController(); state.assetAbort = preparation; const started = performance.now();
    const fresh = () => !preparation.signal.aborted && gate.accepts({ id, romEpoch: epoch }) && state.proposalResult === sourceSet && stampEquals(captureStamp, currentStamp());
    try {
      image = { width: frozen.width, height: frozen.height, rgba: frozenCtx.getImageData(0, 0, frozen.width, frozen.height).data };
      await ensureLoaded(); if (!fresh()) return;
      if (backend === 'webgpu') await probeWebGPU({ signal: preparation.signal }); if (!fresh()) return;
      await ensureInferenceAssets({ backend, signal: preparation.signal, onProgress: progress => {
        if (!fresh()) return;
        const total = progress.total ?? progress.totalBytes, done = progress.done ?? progress.loaded ?? progress.loadedBytes;
        if (Number.isFinite(total) && total > 0) { $('progress').max = total; $('progress').value = Math.min(total, Math.max(0, done || 0)); } else $('progress').removeAttribute('value');
        status(progress.message || phaseName(progress.phase));
      } });
      if (!fresh()) return;
      const message = await client.supplement({ type: 'supplement', id, romEpoch: epoch, captureStamp, current, image, modelIds: [...DEFAULT_MODELS], variant: '_f', preset: 'quick', featureMethod: 'dinov2', inferenceBackend: backend });
      if (!fresh()) return;
      if (!gate.accepts(message)) throw new Error('固定画像情報が一致しない補助候補を破棄しました。');
      const result = message.result, candidates = result.proposals;
      if (!Array.isArray(candidates) || candidates.length > 8 || candidates.length < sourceSet.proposals.length) throw new Error('補助候補の予算が不正です。');
      for (const [i, candidate] of candidates.entries()) {
        validateROI(candidate.roi, captureStamp.sourceFrame);
        if (i < sourceSet.proposals.length && (candidate.proposalId !== sourceSet.proposals[i].proposalId || !sameRect(candidate.roi, sourceSet.proposals[i].roi))) throw new Error('CPU候補の順序または範囲が変わったため破棄しました。');
      }
      state.proposalResult = { ...result, captureStamp }; state.busy = false; state.denseBusy = false;
      const p = result.densePreparation || {}, t = result.denseTimings || {}, added = candidates.length - sourceSet.proposals.length;
      state.denseStatus = `DINO補助 ${added}枠追加・計${candidates.length}/8枠 · 全体${((performance.now()-started)/1000).toFixed(1)}秒 · 姿勢特徴 新規${p.templateCacheMisses ?? 0} / 再利用${p.templateCacheHits ?? 0}（保存から${p.persistentRestored ?? 0}） · 画面パッチ${((t.totalMs || 0)/1000).toFixed(2)}秒。背景候補も増えます。分類は選んだ切り抜きごとに別途実行します。${result.cacheWarnings?.length ? ` 保存キャッシュの注意: ${result.cacheWarnings.join(' ')}` : ''}`;
      $('proposal-status').textContent = `${candidates.length}候補はすべて未確認です。候補を選び、元画像の切り抜きを既存の分類器で照合してください。`;
      renderProposals(); paint(); controls(); $('progress').max = 1; $('progress').value = 1;
      status('固定画像の補助候補を追加しました。敵・種類・出現やATは確定していません。');
    } catch (failure) {
      if (!fresh()) return;
      state.busy = false; state.denseBusy = false; state.denseStatus = 'DINO補助を完了できませんでした。CPU候補は保持しています。';
      client.terminate(); state.loadPromise = null; state.loading = false;
      if (failure.name !== 'AbortError') error(failure.message);
      controls();
    } finally {
      if (state.assetAbort === preparation) state.assetAbort = null;
    }
  }
  function proposalsMatchCapture() {
    if (!state.proposalResult || !state.capture) return false;
    try {
      const saved = state.proposalResult.captureStamp;
      return stampEquals(saved, { ...currentStamp(), enemyROI: saved.enemyROI, featureMethod: saved.featureMethod, inferenceBackend: saved.inferenceBackend });
    } catch { return false; }
  }
  function clearProposals(message = '任意の実験です。手動の範囲指定もそのまま使えます。') {
    state.proposalResult = null; state.selectedProposalId = null; state.denseStatus = '';
    $('roi-proposal-list').replaceChildren(); $('proposal-status').textContent = message;
  }
  function renderProposals() {
    const list = $('roi-proposal-list'); list.replaceChildren();
    if (!proposalsMatchCapture()) return;
    const sourceSet = state.proposalResult;
    for (const [index, proposal] of sourceSet.proposals.entries()) {
      const r = proposal.roi, button = makeElement('button', `候補 ${index + 1} · 未確認`);
      button.type = 'button'; button.disabled = proposal.classificationEligible === false; button.setAttribute('aria-pressed', String(state.selectedProposalId === proposal.proposalId));
      button.setAttribute('data-proposal-id', proposal.proposalId);
      button.append(makeElement('small', `x ${r.x}, y ${r.y} · ${r.w} × ${r.h} px${proposal.classificationEligible === false ? ' · サイズ上限のため未処理（手動で調整）' : ''}`));
      button.addEventListener('click', () => selectProposal(proposal.proposalId, sourceSet)); list.append(button);
    }
  }
  function generateProposals() {
    const issue = proposalIssue();
    if (issue) { error(issue); $('proposal-status').textContent = issue; return; }
    if (state.busy || state.loading || state.clearingCache) return;
    invalidate('', { clearProposalSet: true }); error();
    try {
      const captureStamp = cloneCaptureStamp(currentStamp());
      const image = { width: frozen.width, height: frozen.height, rgba: frozenCtx.getImageData(0, 0, frozen.width, frozen.height).data };
      const result = proposeROIs(image, captureStamp, { profile: 'shrine-blue-v1', excludeCommandHUD: true, maxProposals: 8 });
      if (!stampEquals(result.captureStamp, captureStamp)) throw new Error('領域候補の固定画像情報が一致しないため破棄しました。');
      // Keep over-limit suggestions visible but unprocessed; never allocate their classifier crops.
      const valid = []; let invalidBounds = 0;
      for (const candidate of result.proposals ?? []) {
        const r = candidate.roi, frame = captureStamp.sourceFrame;
        if (!r || !['x','y','w','h'].every(key => Number.isInteger(r[key])) || r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > frame.width || r.y + r.h > frame.height) { invalidBounds++; continue; }
        const classificationEligible = r.w <= LIMITS.roiSide && r.h <= LIMITS.roiSide && r.w * r.h <= LIMITS.roiSide ** 2;
        valid.push({ ...candidate, roi: { ...r }, classificationEligible });
        if (valid.length === 8) break;
      }
      const { trackingFrame, ...summary } = result;
      state.proposalResult = { ...summary, proposals: valid, captureStamp };
      renderProposals(); paint(); controls();
      const milliseconds = Number.isFinite(result.elapsedMs) ? `${result.elapsedMs.toFixed(1)} ms` : '時間不明';
      const unprocessed = valid.filter(p => !p.classificationEligible).length;
      const omittedNote = `${unprocessed ? ` ${unprocessed}件はサイズ上限のため未処理です。手動で範囲を調整してください。` : ''}${invalidBounds ? ` 範囲不正${invalidBounds}件は表示しません。` : ''}`;
      $('proposal-status').textContent = valid.length ? `${valid.length}候補 · CPU領域探索 ${milliseconds}（分類時間は別）。候補を1つ選んでから照合してください。枠は未確認です。${omittedNote}` : `領域候補は0件でした（CPU領域探索 ${milliseconds}）。敵がいない証拠ではありません。手動で範囲を指定できます。`;
      status('固定した画像だけの領域候補を表示しました。分類はまだ行っていません。');
    } catch (failure) {
      clearProposals('領域候補を作れませんでした。手動の範囲指定は使えます。'); error(failure.message); paint(); controls();
    }
  }
  function selectProposal(proposalId, sourceSet = state.proposalResult) {
    if (sourceSet !== state.proposalResult) return;
    if (!proposalsMatchCapture()) { clearProposals('画像や場面が変わりました。領域候補を作り直してください。'); paint(); controls(); return; }
    const proposal = state.proposalResult.proposals.find(item => item.proposalId === proposalId);
    if (!proposal) return;
    if (proposal.classificationEligible === false) { error('この候補はサイズ上限のため未処理です。1024×1024 px以内へ手動で範囲を調整してください。'); return; }
    error(); setROI(proposal.roi, { proposalId });
    $('proposal-status').textContent = `選んだ領域は未確認です。切り抜きを確認し、既存の「この切り抜きを照合」を押してください。`;
    status('領域候補を切り抜きに設定しました。分類はまだ行っていません。');
  }
  function clearResults() {
    state.lastResult = null; $('rankings').replaceChildren(); $('coverage-section').hidden = true; $('result-empty').hidden = false;
    $('result-empty').textContent = '固定した画像の敵を囲み、候補を選んで照合してください。';
    $('result-timing').textContent = '';
    $('unknown-status').textContent = '候補外・判別不能の可能性を常に残します。照合後も、順位だけで種類を確定しないでください。';
  }
  function invalidate(reason, { terminate = state.busy, clear = true, clearProposalSet = false } = {}) {
    gate.invalidate();
    state.assetAbort?.abort(); state.assetAbort = null;
    if (terminate) { client.terminate(); state.loadPromise = null; state.loading = false; }
    state.busy = false; state.denseBusy = false;
    if (state.denseStatus && !state.proposalResult?.denseRevision) state.denseStatus = '';
    if (clear) clearResults();
    if (clearProposalSet) clearProposals();
    $('progress').max = 1; $('progress').value = 0;
    if (reason) status(reason);
    controls();
  }
  function dropCapture() {
    clearProposals();
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
    let stamp; try { stamp = currentStamp(); } catch { stamp = { ...state.capture, enemyROI: state.roi, featureMethod: featureMethod(), inferenceBackend: inferenceBackend(), sceneContext: null }; }
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
    // All scene annotations are drawn on the visible canvas only. Frozen pixels stay untouched.
    try {
      const scene = sceneContext(); const game = gameplayROI(); const scale = Math.max(1, view.width / Math.max(1, view.getBoundingClientRect().width));
      const exclusion = getFieldExclusion(currentStamp(), scene);
      viewCtx.save(); viewCtx.lineWidth = 2 * scale; viewCtx.strokeStyle = '#91b9ee'; viewCtx.strokeRect(game.x, game.y, game.w, game.h);
      if (exclusion.enabled && exclusion.mask) { const mask = exclusion.mask; viewCtx.fillStyle = 'rgba(244, 181, 85, .34)'; viewCtx.fillRect(mask.x, mask.y, mask.w, mask.h); viewCtx.strokeStyle = '#ffc878'; viewCtx.strokeRect(mask.x, mask.y, mask.w, mask.h); }
      viewCtx.restore();
    } catch { /* Invalid manual geometry is explained next to its fields. */ }
    if (proposalsMatchCapture()) {
      const scale = Math.max(1, view.width / Math.max(1, view.getBoundingClientRect().width));
      viewCtx.save(); viewCtx.lineWidth = 2 * scale; viewCtx.font = `${14 * scale}px system-ui`;
      for (const [index, proposal] of state.proposalResult.proposals.entries()) {
        const r = proposal.roi; viewCtx.strokeStyle = state.selectedProposalId === proposal.proposalId ? '#bcffe9' : '#ffc878';
        viewCtx.strokeRect(r.x, r.y, r.w, r.h); viewCtx.fillStyle = viewCtx.strokeStyle;
        viewCtx.fillText(String(index + 1), r.x + 2 * scale, Math.max(16 * scale, r.y - 4 * scale));
      }
      viewCtx.restore();
    }
  }
  function updateSceneView() {
    const field = $('scene-kind').value === 'field';
    $('mask-status').classList.toggle('active', field && !!$('exclude-center').checked);
    if (!state.capture) { $('gameplay-bounds').textContent = '画像を固定するとゲーム範囲を表示します。'; $('mask-status').textContent = '中央除外は、フィールドを明示指定しチェックした場合だけ有効です。'; return; }
    try {
      const game = gameplayROI(); $('gameplay-bounds').textContent = `青枠のゲーム範囲: x ${game.x}, y ${game.y}, ${game.w} × ${game.h} px`;
      const exclusion = getFieldExclusion(currentStamp(), sceneContext());
      $('mask-status').textContent = exclusion.enabled ? `橙色の中央領域は未観測です。${exclusion.excluded ? '現在の敵範囲はここに重なるため、照合せず判別不能として扱います。' : '重なる敵範囲は照合しません。'}` : '中央除外は無効です。フィールドの明示指定とチェックの両方が必要です。';
    } catch (failure) { $('gameplay-bounds').textContent = failure.message; $('mask-status').textContent = 'ゲーム画面の範囲を修正してから中央領域を確認してください。'; }
  }
  function setROI(rect, { invalidateResult = true, proposalId = null } = {}) {
    if (!state.capture) return;
    const roi = validateROI(rect, state.capture.sourceFrame);
    if (invalidateResult) invalidate('範囲を変更しました。この切り抜きで照合できます。');
    state.roi = roi; state.selectedProposalId = proposalId;
    for (const key of ['x', 'y', 'w', 'h']) $(`roi-${key}`).value = roi[key];
    state.drawMode = false; $('redraw-roi').textContent = '範囲を描き直す';
    renderProposals(); paint(); metadata(); controls();
  }
  function freeze() {
    if (!state.sourceReady) return;
    if (state.sourceKind === 'video' && (video.seeking || video.readyState < 2)) { error('動画の読み込み・シークが終わってからフリーズしてください。'); return; }
    const source = state.sourceKind === 'video' ? video : state.image;
    const width = state.sourceKind === 'video' ? video.videoWidth : state.image.naturalWidth;
    const height = state.sourceKind === 'video' ? video.videoHeight : state.image.naturalHeight;
    if (!width || !height || width > LIMITS.sourceSide || height > LIMITS.sourceSide) { error('固定する元画像は幅・高さとも4096 px以下にしてください。'); return; }
    video.pause(); invalidate('', { clearProposalSet: true }); error();
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
    const captureStamp = cloneCaptureStamp(currentStamp());
    const method = captureStamp.featureMethod; const backend = captureStamp.inferenceBackend; const scene = cloneValue(captureStamp.sceneContext);
    const modelIds = selectedIDs(); const variant = $('variant').value; const preset = $('preset').value;
    const r = captureStamp.enemyROI; const crop = { width: r.w, height: r.h, rgba: frozenCtx.getImageData(r.x, r.y, r.w, r.h).data };
    gate.begin(id, epoch, captureStamp); state.busy = true; controls(); $('progress').removeAttribute('value');
    status(client.loadedRomEpoch === epoch ? '選択したモデルを照合中です。' : 'NDSを再読込しています。中止後の再開時は最初から準備します。');
    let preparation = null, assetPreparationMs = 0, assetDownloadMs = 0; const downloadStarts = new Map();
    try {
      await ensureLoaded();
      if (!gate.accepts({ id, romEpoch: epoch })) return;
      if (method === 'dinov2' && !getFieldExclusion(captureStamp, scene).excluded) {
        preparation = new AbortController(); state.assetAbort = preparation;
        const preparationStarted = performance.now();
        if (backend === 'webgpu') await probeWebGPU({ signal: preparation.signal });
        if (preparation.signal.aborted || !gate.accepts({ id, romEpoch: epoch })) return;
        status(`DINOv2 ${backend === 'webgpu' ? 'WebGPU/FP16（初回約66.80 MiB）' : 'CPU/WASM・int8（初回約34.75 MiB）'}の公開ファイルを準備しています。`);
        await ensureInferenceAssets({ backend, signal: preparation.signal, onProgress: progress => {
          if (preparation.signal.aborted || !gate.accepts({ id, romEpoch: epoch })) return;
          if (progress.phase === 'download' && !downloadStarts.has(progress.assetId)) downloadStarts.set(progress.assetId, performance.now());
          if (progress.phase === 'verified' && downloadStarts.has(progress.assetId)) { assetDownloadMs += performance.now() - downloadStarts.get(progress.assetId); downloadStarts.delete(progress.assetId); }
          const total = progress.total ?? progress.totalBytes; const done = progress.done ?? progress.loaded ?? progress.loadedBytes;
          if (Number.isFinite(total) && total > 0) { $('progress').max = total; $('progress').value = Math.min(total, Math.max(0, done || 0)); } else $('progress').removeAttribute('value');
          status(progress.message || phaseName(progress.phase || 'download'));
        } });
        if (preparation.signal.aborted || !gate.accepts({ id, romEpoch: epoch })) return;
        assetPreparationMs = performance.now() - preparationStarted;
      }
      const message = await client.recognize({ type: 'recognize', id, romEpoch: epoch, captureStamp, crop, modelIds, variant, preset, featureMethod: method, inferenceBackend: backend, sceneContext: scene });
      if (!gate.accepts(message)) {
        if (gate.accepts({ id, romEpoch: epoch })) { state.busy = false; error('取得フレーム情報が一致しない結果を破棄しました。再照合してください。'); status('結果は表示していません。'); controls(); }
        return;
      }
      state.busy = false; state.lastResult = { ...message.result, timings: { ...message.result.timings, assetPreparationMs, assetDownloadMs } }; renderResults(); $('progress').max = 1; $('progress').value = 1;
      status(message.result.skipped === 'central-field-exclusion' ? '中央除外領域に重なるため未観測として扱いました。敵がいないという判定ではありません。' : '照合が終わりました。表示順位は選択したモデル内の比較結果です。候補外・判別不能の可能性があります。'); controls();
    } catch (failure) {
      if (!gate.accepts({ id, romEpoch: epoch })) return;
      state.busy = false; $('progress').max = 1; $('progress').value = 0; controls();
      if (failure.name !== 'AbortError') { if (method === 'dinov2') { client.terminate(); state.loadPromise = null; state.loading = false; } error(failure.message); status(method === 'dinov2' ? 'DINOv2の準備または照合に失敗しました。再試行するか、実行方式で「CPU/WASM」、比較方法で「色ヒストグラム」を明示的に選択できます。方法は自動変更していません。' : '照合を完了できませんでした。候補や探索設定を調整して再試行できます。'); }
    } finally {
      if (state.assetAbort === preparation) state.assetAbort = null;
    }
  }
  function renderResults() {
    const result = state.lastResult; if (!result) return;
    const skipped = result.skipped === 'central-field-exclusion'; const dino = result.featureMethod === 'dinov2' || result.captureStamp.featureMethod === 'dinov2';
    $('result-empty').hidden = !!result.rankings?.length; $('result-empty').textContent = skipped ? '中央除外領域に重なるため、この範囲の特徴を計算していません。未観測として扱います。' : '比較できる候補がありませんでした。下の比較範囲と制約を確認してください。';
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
      const cosine = result.metric === 'cosine' || dino;
      card.append(makeElement('p', cosine ? `cosine類似度 ${Number.isFinite(rank.similarity) ? rank.similarity.toFixed(4) : '取得できません'}` : `距離 ${Number.isFinite(rank.distance) ? rank.distance.toFixed(4) : '取得できません'}`, 'score'));
      card.append(makeElement('p', `${cosine ? '大きいほど近い' : '小さいほど近い'} · 確率ではありません`, 'muted'));
      if ((rank.speciesCandidates || []).length > 1) card.append(makeElement('p', '同じモデルに複数の種類が対応しています。モデル順位だけでは種類を区別できません。'));
      const pose = rank.bestPose;
      if (pose) card.append(makeElement('p', `姿勢: ${pose.variant || '通常'} / ${pose.clip || 'bind'} / frame ${pose.frame ?? '—'} / yaw ${pose.yaw ?? '—'} / pitch ${pose.pitch ?? '—'}`, 'pose'));
      $('rankings').append(card);
    }
    const unknown = result.unknown || {};
    $('unknown-status').textContent = skipped ? `中央除外による未観測・判別不能です。${unknown.reason ? ` ${unknown.reason}` : ''} 敵がいないことや候補が違うことの根拠にはなりません。候補外の可能性も残ります。` : `候補外・判別不能を含む未確定の結果です。${unknown.reason ? ` ${unknown.reason}` : ''} 受理判定のしきい値は未検証です。1位でも確定ではありません。`;
    const coverage = result.coverage || {}; const valueText = value => Array.isArray(value) ? `${value.length} (${value.map(item => typeof item === 'object' ? item.modelId || '' : item).join(', ')})` : value ?? '不明';
    $('coverage').textContent = `比較方法: ${dino ? 'DINOv2画像特徴（cosine類似度）' : '色ヒストグラム（距離）'} · 要求モデル: ${valueText(coverage.requestedModels)} · 比較できたモデル: ${valueText(coverage.completedModels)} · 生成した比較画像: ${coverage.renderedTemplates ?? '不明'}${coverage.scope ? ` · 範囲: ${typeof coverage.scope === 'string' ? coverage.scope : JSON.stringify(coverage.scope)}` : ''}`;
    $('unsupported').replaceChildren(...(coverage.unsupported || []).map(item => makeElement('li', `${item.modelId}: ${item.reason}`)));
    $('limitations').replaceChildren(...[state.selectedProposalId ? '端末内で行う実験的な照合です。未確認の領域候補を選び、元画像の切り抜きを比較しています。' : '端末内で行う実験的な照合です。敵の範囲は手動で指定しています。', '順位は選択したモデルと生成できた姿勢の範囲だけで比較しています。候補外の敵は判別できません。', ...(result.cacheWarnings || []), ...(result.limitations || [])].map(text => makeElement('li', text)));
    const stamp = result.captureStamp;
    $('result-capture').textContent = `固定画像 #${stamp.frameSerial} · ${stamp.videoTime === null ? '画像入力' : `動画 ${stamp.videoTime.toFixed(3)} 秒（概算）`} · 範囲 x ${stamp.enemyROI.x}, y ${stamp.enemyROI.y}, ${stamp.enemyROI.w} × ${stamp.enemyROI.h} px · ${stamp.capturedAt}`;
    const t = result.timings || {}; const seconds = n => `${((Number(n) || 0) / 1000).toFixed(1)}秒`;
    $('result-timing').textContent = dino && !skipped ? `${result.inference?.backend === 'webgpu' ? 'WebGPU/FP16' : 'CPU/WASM・int8'} · 公開ファイル準備${seconds(t.assetPreparationMs)}（取得・検証${seconds(t.assetDownloadMs)}） · 初期化${seconds(t.backendInitMs)} · 姿勢特徴${seconds(t.templateEmbeddingMs)}（新規${t.templateCacheMisses ?? '不明'} / 再利用${t.templateCacheHits ?? '不明'}、保存から${t.persistentRestored ?? 0}） · 切り抜き${seconds(t.queryMs)} · 照合全体${seconds(result.elapsedMs)}` : Number.isFinite(result.elapsedMs) ? seconds(result.elapsedMs) : '';
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
  function configurationChanged(clearProposalSet = false) { invalidate('比較方法・場面・探索設定を変更しました。表示した範囲と設定を確認して再照合してください。', { clearProposalSet }); error(); paint(); metadata(); }
  for (const id of ['variant', 'preset', 'feature-method']) $(id).addEventListener('change', () => configurationChanged());
  for (const id of ['scene-kind', 'gameplay-layout', 'exclude-center']) $(id).addEventListener('change', () => configurationChanged(true));
  $('inference-backend').addEventListener('change', () => { invalidate('AIの実行方式を変更しました。再照合時に専用Workerを読み直します。', { terminate: true }); error(); paint(); metadata(); });
  for (const key of ['x', 'y', 'w', 'h']) $(`gameplay-${key}`).addEventListener('input', () => configurationChanged(true));
  $('clear-feature-cache').addEventListener('click', async () => {
    if (state.clearingCache) return; invalidate('保存した姿勢特徴を消去しています。', { terminate: true }); error(); state.clearingCache = true; const revision = gate.revision; controls();
    try { await clearFeatureCache(); if (revision === gate.revision) status('保存した姿勢特徴を消去しました。次の照合では要求したバンクを再生成します。公開AIファイルのキャッシュは保持します。'); }
    catch (failure) { if (revision === gate.revision) error(`姿勢特徴を消去できませんでした: ${failure.message}`); }
    finally { state.clearingCache = false; controls(); }
  });
  $('enable-roi-proposals').addEventListener('change', () => { invalidate('', { clearProposalSet: true }); error(); paint(); controls(); if ($('enable-roi-proposals').checked) $('proposal-status').textContent = proposalIssue() || '固定画像の領域候補を探せます。分類は候補を選んでから実行します。'; });
  $('generate-roi-proposals').addEventListener('click', generateProposals);
  $('supplement-roi-proposals').addEventListener('click', supplementProposals);
  $('clear-roi-proposals').addEventListener('click', () => { if (state.denseBusy) invalidate('', { clear: false }); clearProposals('候補の枠を消しました。選択済みの切り抜きは手動で調整できます。'); paint(); controls(); });
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
  window.addEventListener('pagehide', () => { state.disposed = true; clearProposals(); gate.invalidate(); state.assetAbort?.abort(); state.assetAbort = null; client.terminate(); releaseSource(); });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    state.disposed = false; state.loadPromise = null; state.loading = false;
    invalidate('ページに戻りました。入力画像・動画を選び直してください。', { terminate: true }); dropCapture();
    $('source-file').value = ''; $('source-status').textContent = '画像・動画を選び直してください';
  });
  controls();
  return { state, gate, client, freeze, recognize, invalidate, selectROM, selectSource, setROI, generateProposals, selectProposal, supplementProposals };
}

if (typeof document !== 'undefined' && document.getElementById('rom-file')) mountRecognitionPage(document, window);
