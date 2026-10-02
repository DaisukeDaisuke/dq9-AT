import {ARand} from './vendor/arand-reference.mjs';
import {projectMapEntry} from './map-entry-at.mjs';
import {compareMapEntryObservation} from './map-entry-observation.mjs';
import {projectNpcATContinuation} from './npc-at-continuation.mjs';
import {compareNpcContinuationObservation} from './npc-continuation-observation.mjs';
const hex=n=>'0x'+(Number(n)>>>0).toString(16).padStart(8,'0');
export function parseSeed(value){let n;try{if(!/^(?:0x[\da-f]{1,8}|\d{1,10})$/i.test(String(value).trim()))throw Error();n=BigInt(String(value).trim());}catch{throw Error('既知initial AT seedを0x付き16進数または10進数で入力してください');}if(n<0n||n>0xffffffffn)throw Error('seedは32bit unsignedです');return Number(n);}
export function atRandomInt(random,max){if(!Number.isInteger(random)||random<0||random>32767||!Number.isInteger(max)||max<1||max>32767)throw Error('ATRandInt input outside confirmed positive range');return Math.trunc(max*((random-1)/32767));}
export class ATKernel {
 constructor(instance){this.e=instance.exports;this.heap=Number(this.e.__heap_base.value);if(!this.e.at_advance)throw Error('AT対応WASMがありません。ビルドを更新してください');}
 seedAt(seed,position){position=BigInt(position);if(position<0n||position>0xffffffffffffffffn)throw Error('AT index outside64bit');return this.e.at_advance(seed,position)>>>0;}
 generate(seed,position,count){if(!Number.isInteger(count)||count<1||count>1000000)throw Error('探索窓は1..1000000です');const p=this.heap,size=count*8;if(p+size>this.e.memory.buffer.byteLength)this.e.memory.grow(Math.ceil((p+size-this.e.memory.buffer.byteLength)/65536));const before=this.seedAt(seed,position);this.e.at_generate(before,count,p);return new Uint32Array(this.e.memory.buffer,p,count*2).slice();}
}
export function selectFieldTables(rows,timeValue,areaMask){const eligible=rows.filter(r=>{const mode=(r.flags>>>0)&7;return (mode!==0||timeValue!==0)&&(mode!==1||timeValue===0);});const preferred=eligible.filter(r=>{const mask=(r.flags>>>13)&255;return !mask||!!(mask&areaMask);});return (preferred.length?preferred:eligible).map(r=>r.tableId);}
export function monsterForRandom(table,random){const n=atRandomInt(random,Number(table.maxRand));const matches=table.data.filter(m=>n>=Number(m.start)&&n<=Number(m.end));if(matches.length!==1||matches[0].trapMonster)return {value:n,monster:null,reason:matches.some(m=>m.trapMonster)?'trap-rule-unresolved':'table-interval-unresolved'};return {value:n,monster:matches[0]};}
export class ATSession {
 constructor(seed,kernel,{origin='external-known-seed-from-boot',epoch=null}={}){if(!['external-known-seed-from-boot','known-local-checkpoint'].includes(origin)||(origin==='known-local-checkpoint'&&(!epoch||typeof epoch!=='string')))throw Error('Valid session origin and local epoch required');this.origin=origin;this.originEpoch=epoch;this.seed=parseSeed(seed);this.kernel=kernel;this.lowerBound=0n;this.conditionalBound=0n;this.createdAt=new Date().toISOString();this.events=[];this.ids=new Set();this.map=null;this.candidates=null;this.hypotheses=[];this.consumerUncertainty=[];this.entryProjections=[];this.entryObservations=[];this.npcContinuations=[];this.npcObservations=[];}
 setMap(map,entryPacket=null){
  if(entryPacket&&entryPacket.source?.mapId!==map?.mapId)throw Error('Entry destination differs from requested map context');
  if(entryPacket&&this.entryProjections.some(e=>e.id===entryPacket.id))return this.projectEntry(entryPacket);
  const previousMap=this.map,before=previousMap?.mapId;
  if(entryPacket&&entryPacket.origin?.mapId!==before)throw Error('Entry origin differs from current map context');
  // A rejected entry must leave the live ledger unchanged so a corrected packet
  // can be retried from the same origin. Keep the map event before its projection.
  const eventCount=this.events.length,uncertaintyCount=this.consumerUncertainty.length,projectionCount=this.entryProjections.length,bound=this.conditionalBound,hadId=this.ids.has(entryPacket?.id);
  try{
   this.map=structuredClone(map);
   if(map?.mapId!==before)this.consumerUncertainty.push({kind:'map-entry',fromMapId:before??null,toMapId:map?.mapId??null,minimumCalls:'0',maximumCalls:null,consumers:['map-load','NPC-initialization','pots-barrels','pickup-initialization','unclassified'],status:'unresolved-not-zero'});
   this.events.push({kind:'map-context',map:this.map,lowerBound:String(this.lowerBound)});
   if(entryPacket)return this.projectEntry(entryPacket);
  }catch(error){this.map=previousMap;this.events.length=eventCount;this.consumerUncertainty.length=uncertaintyCount;this.entryProjections.length=projectionCount;this.conditionalBound=bound;if(!hadId)this.ids.delete(entryPacket?.id);throw error;}
 }
 projectEntry(packet){
  if(!packet?.id||packet.source?.mapId!==this.map?.mapId)throw Error('Entry occurrence ID and current destination map required');
  if(packet.schedule?.originFrame!==packet.origin?.frame||!Number.isInteger(packet.schedule.endFrame)||packet.schedule.endFrame<=packet.origin.frame)throw Error('Explicit closed entry input window required');
  const existing=this.entryProjections.find(e=>e.id===packet.id);
  if(existing){if(JSON.stringify(existing.packet)!==JSON.stringify(packet))throw Error('Conflicting entry occurrence retransmission');return this.snapshot();}
  if(this.ids.has(packet.id))throw Error('Entry occurrence ID overlaps another observation');
  const last=this.entryProjections.at(-1);if(last&&packet.origin?.epoch===last.packet.origin.epoch&&packet.origin.frame<last.packet.schedule.endFrame)throw Error('Entry input windows overlap within an epoch');
  const lastNpc=this.npcContinuations.at(-1);if(lastNpc&&packet.origin?.epoch===lastNpc.packet.origin.epoch&&packet.origin.frame<=lastNpc.packet.clocks.ticks.at(-1).sourceFrame)throw Error('Entry window overlaps an already projected NPC interval');
  const projection=projectMapEntry(packet.source,packet.origin,this.kernel),before=this.conditionalBound;
  // A local origin can link only to its own epoch and current projected seed.
  // A matching arbitrary seed never converts an unrelated boot ledger into proof.
  const linked=this.origin==='known-local-checkpoint'&&this.originEpoch===packet.origin?.epoch&&packet.origin.seed===this.kernel.seedAt(this.seed,before);
  if(linked)this.conditionalBound+=BigInt(projection.conditionalConsumed);
  const event={kind:'map-entry-projection',id:packet.id,packet:structuredClone(packet),projection:structuredClone(projection),linkedToLocalEpoch:linked,conditionalBefore:String(before),conditionalAfter:String(this.conditionalBound),provenLowerBound:String(this.lowerBound)};
  this.ids.add(packet.id);this.events.push(event);this.entryProjections.push(event);
  this.consumerUncertainty.push({kind:'map-entry-projection',id:packet.id,minimumCalls:'0',maximumCalls:null,conditionalCalls:String(projection.conditionalConsumed),status:projection.resolved?'conditional-source-sequence-with-unknown-world-suffix':'conditional-prefix-then-unresolved',boundary:projection.boundary,conditions:projection.conditions});
  return this.snapshot();
 }
 recordEntryObservation(id,evidence){
  const entry=this.entryProjections.find(e=>e.id===id);if(!entry)throw Error('Freeze the source entry projection before observing execution');
  const previous=this.entryObservations.find(e=>e.id===id);if(previous){if(JSON.stringify(previous.evidence)!==JSON.stringify(evidence))throw Error('Conflicting entry observation retransmission');return this.snapshot();}
  const comparison=compareMapEntryObservation(entry.packet,entry.projection,evidence);
  if(!comparison.matches||!comparison.observer.rawDrainsAvailable||comparison.observer.dropped!==0)throw Error('Complete matching bounded entry observation required: '+JSON.stringify(comparison.firstDifference));
  const event={kind:'map-entry-observation',id,evidence:structuredClone(evidence),comparison,observedLocalMinimum:String(comparison.observedMinimumLocalCalls),bootProof:false};this.events.push(event);this.entryObservations.push(event);
  return this.snapshot();
 }
 projectNpcContinuation(packet){
  if(!packet?.id||packet.origin?.epoch!==this.originEpoch||this.origin!=='known-local-checkpoint')throw Error('Bound local NPC origin required');
  const previous=this.npcContinuations.find(e=>e.id===packet.id);if(previous){if(JSON.stringify(previous.packet)!==JSON.stringify(packet))throw Error('Conflicting NPC continuation retransmission');return this.snapshot();}
  if(!Array.isArray(packet.clocks?.ticks)||!packet.clocks.ticks.length)throw Error('A nonempty explicit NPC invocation window is required');
  const lastNpc=this.npcContinuations.at(-1);if(lastNpc&&packet.origin.originFrame<=lastNpc.packet.clocks.ticks.at(-1).sourceFrame)throw Error('NPC invocation windows overlap');
  const lastEntry=this.entryProjections.at(-1);if(lastEntry&&packet.origin.originFrame<lastEntry.packet.schedule.endFrame)throw Error('NPC origin precedes entry endpoint');
  if(this.ids.has(packet.id)||packet.origin.seed!==this.kernel.seedAt(this.seed,this.conditionalBound))throw Error('NPC interval overlaps or its seed does not link to the current local source projection');
  const result=projectNpcATContinuation(packet.origin,packet.clocks,packet.resources,{expectedEpoch:this.originEpoch}),before=this.conditionalBound;this.conditionalBound+=BigInt(result.conditionalConsumed);
  const event={kind:'npc-entry-continuation',id:packet.id,packet:structuredClone(packet),projection:JSON.parse(JSON.stringify(result)),conditionalBefore:String(before),conditionalAfter:String(this.conditionalBound),bootProof:false};this.ids.add(packet.id);this.events.push(event);this.npcContinuations.push(event);
  this.consumerUncertainty.push({kind:'npc-entry-continuation',id:packet.id,minimumCalls:'0',maximumCalls:null,conditionalCalls:String(result.conditionalConsumed),status:result.resolved?'conditional-ordinary-NPC-sequence-with-unknown-world-suffix':'conditional-prefix-then-unresolved',boundary:result.boundary,conditions:result.conditions});return this.snapshot();
 }
 noteUnresolvedConsumption({id,consumer='unclassified',source='human',details=null}){if(!id||this.ids.has(id))throw Error('消費区間IDが空または重複です');this.ids.add(id);const entry={kind:'unresolved-consumption',id,consumer,source,details,map:this.map,minimumCalls:'0',maximumCalls:null,status:'unresolved-not-zero',lowerBound:String(this.lowerBound)};this.consumerUncertainty.push(entry);this.events.push(entry);return this.snapshot();}
 recordNpcContinuationObservation(id,evidence){
  const entry=this.npcContinuations.find(e=>e.id===id);if(!entry)throw Error('Freeze the NPC projection before observing execution');
  const previous=this.npcObservations.find(e=>e.id===id);if(previous){if(JSON.stringify(previous.evidence)!==JSON.stringify(evidence))throw Error('Conflicting NPC observation retransmission');return this.snapshot();}
  const comparison=compareNpcContinuationObservation(entry.packet,entry.projection,evidence);
  if(!comparison.orderedConsumptionMatches||!comparison.observer?.rawDrainsAvailable||comparison.observer.dropped!==0)throw Error('Matching complete local AT sequence required: '+JSON.stringify(comparison.firstDifference));
  const event={kind:'npc-continuation-observation',id,evidence:structuredClone(evidence),comparison,observedLocalMinimum:String(comparison.observedMinimumLocalCalls),bootProof:false,status:comparison.matches?'bounded-projected-fields-match':'ordered-local-consumption-matches-state-boundary-remains'};
  this.events.push(event);this.npcObservations.push(event);
  if(!comparison.matches)this.consumerUncertainty.push({kind:'NPC-state-boundary',id,minimumCalls:'0',maximumCalls:null,status:'unresolved-not-zero',firstDifference:comparison.firstDifference});return this.snapshot();
 }
 currentPositionEnvelope(){const base=this.conditionalBound>this.lowerBound?this.conditionalBound:this.lowerBound;return {intervals:[{first:String(base),last:null}],exact:false,basis:'conditional on chronological source projections and monster/table observation hypotheses; unobserved consumers allow a nonnegative unbounded increment',lastWeightedObservation:this.candidates?.observationId??null,provenLowerBound:String(this.lowerBound),conditionalLowerBound:String(this.conditionalBound),unresolvedIntervals:this.consumerUncertainty.length};}
 noteInput(input){this.events.push({kind:'human-input',input,lowerBound:String(this.lowerBound),minimumProvenCalls:0});}
 noteVideo(observation){if(!observation||!['video-map-name-candidates','video-map-registration','video-gap'].includes(observation.kind))throw Error('未対応の映像観測です');this.events.push({kind:'video-observation',observation:structuredClone(observation),lowerBound:String(this.lowerBound),minimumProvenCalls:0,interpretation:'Uncalibrated video evidence only; no AT draw or exact map/area/position is inferred.'});}
 observeMonster({id,tableId,tableIds,monsterId,source='human',naturalConfirmed=false},tables,window=50000){
  if(!id||this.ids.has(id))throw Error('観測IDが空または重複です。同じ出現を二重加算しません');
  const ids=[...new Set((tableIds??[tableId]).map(Number))];
  if(!ids.length||ids.some(x=>!Number.isInteger(x)||x<0))throw Error('生成地点のtable候補が必要です');
  // Match compileEvent's weighted predicate: missing/malformed tables and
  // unresolved trap/overlap/hole outputs are possible, not negative evidence.
  // 0 = resolved mismatch, 1 = resolved species match, 2 = unresolved outcome.
  const uint=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max,unknown=[],outcomes=new Map();
  for(const id of ids){
   const table=tables?.[String(id)],mask=new Uint8Array(32768);
   const valid=table&&uint(table.maxRand,32767)&&table.maxRand>0&&Array.isArray(table.data)
    &&Array.from({length:table.data.length},(_,i)=>Object.hasOwn(table.data,i)).every(Boolean)
    &&table.data.every(r=>r&&uint(r.start,32767)&&Number.isInteger(r.end)&&r.end>=-1&&r.end<32768&&uint(r.monsterId,65535)&&typeof r.trapMonster==='boolean');
   if(!valid)mask.fill(2);
   else for(let random=0;random<32768;random++){const outcome=monsterForRandom(table,random);mask[random]=!outcome.monster?2:Number(outcome.monster.monsterId)===Number(monsterId)?1:0;}
   if(mask.includes(2))unknown.push(id);outcomes.set(id,mask);
  }
  if(![...outcomes.values()].some(mask=>mask.some(Boolean)))throw Error('どのtable候補にも通常weighted選択としてこのmonsterがありません');
  const before=this.conditionalBound,min=naturalConfirmed?2n:1n,start=before+min-1n,pairs=this.kernel.generate(this.seed,start,window),positions=[],tableMatches=[];
  for(let i=0;i<window;i++){const random=pairs[i*2+1],matching=ids.filter(id=>outcomes.get(id)[random]===1),unresolved=ids.some(id=>outcomes.get(id)[random]===2);if(matching.length||unresolved){const position=String(start+BigInt(i+1));positions.push(position);if(matching.length)tableMatches.push({position,tableIds:matching});}}
  const first=positions.length?BigInt(positions[0]):start+BigInt(window)+1n;
  this.conditionalBound=first;this.ids.add(id);
  this.candidates={observationId:id,kind:'last-weighted-draw-position',searchedFrom:String(start+1n),searchedThrough:String(start+BigInt(window)),positions,tableMatches,tableIds:ids,unresolvedTableIds:unknown,unsearchedTailFrom:String(start+BigInt(window)+1n),tailPossible:true,currentMayBeLater:true};
  const event={kind:'monster-observation',id,tableId:ids.length===1?ids[0]:undefined,tableIds:ids,monsterId:Number(monsterId),source,naturalConfirmed,window,conditionalBefore:String(before),conditionalAfter:String(first),provenLowerBound:String(this.lowerBound),condition:'a distinct chronological weighted draw from at least one candidate table; naturalConfirmed additionally assumes the natural field path',map:this.map};
  this.events.push(event);this.hypotheses.push(event);return this.snapshot();
 }
 ingestBootTrace(trace){
  if(this.origin!=='external-known-seed-from-boot')throw Error('Local checkpoint session cannot ingest a boot proof');
  // Only a contiguous exec stream explicitly originating at the external known boot seed can move the proof bound.
  if(trace.origin!=='boot-known-initial'||Number(trace.initialSeed)!==this.seed||trace.startPosition!=='0')throw Error('起動からの既知seed traceが必要です。途中state観測を起動証明へ変換しません');
  let seed=BigInt(this.seed),count=0n;
  for(const item of trace.updates){const before=seed,[after,random]=ARand(seed);if(BigInt(item.before)!==before||BigInt(item.after)!==after||BigInt(item.random)!==random||BigInt(item.sequence)!==count+1n)throw Error('AT exec連続性が途切れています。既存下限は保持します');seed=after;count++;}
  if(count<this.lowerBound)throw Error('古いtraceで下限を後退させません');
  this.lowerBound=count;this.conditionalBound=this.conditionalBound<count?count:this.conditionalBound;
  this.events.push({kind:'verified-boot-exec-prefix',count:String(count),finalSeed:hex(seed),source:trace.source??null,trace:structuredClone(trace)});return this.snapshot();
 }
 static restore(saved,kernel,tables){
  if(saved?.format!=='dq9-at-session'||saved.version!==1||!Array.isArray(saved.events))throw Error('対応する保存セッションではありません');
  const s=new ATSession(saved.initialSeed,kernel,{origin:saved.origin??'external-known-seed-from-boot',epoch:saved.originEpoch??null});s.createdAt=saved.createdAt;
  for(const event of saved.events){
   if(event.kind==='map-context')s.setMap(event.map);
   else if(event.kind==='human-input')s.noteInput(event.input);
   else if(event.kind==='video-observation')s.noteVideo(event.observation);
   else if(event.kind==='unresolved-consumption')s.noteUnresolvedConsumption(event);
   else if(event.kind==='map-entry-projection'){s.projectEntry(event.packet);const actual=s.entryProjections.at(-1);if(JSON.stringify(actual.projection)!==JSON.stringify(event.projection)||actual.linkedToLocalEpoch!==event.linkedToLocalEpoch)throw Error('Saved entry projection disagrees with replayed source/origin');}
   else if(event.kind==='map-entry-observation'){s.recordEntryObservation(event.id,event.evidence);if(JSON.stringify(s.entryObservations.at(-1).comparison)!==JSON.stringify(event.comparison))throw Error('Saved entry observation disagrees with replayed native facts');}
   else if(event.kind==='npc-entry-continuation'){s.projectNpcContinuation(event.packet);if(JSON.stringify(s.npcContinuations.at(-1).projection)!==JSON.stringify(event.projection))throw Error('Saved NPC continuation disagrees with replayed origin/clock/resources');}
   else if(event.kind==='npc-continuation-observation'){s.recordNpcContinuationObservation(event.id,event.evidence);if(JSON.stringify(s.npcObservations.at(-1).comparison)!==JSON.stringify(event.comparison))throw Error('Saved NPC observation disagrees with replayed native facts');}
   else if(event.kind==='monster-observation')s.observeMonster(event,tables,event.window??50000);
   else if(event.kind==='verified-boot-exec-prefix'){if(!event.trace)throw Error('起動traceが保存されていないため下限を再評価できません');s.ingestBootTrace(event.trace);}
   else throw Error('未対応の証拠イベント: '+event.kind);
  }
  if(String(s.lowerBound)!==saved.lowerBound||String(s.conditionalBound)!==saved.conditionalBound)throw Error('保存値と証拠の再評価結果が一致しません');
  return s;
 }
 forecast(tables,tableIds,targetIds,window=50000,{conditional=false}={}){
  const start=conditional?this.conditionalBound:this.lowerBound,pairs=this.kernel.generate(this.seed,start,window),targets=new Set(targetIds.map(Number)),results=[];
  for(const tableId of tableIds){const table=tables[String(tableId)];if(!table)throw Error(`既存enc.jsonにtable ${tableId}の分布がありません。候補を除外せず未解決として保持してください`);const hits=[];for(let i=0;i<window;i++){const outcome=monsterForRandom(table,pairs[i*2+1]);if(outcome.monster&&targets.has(Number(outcome.monster.monsterId))){hits.push({position:String(start+BigInt(i+1)),offset:i+1,seed:hex(pairs[i*2]),random:pairs[i*2+1],value:outcome.value,monsterId:Number(outcome.monster.monsterId),monsterName:outcome.monster.monsterName});if(hits.length===20)break;}}results.push({tableId:Number(tableId),hits});}
  return {basis:conditional?'conditional-observation-branch':'proven-lower-bound',from:String(start+1n),through:String(start+BigInt(window)),results,unsearchedTailPossible:true,interpretation:'These are favorable weighted-draw positions, not a guaranteed current position or a frame countdown. Table-selection and monster-movement AT must also be modeled.'};
 }
 snapshot(){return {format:'dq9-at-session',version:1,initialSeed:hex(this.seed),origin:this.origin,originEpoch:this.originEpoch,createdAt:this.createdAt,lowerBound:String(this.lowerBound),conditionalBound:String(this.conditionalBound),map:this.map,candidates:this.candidates,currentPositionEnvelope:this.currentPositionEnvelope(),consumerUncertainty:this.consumerUncertainty,events:this.events,entryProjections:this.entryProjections,entryObservations:this.entryObservations,npcContinuations:this.npcContinuations,npcObservations:this.npcObservations,exactCurrentPosition:false,unboundedFuturePossible:true};}
}
export function replayObservedTrace(observation,kernel,tables){
 const pairs=kernel.generate(Number(observation.startSeed),0n,observation.updates.length),mismatches=[];let seed=BigInt(observation.startSeed);
 for(let i=0;i<observation.updates.length;i++){const [sequence,after,random]=observation.updates[i],[next,expected]=ARand(seed);if(sequence!==i+1||Number(next)!==after||Number(expected)!==random||pairs[2*i]!==after||pairs[2*i+1]!==random)mismatches.push({kind:'UpdateAT',sequence});seed=next;}
 for(const [sequence,max,result] of observation.intCalls){const random=pairs[2*(sequence-1)+1],actual=atRandomInt(random,max),wasm=kernel.e.at_randint(random,max);if(actual!==result||wasm!==result)mismatches.push({kind:'ATRandInt',sequence,result,actual,wasm});}
 const spawns=[];for(const [sequence,monsterId,tableId,mapId] of observation.spawnCreationEntries){const outcome=monsterForRandom(tables[String(tableId)],pairs[2*(sequence-1)+1]);const agrees=Number(outcome.monster?.monsterId)===monsterId;if(!agrees)mismatches.push({kind:'spawn',sequence,monsterId,actual:outcome.monster?.monsterId});spawns.push({sequence,monsterId,tableId,mapId,value:outcome.value,agrees});}
 return {format:'dq9-at-replay-result',sourceOrigin:observation.origin,updates:observation.updates.length,intCalls:observation.intCalls.length,spawns,mismatches,finalSeed:hex(seed),bootProof:false};
}
