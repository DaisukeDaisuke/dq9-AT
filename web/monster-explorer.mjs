import {MapProject, MapRenderer} from './map-core.mjs';
import {Narc} from './vendor/narc-source.js';
import {preferredNodeTrigFromRom, fieldNativeFacing} from './field-preferred-node.mjs';
import {monsterCol2FromRom} from './monster-terrain.mjs';
import {MonsterMovementKernel} from './monster-movement.mjs?v=motion-closure-20261008-89e290ef';
import {projectMonsterOuterReset} from './monster-lifecycle.mjs';
import {ATKernel, parseSeed} from './at-core.mjs';
import {FieldATKernel} from './field-at.mjs';
import {markerCoordinateBinding} from './map-marker-coordinate.mjs';
import {setupFirstSpawnPanel} from './first-spawn-panel.mjs?v=field-source-preparation-20261006-1806';

export const EXPLORER_SCHEMA = 'dq9-monster-explorer-initial-config-v1';
const PROFILE = 'hypothetical-state2-7402-v1';
const WORLD = 4096;
const SPEEDS = [0, 154, 230, 450];
const hex = value => '0x' + (value >>> 0).toString(16).padStart(8, '0');
const copy = value => structuredClone(value);
function integer(value, min, max, label) {
 if (!Number.isInteger(value) || value < min || value > max) throw Error(`${label}: ${min}..${max} の整数が必要です`);
 return value;
}
function vector(value, label) {
 if (!Array.isArray(value) || value.length !== 3 || ![0,1,2].every(i => Object.hasOwn(value, i))) throw Error(`${label}: XYZ 3値が必要です`);
 return value.map(v => integer(v, -2147483648, 2147483647, label));
}
function exactKeys(value, keys, label) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(value, k))) throw Error(`${label}: このページの初期設定形式のみ対応しています`);
}
/** Import only editable initial conditions. Never accept native snapshots, expected
 * outputs, a future actor sequence, ROM arrays or post-step corrections. */
export function validateExplorerConfig(input, graph) {
 const keys = ['schema','profile','mapId','startNodeIndex','targetNodeIndex','xyz','angle','seed','speedMode','turnRate','width','height','stateTimer','activeElapsed','updateCounter','clock','controllerFlags','worldKind','scriptMode','detectionMode','parties','noOtherActors','animationType1','anchorMode','anchors','terrainMembers','sceneComplete','declaredHypothesis'];
 exactKeys(input, keys, '設定');
 if (input.schema !== EXPLORER_SCHEMA || input.profile !== PROFILE || input.mapId !== 7402) throw Error('7402の仮想state2 profile設定のみ対応しています');
 const c = copy(input);
 integer(c.startNodeIndex, 0, 65535, '開始ノード'); integer(c.targetNodeIndex, 0, 65535, '目標ノード');
 if (graph && (!graph.nodes?.[c.startNodeIndex]?.neighbors?.includes(c.targetNodeIndex) || !graph.nodes?.[c.targetNodeIndex])) throw Error('選択したROMグラフの隣接辺を指定してください');
 c.xyz = vector(c.xyz, '初期XYZ');
 integer(c.angle, 0, 25736, '実向き'); integer(c.seed, 0, 0xffffffff, 'seed');
 integer(c.speedMode, 1, 3, '速度モード'); integer(c.turnRate, 0, 32767, '回転速度');
 for (const k of ['width','height']) integer(c[k], 1, 65536, k);
 for (const k of ['stateTimer','activeElapsed','updateCounter','controllerFlags']) integer(c[k], 0, 0xffffffff, k);
 exactKeys(c.clock, ['phase','scaledDelta'], 'clock');
 integer(c.clock.phase, 0, 65535, 'phase'); integer(c.clock.scaledDelta, 0, 65535, 'scaledDelta');
 integer(c.worldKind, -2147483648, 2147483647, 'worldKind'); integer(c.scriptMode, 0, 255, 'scriptMode');
 if (![0,3].includes(c.detectionMode)) throw Error('検知mode 0 / 3のみ対応しています');
 if (!Array.isArray(c.parties) || c.parties.length !== 4) throw Error('party 0..3の全状態が必要です');
 c.parties = Array.from(c.parties, (p, i) => { exactKeys(p, ['mode','xyz'], `party ${i}`); if (!['present','absent','unknown'].includes(p.mode)) throw Error('partyの存在状態が不正です'); return {mode:p.mode, xyz:vector(p.xyz, `party ${i}`)}; });
 if (!['unknown','none','specified'].includes(c.anchorMode) || !Array.isArray(c.anchors) || c.anchors.length > 4 || (c.anchorMode === 'none' && c.anchors.length)) throw Error('anchor状態・件数が不正です');
 c.anchors = Array.from(c.anchors, (a, i) => vector(a, `anchor ${i}`));
 if (!Array.isArray(c.terrainMembers) || c.terrainMembers.length > 16 || new Set(c.terrainMembers).size !== c.terrainMembers.length || c.terrainMembers.some(n => typeof n !== 'string' || !/^[-A-Za-z0-9_]+\.col2$/.test(n))) throw Error('重複のないROM COL2名を16件以内で指定してください');
 for (const k of ['noOtherActors','animationType1','sceneComplete','declaredHypothesis']) if (typeof c[k] !== 'boolean') throw Error(`${k}: 明示したtrue / falseが必要です`);
 return c;
}
export function defaultExplorerConfig(graph) {
 const startNodeIndex = graph?.nodes?.findIndex(n => n.neighbors?.length) ?? -1;
 if (startNodeIndex < 0) throw Error('隣接辺のあるROMグラフが必要です');
 const xyz = graph.nodes[startNodeIndex].position.map(x => x * WORLD);
 return validateExplorerConfig({schema:EXPLORER_SCHEMA, profile:PROFILE, mapId:7402, startNodeIndex, targetNodeIndex:graph.nodes[startNodeIndex].neighbors[0], xyz, angle:0, seed:1, speedMode:2, turnRate:808, width:4096, height:4096, stateTimer:0, activeElapsed:0, updateCounter:0, clock:{phase:2, scaledDelta:33}, controllerFlags:0, worldKind:-1, scriptMode:0, detectionMode:3, parties:[{mode:'present',xyz:[xyz[0]+8*WORLD,xyz[1],xyz[2]]},...Array.from({length:3}, () => ({mode:'absent',xyz:[0,0,0]}))], noOtherActors:false, animationType1:false, anchorMode:'unknown', anchors:[], terrainMembers:[], sceneComplete:false, declaredHypothesis:false}, graph);
}
export function explorerTerrain(config, resources) {
 if (!config.sceneComplete) return null;
 const objects = config.terrainMembers.map(memberName => {
  const resource = resources.get(memberName);
  if (!resource) throw Error(`選択COL2が未読込です: ${memberName}`);
  // This binds a chosen resource to a declared hypothetical object, NOT to a
  // measured runtime object's pointer, existence or place in native order.
  return {resource, resourcePresent:true, resourceBindingVerified:true, flags:0, ancestorChainComplete:true, ancestorFlags:[], position:[0,0,0], extraMin:[0,0,0], extraMax:[0,0,0], resourceOrigin:[0,0,0], transformShort06:0};
 });
 return {mapId:7402, mapAux444:0, nonTiledMode:0, objectListComplete:true, objects};
}
export function createExplorerProfile({config, graph, tableRows, resources, kernel}) {
 const c = validateExplorerConfig(config, graph);
 if (!c.declaredHypothesis) throw Error('仮想テスト構成としての実行を明示してください');
 if (!Array.isArray(tableRows) || !tableRows.length || !tableRows.every(r => Number.isInteger(r.tableId) && Number.isInteger(r.flags)) || new Set(tableRows.map(r => r.tableId)).size !== 1) throw Error('7402の単一ROM table bindingが必要です');
 const target = graph.nodes[c.targetNodeIndex], targetXYZ = vector(target.position.map(x => x * WORLD), 'ROM目標XYZ');
 const steering = kernel.state2EntrySteering(c.xyz, targetXYZ);
 if (!steering.resolved || steering.steeringDistance < WORLD) throw Error(steering.reason || '開始位置と目標の距離を1 world以上にしてください');
 const identity = {generationId:'hypothetical:one-actor', pointer:1, slot:112}; // Model handles, never RAM addresses.
 const actor = {xyz:[...c.xyz], angle:c.angle, targetAngle:steering.targetAngle, turnRate:c.turnRate, speed:SPEEDS[c.speedMode], targetSpeed:SPEEDS[c.speedMode], speedMode:c.speedMode, acceleration:40, movementByte:1, header:35, actorFlags:132, state:2, previousState:1, routeMode:1, routeFlags:64, e0:0, c1:0, c2:0, delayWord:0, gravity:0, verticalVelocity:0, verticalLimit:0, verticalCounter:0, correctionSpeed:0, cooldownByte:0, alertFlag:0, blockFlag:0, field17a:0, animationClass:1, animationEventIndex:65535, detectionMode:c.detectionMode, mapId:7402, tableId:tableRows[0].tableId, registryIndex:112, species:1, width:c.width, height:c.height, stateTimer:c.stateTimer, activeElapsed:c.activeElapsed, updateCounter:c.updateCounter, currentSeed:c.seed, currentNodeIndex:c.targetNodeIndex, targetNodeId:target.id, targetXYZ};
 const parties = c.parties.map((p, slot) => p.mode === 'unknown' ? {slot,registryKnown:false} : p.mode === 'absent' ? {slot,registryKnown:true,pointer:0} : {slot,registryKnown:true,pointer:slot+2,headerFlags:0x802,mapId:7402,xyz:[...p.xyz]});
 const slots = Array.from({length:12}, (_,i) => i === 0 ? {slot:112,registryKnown:true,pointer:1,generationId:identity.generationId,headerFlags:35,actorFlags:132,nodeIndex:actor.currentNodeIndex} : c.noOtherActors ? {slot:112+i,registryKnown:true,pointer:0} : {slot:112+i,registryKnown:false});
 const terrain = explorerTerrain(c, resources);
 const context = {tickReached:true,globalWord:0,clock:c.clock,parties,animationComponents:{complete:c.animationType1,records:c.animationType1?[{typeWord:1}]:[]},fieldPresent:true,fieldMapId:7402,graphBindingVerified:true,tableBindingVerified:true,graph,tableRows,fieldFlags:4,inventory:{slots},terrain};
 const lifetimeContext = {afterTickReached:true,globalWord:0,fieldGroupFlags:4,groupIndex:0,managerMapId:7402,identity,typedMonsterLookup:{known:true,pointer:1,generationId:identity.generationId},parties};
 const groundContext = {ordinaryPassReached:true,globalWord:0,controllerFlags:c.controllerFlags,worldKind:c.worldKind,scriptMode:c.scriptMode,identity,typedMonsterLookup:{known:true,pointer:1,generationId:identity.generationId},selectedHero:c.parties[0].mode === 'present' ? {registryKnown:true,pointer:2,mapId:7402,flagsKnownMask:0x08000000,flagsKnownValue:0} : {registryKnown:c.parties[0].mode === 'absent',pointer:0},managerMapId:7402,terrain,callParameters:[0,0,0,0,0],anchorsComplete:c.anchorMode !== 'unknown',anchorCount:c.anchors.length,anchors:c.anchors.map((xyz,index) => ({index,xyz:[...xyz]}))};
 return {config:c,actor,context,lifetimeContext,groundContext};
}
/** The view's only advancing operation. Accept model results phase by phase,
 * retain the last resolved pose at a blocked phase, and terminate on reset at
 * lastXYZ rather than drawing the reset pool object's zero coordinate. */
export class ExplorerSession {
 constructor(profile, kernel, fieldKernel, atKernel, lifetime = projectMonsterOuterReset) {
  this.profile = profile; this.kernel = kernel; this.fieldKernel = fieldKernel; this.atKernel = atKernel; this.lifetime = lifetime;
  this.actor = copy(profile.actor); this.seedPrefix = this.actor.currentSeed; this.ownedAT = 0; this.externalAT = 0; this.aiCalls = 0; this.stopped = false; this.reason = ''; this.events = []; this.trace = [];
  this.record('初期化', 0);
 }
 record(stage, delta = 0) {
  const event = {sequence:this.events.length,stage,xyz:[...this.actor.xyz],angle:this.actor.angle,state:this.actor.state,nodeIndex:this.actor.currentNodeIndex,seed:this.seedPrefix,ownedDelta:delta,ownedAT:this.ownedAT,externalAT:this.externalAT};
  this.events.push(event);
  if (!this.trace.length || this.trace.at(-1).some((n,i) => n !== event.xyz[i])) this.trace.push([...event.xyz]);
  return event;
 }
 stop(stage, result) {
  const minimum = Number.isInteger(result?.minimumATConsumed) && result.minimumATConsumed > 0 ? result.minimumATConsumed : 0;
  if (minimum) { this.seedPrefix = this.atKernel.seedAt(this.seedPrefix, BigInt(minimum)); this.ownedAT += minimum; }
  this.stopped = true; this.reason = `${stage}: ${result?.reason || '未解決入力'}`;
  this.record(`${stage} 未解決停止`, minimum);
  return false;
 }
 accept(result, stage) {
  if (!result?.resolved || !result.nextState) return this.stop(stage, result);
  const consumed = result.atConsumed;
  if (!Number.isInteger(consumed) || consumed < 0) return this.stop(stage, {reason:'モデルがAT消費を確定していません'});
  this.actor = copy(result.nextState); this.seedPrefix = this.actor.currentSeed; this.ownedAT += consumed;
  const own = this.profile.context.inventory.slots[0]; own.nodeIndex = this.actor.currentNodeIndex; own.actorFlags = this.actor.actorFlags; own.headerFlags = this.actor.header;
  this.record(stage, consumed);
  return true;
 }
 advance(kind) {
  if (this.stopped) return false;
  if (this.events.length >= 10000) return this.stop('実験上限', {reason:'10000段階に到達。新しい初期設定で別実験にしてください'});
  if (kind === 'ai') {
   const result = this.kernel.step(this.actor, this.profile.context, this.fieldKernel);
   if (!this.accept(result, 'AI')) return false;
   this.aiCalls++; return true;
  }
  if (kind === 'ground') return this.accept(this.kernel.walkingPass(this.actor, this.profile.groundContext), '接地');
  if (kind === 'life') {
   const result = this.lifetime(this.actor, this.profile.lifetimeContext);
   if (!result.resolved) return this.stop('寿命', result);
   if (result.outcome === 'reset-deactivate') {
    if (!result.resetProjectionResolved || !result.lifetimeEvent?.lastXYZ) return this.stop('寿命', {reason:'reset投影が不完全です'});
    this.actor.xyz = [...result.lifetimeEvent.lastXYZ];
    this.stopped = true; this.reason = 'reset-deactivate: このactorの寿命終了。最後の位置で軌跡を終了しました';
    this.record('寿命終了'); return false;
   }
   this.record('寿命保持'); return true;
  }
  if (kind === 'cycle') return this.advance('ai') && this.advance('life') && this.advance('ground');
  throw Error('Unknown explorer operation');
 }
 external(count) {
  if (this.stopped) return false;
  integer(count, 1, 100000, '外部AT回数');
  this.seedPrefix = this.atKernel.seedAt(this.seedPrefix, BigInt(count)); this.actor.currentSeed = this.seedPrefix; this.externalAT += count;
  this.record(`外部AT +${count}`); return true;
 }
}
export function explorerMapTransform(image, width, height) {
 const unit = image?.descriptor?.worldToMapScale, origin = image?.originPixel;
 if (!Number.isFinite(unit) || unit <= 0 || !Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite) || !(image.width > 0 && image.height > 0 && width > 0 && height > 0)) return null;
 const fit = Math.min(width / image.width, height / image.height), ox = (width - image.width * fit) / 2, oz = (height - image.height * fit) / 2;
 return {scale:unit * fit,x:ox - origin[0] * fit,z:oz - origin[1] * fit,fit,ox,oz};
}

if (typeof document !== 'undefined' && document.getElementById('config')) setupExplorer();
function setupExplorer() {
 const $ = id => document.getElementById(id), canvas = $('map'), ctx = canvas.getContext('2d');
 let project = null, graph = null, record = null, image = null, background = null, rom = null, trig = null, model = null, fieldKernel = null, atKernel = null, session = null, config = null, resources = new Map(), replayMaps = new Map(), imageRenderer = null, resourceNames = [], epoch = 0, importSequence = 0, dirty = false, busy = false;
 const firstSpawn = setupFirstSpawnPanel({document,getInputs:()=>({project,rom,kernel:model,fieldKernel,atKernel}),redraw:()=>draw()});
 const integerIds = {'angle':'angle','speed-mode':'speedMode','turn-rate':'turnRate','width':'width','height':'height','state-timer':'stateTimer','active-elapsed':'activeElapsed','update-counter':'updateCounter','world-kind':'worldKind','script-mode':'scriptMode','detection':'detectionMode'};
 const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
 const run = fn => { try { fn(); } catch (e) { status(e.message, true); } };
 const readNumber = id => { if ($(id).value.trim() === '') throw Error(`${id}: 未入力です`); return Number($(id).value); };
 const changed = () => { if (session) dirty = true; firstSpawn.controlsChanged(); update(); draw(); };
 function readConfig() {
  if (!config) throw Error('NDSを先に読み込んでください');
  const c = copy(config);
  c.startNodeIndex = Number($('start-node').value); c.targetNodeIndex = Number($('target-node').value);
  c.xyz = ['x','y','z'].map(id => Math.round(readNumber(id) * WORLD));
  c.seed = parseSeed($('seed').value); c.controllerFlags = parseSeed($('controller-flags').value);
  for (const [id,key] of Object.entries(integerIds)) c[key] = readNumber(id);
  c.clock = {phase:readNumber('phase'),scaledDelta:readNumber('delta')};
  c.noOtherActors = $('no-other-actors').checked; c.animationType1 = $('animation-type1').checked;
  c.sceneComplete = $('scene-complete').checked; c.declaredHypothesis = $('declared').checked;
  c.anchorMode = $('anchor-mode').value;
  return validateExplorerConfig(c, graph);
 }
 function applyConfig(c) {
  config = validateExplorerConfig(c, graph);
  $('start-node').value = config.startNodeIndex; targets(); $('target-node').value = config.targetNodeIndex;
  ['x','y','z'].forEach((id,i) => $(id).value = config.xyz[i] / WORLD);
  for (const [id,key] of Object.entries(integerIds)) $(id).value = config[key];
  $('seed').value = hex(config.seed); $('controller-flags').value = hex(config.controllerFlags);
  $('phase').value = config.clock.phase; $('delta').value = config.clock.scaledDelta;
  $('no-other-actors').checked = config.noOtherActors; $('animation-type1').checked = config.animationType1;
  $('scene-complete').checked = config.sceneComplete; $('declared').checked = config.declaredHypothesis; $('anchor-mode').value = config.anchorMode;
  renderParties(); renderAnchors(); renderObjects(); changed();
 }
 function targets() {
  const node = graph?.nodes[Number($('start-node').value)];
  $('target-node').replaceChildren(...(node?.neighbors ?? []).map(i => new Option(`index ${i} / ID ${graph.nodes[i].id}`, i)));
 }
 function renderParties() {
  $('parties').replaceChildren();
  config.parties.forEach((p, i) => {
   const row = document.createElement('div'); row.className = 'party';
   const label = document.createElement('label'); label.textContent = `party ${i}`;
   const select = document.createElement('select'); for (const [value,text] of [['present','存在する仮説'],['absent','不在という仮説'],['unknown','不明']]) select.add(new Option(text,value)); select.value = p.mode;
   select.onchange = () => { p.mode = select.value; renderParties(); changed(); }; label.append(select); row.append(label);
   const coords = document.createElement('div'); coords.className = 'grid3';
   ['X','Y','Z'].forEach((axis,j) => { const l = document.createElement('label'); l.textContent = axis; const input = document.createElement('input'); input.type = 'number'; input.step = '0.000244140625'; input.value = p.xyz[j]/WORLD; input.disabled = p.mode !== 'present'; input.onchange = () => { p.xyz[j] = input.value.trim() === '' ? NaN : Math.round(Number(input.value)*WORLD); changed(); }; l.append(input); coords.append(l); });
   row.append(coords); $('parties').append(row);
  });
 }
 function renderAnchors() {
  $('anchors').replaceChildren();
  config.anchors.forEach((a,i) => {
   const row = document.createElement('div'); row.className = 'anchor'; const label = document.createElement('span'); label.textContent = `anchor ${i}`; row.append(label);
   const coords = document.createElement('div'); coords.className = 'grid3';
   ['X','Y','Z'].forEach((axis,j) => { const l = document.createElement('label'); l.textContent = axis; const input = document.createElement('input'); input.type = 'number'; input.step = '0.000244140625'; input.value = a[j]/WORLD; input.onchange = () => { a[j] = input.value.trim() === '' ? NaN : Math.round(Number(input.value)*WORLD); changed(); }; l.append(input); coords.append(l); });
   row.append(coords); const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '削除'; remove.onclick = () => { config.anchors.splice(i,1); renderAnchors(); changed(); }; row.append(remove); $('anchors').append(row);
  });
  $('add-anchor').disabled = !config || config.anchors.length >= 4 || $('anchor-mode').value !== 'specified';
 }
 function renderObjects() {
  $('objects').replaceChildren();
  config.terrainMembers.forEach((name,i) => {
   const li = document.createElement('li'); li.append(name);
   for (const [title, delta] of [['↑',-1],['↓',1],['削除',0]]) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = title; b.setAttribute('aria-label', `${name} ${title}`); b.disabled = delta !== 0 && (i+delta < 0 || i+delta >= config.terrainMembers.length);
    b.onclick = () => { if (!delta) config.terrainMembers.splice(i,1); else [config.terrainMembers[i],config.terrainMembers[i+delta]] = [config.terrainMembers[i+delta],config.terrainMembers[i]]; renderObjects(); changed(); }; li.append(b);
   }
   $('objects').append(li);
  });
 }
 function decodeResources(c) {
  const archivePath = `data/map/${record.fieldCode}.amdj`;
  for (const name of c.terrainMembers) {
   if (!resourceNames.includes(name)) throw Error(`7402のROM archiveにないCOL2です: ${name}`);
   if (!resources.has(name)) resources.set(name, monsterCol2FromRom(rom, {archivePath,memberName:name}));
  }
 }
 function clear() {
  epoch++; importSequence++; project = graph = record = image = background = rom = trig = model = fieldKernel = atKernel = session = config = null;
  resources = new Map(); resourceNames = []; dirty = false; busy = false;
  firstSpawn.release();replayMaps.clear();imageRenderer=null;
  $('inputs').disabled = true; $('release').disabled = true; $('rom').value = ''; $('start-node').replaceChildren(); $('target-node').replaceChildren(); $('resource').replaceChildren(); $('parties').replaceChildren(); $('anchors').replaceChildren(); $('objects').replaceChildren();
  $('map-info').textContent = '7402のグラフをNDSから読み込みます。'; $('ground-note').textContent = '初期Y設定はユーザー初期化です。native birthではありません。';
  update(); draw();
 }
 async function load(file) {
  if (!file) return;
  clear(); const stamp = epoch; busy = true; $('release').disabled = false; update();
  if (!/\.nds$/i.test(file.name) || file.size < 0x200 || file.size > 536870912) { busy = false; status('512MiB以下のNDSファイルを選択してください',true); update(); return; }
  status('ローカルNDSと公開WASMを読み込み中。入力の送信はしません。');
  try {
   const fetchBytes = async path => { const response = await fetch(path); if (!response.ok) throw Error(`公開ファイルの読込失敗: ${path} (${response.status})`); return response.arrayBuffer(); };
   const [input,motionBytes,mapBytes,csv] = await Promise.all([file.arrayBuffer(),fetchBytes('./wasm/monster_movement.wasm'),fetchBytes('./wasm/map_render.wasm'),fetch('./data/map-id-names.csv').then(r => r.ok ? r.text() : '')]);
   if (stamp !== epoch) return;
   if (new Uint8Array(input)[0x1e] !== 0) throw Error('日本語版DQ9 revision 0のみ対応しています');
   const loadedTrig = preferredNodeTrigFromRom(input,{includeAtan:true});
   const [motionModule,mapModule] = await Promise.all([WebAssembly.instantiate(motionBytes,{}),WebAssembly.instantiate(mapBytes,{})]);
   if (stamp !== epoch) return;
   const loadedProject = new MapProject(input,csv);
   const matches = loadedProject.records.filter(r => r.mapId === 7402);
   if (matches.length !== 1) throw Error('7402 map bindingを一意に解決できません');
   const selected = matches[0], loadedGraph = loadedProject.fieldGraphs.graphs.find(g => g.key === selected.fieldGraph?.key);
   if (!loadedGraph?.nodes?.length) throw Error('7402 ROM静的グラフがありません');
   rom = input; trig = loadedTrig; project = loadedProject;imageRenderer=new MapRenderer(mapModule.instance); record = selected; graph = loadedGraph;
   model = new MonsterMovementKernel(motionModule.instance,trig); atKernel = new ATKernel(mapModule.instance); fieldKernel = new FieldATKernel(atKernel);
   let terrainWarning = '';
   try { const archive = Narc.load(new Uint8Array(project.nitro.readFile(`data/map/${record.fieldCode}.amdj`))); resourceNames = Array.from({length:archive.files.length},(_,i) => archive.fnt.getFilenameOf(i)).filter(n => typeof n === 'string' && /^[-A-Za-z0-9_]+\.col2$/.test(n)); } catch (e) { terrainWarning = ` COL2一覧未取得: ${e.message}`; }
   let mapWarning = '';
   try { if (record.candidates?.length) { image = imageRenderer.compose(project,record.candidates[0].path); background = document.createElement('canvas'); background.width = image.width; background.height = image.height; background.getContext('2d').putImageData(new ImageData(image.rgba,image.width,image.height),0,0); } } catch (e) { mapWarning = ` 背景未取得（グラフ表示）: ${e.message}`; }
   $('start-node').replaceChildren(...graph.nodes.map((n,i) => new Option(`index ${i} / ID ${n.id}`,i)));
   $('resource').replaceChildren(...resourceNames.map(n => new Option(n,n)));
   $('inputs').disabled = false;
   applyConfig(defaultExplorerConfig(graph)); dirty = false;
   $('map-info').textContent = `7402 ${record.name} / ${graph.nodes.length}ノード / ${graph.edges.length}辺 / ${graph.key}。COL2 ${resourceNames.length}候補。`;
   status(`ローカル読込完了。trig / atan・グラフはこのNDS由来です。${terrainWarning}${mapWarning}`);
  } catch (e) { if (stamp === epoch) { clear(); status(e.message,true); } }
  finally { if (stamp === epoch) { busy = false; update(); firstSpawn.refresh(); draw(); } }
 }
 function capability(kind) {
  if (busy) return '読込中';
  if (!model || !session) return '仮想構成を初期化してください';
  if (dirty) return '設定が変更されています。初期化して新しい実験にしてください';
  if (session.stopped) return session.reason;
  const c = session.profile.config;
  if (kind === 'ai' && !c.animationType1) return 'animation type1仮説が未指定です';
  if (kind === 'life' && c.parties.some(p => p.mode === 'unknown')) return 'party存在・位置が不明です';
  if (kind === 'ground') {
   if (!c.sceneComplete) return '全静的object / zero-transform仮説が未指定です';
   if (c.anchorMode === 'unknown') return 'dynamic anchorが不明です';
   if (c.parties[0].mode !== 'present') return 'selected heroとしてparty 0の存在が必要です';
   if (c.controllerFlags & 0x2420) return 'controller flagsの分岐は未対応です';
   if (!(session.actor.actorFlags & 0x80)) return 'flag80なしの水平衝突（idle等）は未対応です';
  }
  if (kind === 'cycle') return capability('ai') || capability('life') || capability('ground');
  return '';
 }
 function update() {
  for (const [id,kind] of [['step-ai','ai'],['step-ai10','ai'],['step-ground','ground'],['step-life','life'],['step-cycle','cycle'],['step-cycle10','cycle'],['external','external']]) { const reason = capability(kind); $(id).disabled = !!reason; $(id).title = reason || '入力した固定条件の下でモデルを実行'; }
  $('export-config').disabled = !config || busy; $('import-config').disabled = !config || busy;
  $('initial-ground').disabled = !model || busy || !$('scene-complete').checked;
  $('initialize').disabled = !model || busy || !$('declared').checked;
  const readiness = !session ? '初期化前。条件を指定して仮説の実行を確認してください。' : dirty ? '設定変更あり。下の軌跡は前の条件です。初期化で新しい実験を開始します。' : session.stopped ? session.reason : `実行可能: ${['ai','life','ground','cycle'].filter(k => !capability(k)).join(' / ')}`;
  const unavailable = session && !session.stopped && !dirty ? [...new Set(['ai','life','ground'].map(capability).filter(Boolean))] : [];
  $('readiness').textContent = [readiness,...unavailable.map(r => `未実行: ${r}`)].join('\n'); $('readiness').classList.toggle('error',!!session?.stopped);
  renderResults();
 }
 function renderResults() {
  $('readout').replaceChildren();
  const rows = !session ? [['手動1actor実験','未初期化']] : [['状態',session.stopped ? '停止 / 最後の解決済み位置を保持' : '条件付き投影'],['AI呼出数',session.aiCalls],['XYZ native',session.actor.xyz.join(', ')],['XYZ world',session.actor.xyz.map(v => (v/WORLD).toFixed(5)).join(', ')],['実向き / 目標向き',`${session.actor.angle} / ${session.actor.targetAngle}`],['state / currentNodeIndex / targetID',`${session.actor.state} / ${session.actor.currentNodeIndex} / ${session.actor.targetNodeId}`],['速度 / stateTimer',`${session.actor.speed} / ${session.actor.stateTimer}`],['条件付きseed prefix',hex(session.seedPrefix)],['owned AT prefix',session.ownedAT],['明示した外部AT',session.externalAT],['仮説内AT合計',session.ownedAT + session.externalAT]];
  for (const [title,value] of rows) { const dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=title; dd.textContent=value; $('readout').append(dt,dd); }
  const c = session?.profile.config;
  const assumptions = c ? [`仮想profile: ${PROFILE}。species 1は識別用仮値。実種族の生成初期化は未対応。table ${session.actor.tableId} はROM由来。`,`初期state2 / header35 / actorFlags132 / acceleration40 / animationClass1 / event65535。e0,c1,c2,delay,gravity,vertical,correction,cooldown,alert,blockは0という宣言。`,`clock phase ${c.clock.phase}, delta ${c.clock.scaledDelta}を各AI呼出に固定。globalWord0 / fieldGroupFlags4 / map7402。実フレーム順は未知。`,`party 0–3: ${c.parties.map((p,i) => `${i}:${p.mode}`).join(' / ')}。存在partyは固定位置、header0x802、同map。`,`自然生成slot112のみ所有、他11枠: ${c.noOtherActors?'不在の仮説':'不明'}。現在ノードは目標のindexを保持。`,`controller ${hex(c.controllerFlags)} / worldKind ${c.worldKind} / scriptMode ${c.scriptMode}。selected hero override bit08000000はclear、callParametersは0。`,`anchor: ${c.anchorMode} / ${c.anchors.length}件。static scene: ${c.sceneComplete?'完全な仮説一覧':'不明'} / ${c.terrainMembers.join(' → ') || '(objectなし)'}。`,`animation type1全件: ${c.animationType1?'仮定':'不明'}。描画・animation runtime・material cache・他actor・schedulerは計算対象外。`,'種族の生成・警戒/追跡・水平衝突・非zero transform・未解決分岐を推定で埋めません。'] : ['未初期化。入力条件は実ゲームの観測値とは扱いません。'];
  $('assumptions').replaceChildren(...assumptions.map(text => { const li=document.createElement('li');li.textContent=text;return li; }));
  $('log').replaceChildren(...(session?.events.slice(-200) ?? []).map(e => {const tr=document.createElement('tr');for(const v of [e.sequence,e.stage,e.xyz.join(', '),e.angle,e.state,hex(e.seed),`+${e.ownedDelta} / ${e.ownedAT}`]){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));
 }
 function draw() {
  ctx.fillStyle='#0b1117'; ctx.fillRect(0,0,canvas.width,canvas.height);
  if (!graph?.nodes?.length) { ctx.fillStyle='#bac9db';ctx.font='16px system-ui';ctx.fillText('NDSから7402のグラフを読み込んでください',24,40);return; }
  const view=firstSpawn.view(),mapId=view?.mapId??7402;let scene={image,background,graph};
  if(mapId!==7402){
   if(!replayMaps.has(mapId)){let next={image:null,background:null,graph:{nodes:[],edges:[]}};try{const records=project.records.filter(r=>r.mapId===mapId);if(records.length!==1)throw Error('map binding');const r=records[0];next.graph=project.fieldGraphs.graphs.find(g=>g.key===r.fieldGraph?.key)??next.graph;if(r.candidates?.length===1){const im=imageRenderer.compose(project,r.candidates[0].path);if(markerCoordinateBinding(im.descriptor,mapId).kind==='physical-xz-under-ordinary-group'){const bg=document.createElement('canvas');bg.width=im.width;bg.height=im.height;bg.getContext('2d').putImageData(new ImageData(im.rgba,im.width,im.height),0,0);next.image=im;next.background=bg;}}}catch{}replayMaps.set(mapId,next);}
   scene=replayMaps.get(mapId);
  }
  const shownImage=scene.image,shownBackground=scene.background,shownGraph=scene.graph;
  let transform = $('overlay').checked ? explorerMapTransform(shownImage,canvas.width,canvas.height) : null;
  if (transform && shownBackground) {ctx.imageSmoothingEnabled=false;ctx.drawImage(shownBackground,transform.ox,transform.oz,shownImage.width*transform.fit,shownImage.height*transform.fit);}
  else { const positions=shownGraph.nodes.length?shownGraph.nodes.map(n=>n.position):[[-16,0,-16],[16,0,16]]; const minX=Math.min(...positions.map(p=>p[0])),maxX=Math.max(...positions.map(p=>p[0])),minZ=Math.min(...positions.map(p=>p[2])),maxZ=Math.max(...positions.map(p=>p[2]));const scale=Math.min((canvas.width-80)/Math.max(1,maxX-minX),(canvas.height-80)/Math.max(1,maxZ-minZ));transform={scale,x:40-minX*scale,z:40-minZ*scale}; }
  const point = p => [transform.x+p[0]*transform.scale,transform.z+p[2]*transform.scale];
  $('canvas-note').textContent = mapId!==7402 ? `再生map ${mapId} / ${view?.pending??'到達phase'}。ROM配置要求と現在の物理位置を区別し、未確定な位置は描きません。` : $('overlay').checked && image && background && explorerMapTransform(image,canvas.width,canvas.height) ? 'ROM背景 + 計算結果。7402の限定範囲で位置対応を検証、全域保証なし。線は解決済み位置の接続で、途中の衝突を保証しません。' : 'XZグラフ（背景なし）。敵の経路情報で、プレイヤーの歩行領域ではありません。';
  ctx.lineWidth=1;ctx.strokeStyle='#77818e';
  for (const [a,b] of shownGraph.edges) { if (!shownGraph.nodes[a] || !shownGraph.nodes[b])continue; ctx.beginPath();ctx.moveTo(...point(shownGraph.nodes[a].position));ctx.lineTo(...point(shownGraph.nodes[b].position));ctx.stroke(); }
  for (const [i,n] of shownGraph.nodes.entries()) {const [x,z]=point(n.position);ctx.fillStyle=i===session?.actor.currentNodeIndex?'#ffd679':'#b7c9d9';ctx.beginPath();ctx.arc(x,z,3,0,Math.PI*2);ctx.fill();ctx.font='10px system-ui';ctx.fillText(`${i}`,x+5,z-4);}
  if(firstSpawn.draw(ctx,transform))return;
  if (!session)return;
  ctx.strokeStyle='#58efd1';ctx.lineWidth=2;ctx.beginPath();session.trace.forEach((p,i)=>{const xy=point(p.map(v=>v/WORLD));i?ctx.lineTo(...xy):ctx.moveTo(...xy);});ctx.stroke();
  session.profile.config.parties.forEach((p,i)=>{if(p.mode!=='present')return;const [x,z]=point(p.xyz.map(v=>v/WORLD));ctx.fillStyle='#ef9fbd';ctx.fillRect(x-4,z-4,8,8);ctx.fillText(`P${i}`,x+6,z+3);});
  const [x,z]=point(session.actor.xyz.map(v=>v/WORLD));ctx.fillStyle=session.stopped?'#ffc873':'#58efd1';ctx.beginPath();ctx.arc(x,z,5,0,Math.PI*2);ctx.fill();const direction=fieldNativeFacing(session.actor.angle,trig);if(direction){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,z);ctx.lineTo(x+direction[0]/WORLD*23,z+direction[2]/WORLD*23);ctx.stroke();}
 }
 function initialize() {
  firstSpawn.dismiss();
  const c = readConfig(); decodeResources(c);
  const tableRows = record.encounterContexts.flatMap(c => c.rows);
  const profile = createExplorerProfile({config:c,graph,tableRows,resources,kernel:model});
  session = new ExplorerSession(profile,model,fieldKernel,atKernel); dirty = false;
  status('仮想profileを初期化しました。以降はこの初期状態からモデルの出力を連鎖します。');update();draw();
 }
 function advance(kind,count) {
  if (capability(kind)) throw Error(capability(kind));
  for (let i=0;i<count;i++) if (!session.advance(kind)) break;
  update();draw();
 }
 $('rom').onchange=()=>load($('rom').files[0]);
 $('release').onclick=()=>{clear();status('ROM・画像・全実験状態を解放しました。次のNDSには引き継ぎません。');};
 $('config').onsubmit=e=>e.preventDefault();
 $('config').addEventListener('input',changed);
 $('config').addEventListener('change',changed);
 $('start-node').onchange=()=>{targets();changed();};
 $('node-position').onclick=()=>run(()=>{graph.nodes[Number($('start-node').value)].position.forEach((n,i)=>$(['x','y','z'][i]).value=n);changed();});
 $('party-near').onclick=()=>run(()=>{const c=readConfig();config.parties[0]={mode:'present',xyz:[c.xyz[0]+8*WORLD,c.xyz[1],c.xyz[2]]};renderParties();changed();});
 $('face-target').onclick=()=>run(()=>{const c=readConfig(),result=model.state2EntrySteering(c.xyz,graph.nodes[c.targetNodeIndex].position.map(v=>v*WORLD));if(!result.resolved)throw Error(result.reason);$('angle').value=result.targetAngle;changed();});
 $('anchor-mode').onchange=()=>{if($('anchor-mode').value==='none')config.anchors=[];renderAnchors();changed();};
 $('add-anchor').onclick=()=>run(()=>{if(config.anchors.length>=4)throw Error('anchorは最大4件です');config.anchors.push([0,0,0]);renderAnchors();changed();});
 $('add-object').onclick=()=>run(()=>{const name=$('resource').value;if(!resourceNames.includes(name))throw Error('ROM COL2を選択してください');if(config.terrainMembers.includes(name))throw Error('同じobject resourceの重複はこのprofileでは未対応です');config.terrainMembers.push(name);renderObjects();changed();});
 $('initial-ground').onclick=()=>run(()=>{const c=readConfig();decodeResources(c);const result=model.terrainHeight(c.xyz,explorerTerrain(c,resources));if(!result.resolved)throw Error(result.reason);$('y').value=result.height/WORLD;const hits=result.objects.filter(o=>o.selectedIndex>=0).length;$('ground-note').textContent=`初期Y=${result.height} nativeを設定。地形hit ${hits}件。ユーザー初期化でありnative birthではありません。`;changed();});
 $('initialize').onclick=()=>run(initialize);
 for(const [id,kind,count] of [['step-ai','ai',1],['step-ai10','ai',10],['step-ground','ground',1],['step-life','life',1],['step-cycle','cycle',1],['step-cycle10','cycle',10]]) $(id).onclick=()=>run(()=>advance(kind,count));
 $('external').onclick=()=>run(()=>{if(capability('external'))throw Error(capability('external'));session.external(Number($('external-count').value));update();draw();});
 $('overlay').onchange=draw;
 $('export-config').onclick=()=>run(()=>{const c=readConfig(),blob=new Blob([JSON.stringify(c,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dq9-monster-explorer-initial-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);});
 $('import-config').onchange=async()=>{const file=$('import-config').files[0],stamp=epoch,operation=++importSequence;$('import-config').value='';if(!file)return;try{if(file.size>65536)throw Error('設定JSONは64KiB以下です。ROM/RAM/軌跡は読み込めません');const text=await file.text();if(stamp!==epoch||operation!==importSequence)return;const c=validateExplorerConfig(JSON.parse(text),graph);if(c.terrainMembers.some(n=>!resourceNames.includes(n)))throw Error('現在のROMにないCOL2設定です');c.declaredHypothesis=false;applyConfig(c);status('初期設定を読み込みました。仮説を確認して初期化してください。既存軌跡へ次状態を注入しません。');}catch(e){if(stamp===epoch&&operation===importSequence)status(e.message,true);}};
 update();draw();
}
