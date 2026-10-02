// Read-only boundary between a saved ATSession and the existing hypothesis form.
// This never restores a ledger, advances AT, or treats saved bounds as evidence.
import {parseSeed} from './at-core.mjs';
export const SESSION_IDENTIFICATION_KEY='dq9-at-identification-handoff-v1';
const need=(v,m)=>{if(!v)throw Error(m);};
const clone=x=>structuredClone(x);
const nativeId=n=>Number.isInteger(n)&&n>=0&&n<=65535;
export function readSessionObservations(saved){
 need(saved?.format==='dq9-at-session'&&saved.version===1&&Array.isArray(saved.events),'対応するAT追跡セッションJSONが必要です');
 need(saved.origin==='external-known-seed-from-boot','起動時の外部既知seedを記録した追跡セッションが必要です');
 parseSeed(saved.initialSeed);
 const ids=new Set(),observations=[];
 for(const [eventIndex,event] of saved.events.entries()){
  need(event&&typeof event==='object','セッションに不正なイベントがあります');
  if(event.id!==undefined){need(typeof event.id==='string'&&event.id.length>0&&!ids.has(event.id),'セッションの観測・消費区間IDが空または重複です');ids.add(event.id);}
  if(event.kind!=='monster-observation')continue;
  need(typeof event.id==='string'&&event.id.length>0,'観測IDが必要です');
  const tableIds=event.tableIds??[event.tableId];
  need(Array.isArray(tableIds)&&tableIds.length>0&&Array.from(tableIds).every(nativeId)&&nativeId(event.monsterId),'観測のtable・monster IDが不正です');
  observations.push({eventIndex,event:clone(event),tableIds:[...new Set(tableIds)]});
 }
 return{saved:clone(saved),observations};
}
export function sessionObservationsToForm(saved,selectedIds){
 const {observations}=readSessionObservations(saved);
 need(Array.isArray(selectedIds)&&selectedIds.length>=1&&selectedIds.length<=8,'記録済み観測を1〜8件選択してください');
 need(new Set(selectedIds).size===selectedIds.length,'同じ観測を二重に選択できません');
 const selected=new Set(selectedIds),rows=observations.filter(o=>selected.has(o.event.id));
 need(rows.length===selected.size,'選択した観測IDがセッションにありません');
 const sessionContext={format:'dq9-at-session-identification-source-v1',initialSeed:saved.initialSeed,origin:saved.origin,createdAt:saved.createdAt??null,importedObservationIds:rows.map(o=>o.event.id),selectedObservationIds:rows.map(o=>o.event.id),totalMonsterObservations:observations.length,sourceEventCount:saved.events.length,savedLowerBound:saved.lowerBound??null,savedConditionalBound:saved.conditionalBound??null,savedBoundsUsedAsIndexLimits:false,consumerUncertainty:clone(saved.consumerUncertainty??[]),nonMonsterEvents:saved.events.filter(e=>e.kind!=='monster-observation').map(({trace,...event})=>clone(event)),scope:'Snapshot only. Saved bounds, boot prefixes, search windows, timestamps and map selections do not bound selected past draws. The live session is not modified.'};
 return{synthetic:false,sessionContext,searchMode:'known-origin-terminal-indices',initialSeed:saved.initialSeed,seedProvenance:`AT追跡セッションの外部既知seed（保存日時 ${saved.createdAt??'不明'}）。この読込では実機・起動traceを再検証していない`,ordered:true,rows:rows.map(({eventIndex,event,tableIds})=>({sightingId:event.id,eventId:`weighted:${event.id}`,sourceObservation:{eventIndex,event:clone(event)},label:`保存観測 ${event.id}`,tables:tableIds.join(', '),species:String(event.monsterId),gapMode:'unknown',gapMin:'',gapMax:'',gapProvenance:''})),firstIndex:'',lastIndex:'',indexProvenance:'',domainMode:'all',maxStates:'250000',maxIndices:'250000',maxMs:'2000',chunkStates:'8192',chunkIndices:'8192',maxCandidates:'1000'};
}
export function storeSessionIdentification(saved,storage){
 readSessionObservations(saved);
 storage.setItem(SESSION_IDENTIFICATION_KEY,JSON.stringify(saved));
}
