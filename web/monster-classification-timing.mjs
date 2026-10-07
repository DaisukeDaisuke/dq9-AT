// Classification-only scalar diagnostics. No timers, promises, inference policy,
// pixel/vector retention or cross-realm absolute-clock arithmetic.
export function classificationNow(){try{const n=performance.now();return Number.isFinite(n)?n:null;}catch{return null;}}
export function classificationDuration(start,end=classificationNow()){return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?end-start:null;}
export function addClassificationDuration(record,key,start){try{const ms=classificationDuration(start);if(ms!==null)record[key]=(record[key]??0)+ms;else record.unavailableMeasurements=(record.unavailableMeasurements??0)+1;}catch{}}
export function classificationClock(domain){let timeOrigin=null;try{if(Number.isFinite(performance.timeOrigin))timeOrigin=performance.timeOrigin;}catch{}return{domain,timeOrigin,unit:'milliseconds',absoluteClocksComparableAcrossDomains:false};}
const primitive=x=>x===null||typeof x==='boolean'||typeof x==='string'&&x.length<=512||typeof x==='number'&&Number.isFinite(x);
function scalarCopy(value,depth=0,budget={remaining:128}){if(budget.remaining--<=0)return undefined;if(primitive(value))return value;if(depth>=5||!value||typeof value!=='object'||ArrayBuffer.isView(value))return undefined;if(Array.isArray(value))return value.slice(0,4).map(v=>scalarCopy(v,depth+1,budget));const out={};for(const[k,v]of Object.entries(value).slice(0,48)){if(budget.remaining<=0)break;if(k.length>96)continue;const x=scalarCopy(v,depth+1,budget);if(x!==undefined)out[k]=x;}return out;}
// The live progress slot is a scalar summary; completed batches retain their
// full timings independently. Drop repeated explanatory/model dictionaries so
// request-envelope boundaries fit the same 128-entry snapshot budget.
function progressTimingSnapshot(event){
 const {timings,classificationEnvelopeTiming,...rest}=event;
 if(!classificationEnvelopeTiming)return scalarCopy(event);
 const compact=timings&&typeof timings==='object'?{}:null;
 if(compact){for(const k of ['elapsedMs','totalMs','backendInitMs','queryMs','templateEmbeddingMs','bodyFitMs','decodeMs','renderMs','persistentReadMs','persistentWriteMs','templateCacheHits','templateCacheMisses','queryCacheHits','queryCacheMisses','renderReferenceHits','renderReferenceMisses','persistentRestored','backendInitialization'])if(timings[k]!==undefined)compact[k]=timings[k];
  if(timings.stageBreakdown){const {kinds,scope,backendInitializationScope,...stages}=timings.stageBreakdown;compact.stageBreakdown=stages;}}
 return scalarCopy({...rest,classificationEnvelopeTiming,timings:compact,summaryScope:'Bounded latest progress; full final timing/model dictionaries stay in completed batches.'});
}
// One record for a retained frozen frame: three preparation spans plus one
// active region/batch and its latest worker progress. Completed timing remains
// in existing batches; no history is added per template or per progress event.
export function recordClassificationTiming(row,event){try{
 if(!row||!event||typeof event!=='object')return;
 const previous=row.classificationTiming;if(previous?.binding&&event.binding&&JSON.stringify(previous.binding)!==JSON.stringify(event.binding)){if(event.kind!=='terminal'||event.state!=='running')return;row.classificationTiming=null;}
 const value=row.classificationTiming??={schema:'residual-classification-timing-v1',diagnosticOnly:true,mainClock:classificationClock('window-main-thread'),preparation:{},latestRegion:null,terminal:null,workerProgressScope:'Latest received aggregate only; subsequent in-flight work may be unfinished or cancelled and is not reconstructed.',scope:'Nested synchronous spans and async elapsed intervals overlap. Do not sum them as CPU time or align absolute clocks across worker/window realms.'};
 if(event.kind==='preparation'&&['rom-worker-load','encounter-tables-read','model-plan'].includes(event.stage))value.preparation[event.stage]=scalarCopy(event);
 else if(event.kind==='region'){const old=value.latestRegion,next=scalarCopy(event);if(old?.regionId===next.regionId&&old?.backend===next.backend&&old?.batch?.index===next?.batch?.index)next.workerProgress=old.workerProgress??null;value.latestRegion=next;if(next.status==='completed')value.lastCompletedRegion={regionId:next.regionId,backend:next.backend,clock:next.clock,elapsedMs:next.elapsedMs,classificationElapsedMsBeforePublication:next.classificationElapsedMsBeforePublication,bundleAndPartialSyncMs:next.bundleAndPartialSyncMs,finalRankingSyncMs:next.finalRankingSyncMs};if(['failed','cancelled'].includes(next.status))value.lastFailedRegion=scalarCopy(next);}
 else if(event.kind==='worker-progress'&&value.latestRegion&&!['failed','cancelled','discarded-stale'].includes(value.terminal?.state)){const next=progressTimingSnapshot(event),old=value.latestRegion.workerProgress;if(next.terminal&&old){next.phase??=old.phase;next.inferencePreparationTiming??=old.inferencePreparationTiming;next.previousProgressRetainedForFailure=true;}value.latestRegion.workerProgress=next;}
 else if(event.kind==='terminal'){const at=classificationNow();value.terminal={...scalarCopy(event),observedAtMs:at,measurementKind:'async-elapsed-not-CPU-time'};if(event.state==='running'){value.runningStartedAtMs=at;value.latestRegion=null;value.lastCompletedRegion=null;value.lastFailedRegion=null;value.preparation={};}if(event.state==='queued-latest')value.queuedAtMs=at;if(['finished','failed','cancelled','discarded-stale','superseded-pending'].includes(event.state)&&Number.isFinite(value.runningStartedAtMs)&&Number.isFinite(at))value.terminal.runningElapsedMs=Math.max(0,at-value.runningStartedAtMs);}
 value.binding=scalarCopy(event.binding??value.binding??null);value.retention={completedRegions:'Existing classificationEvidence batches',maximumLatestRegions:1,maximumLastFailedRegions:1,maximumLastCompletedSummaries:1,maximumPreparationStages:3,perTemplateHistory:false,maximumScalarEntriesPerSnapshot:128,maximumScalarStringLength:512};value.lastObservedAtMs=classificationNow();
 }catch{/* Diagnostics cannot break observation or turn a failure into success. */}}
export function emitClassificationTiming(input,event){try{input.onClassificationTiming?.(event);}catch{}}
