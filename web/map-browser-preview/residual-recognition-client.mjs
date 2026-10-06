import {nativeBodyRequestPayload} from './native-body-request.mjs?v=native-yaw-mse-20261006-2101';
import {RESIDUAL_NATIVE_BODY_BUDGET,RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS} from './residual-native-support.mjs?v=native-yaw-mse-20261006-2101';
// First-sweep progress is work coverage, never a recognition/pose certificate.
const continuationProgress=result=>{
 const value=result?.continuation;
 if(value?.kind!=='same-frozen-native-job'||typeof value.token!=='string'||!value.token.length)return null;
 if(!['firstSweepServed','jobsTotal','slice','totalAttempts'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0))return null;
 if(value.firstSweepServed>value.jobsTotal||typeof value.firstSweepComplete!=='boolean'||typeof value.hasMore!=='boolean')return null;
 const totalPreparationSteps=value.totalPreparationSteps??0;if(!Number.isSafeInteger(totalPreparationSteps)||totalPreparationSteps<0||value.preparationPending!==undefined&&typeof value.preparationPending!=='boolean')return null;
 const laterPlacementPhase=value.laterPlacementPhase==='source-native-emitted-envelope-v1',totalCompletedVisits=value.totalCompletedVisits??0,totalEmittedPlacementSteps=value.totalEmittedPlacementSteps??0;if(![totalCompletedVisits,totalEmittedPlacementSteps].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
 return{...value,totalPreparationSteps,totalCompletedVisits,totalEmittedPlacementSteps,laterPlacementPhase,preparationPending:value.preparationPending===true};
};
const needsNativeContinuation=p=>p&&p.hasMore===true&&(p.firstSweepComplete===false&&p.firstSweepServed<p.jobsTotal||p.firstSweepComplete===true&&p.laterPlacementPhase);
const madeNativeProgress=(next,previous)=>next.firstSweepServed>previous.firstSweepServed||next.totalPreparationSteps>previous.totalPreparationSteps||next.laterPlacementPhase&&(next.totalCompletedVisits>previous.totalCompletedVisits||next.totalEmittedPlacementSteps>previous.totalEmittedPlacementSteps)||!next.laterPlacementPhase&&!next.preparationPending&&next.totalAttempts>previous.totalAttempts;
const continuationAbort=()=>new DOMException('保持フレームの身体比較を中止しました','AbortError');
// One ROM worker owns both its appearance cache and optional source preparations.
export class ResidualRecognitionClient{
 constructor(){this.cancellationVersion=0;this.sequence=0;this.epoch=0;this.worker=null;this.pending=null;this.romSHA=null;this.catalog=null;this.nativeDeadlines=new Map();this.nativeContinuation=null;}
 stopNativeContinuation(state=this.nativeContinuation){
  if(!state||this.nativeContinuation!==state)return;
  this.nativeContinuation=null;if(state.timer!==null)clearTimeout(state.timer);
  const p=this.pending;
  if(p?.nativeContinuation===state){this.pending=null;this.clearPendingTimers(p);try{this.worker?.postMessage({type:'cancel',id:p.id,romEpoch:p.romEpoch});}catch{}p.reject(continuationAbort());}
 }
 scheduleNativeContinuation({request,result,isCurrent,onResult,onProgress,requestSequence=this.sequence}){
  if(typeof isCurrent!=='function'||typeof onResult!=='function')return false;
  const progress=continuationProgress(result);
  if(!needsNativeContinuation(progress)||!(progress.firstSweepServed>0||progress.totalPreparationSteps>0||!progress.preparationPending&&progress.totalAttempts>0)||this.pending||requestSequence!==this.sequence)return false;
  let frozenRequest;try{frozenRequest=structuredClone(nativeBodyRequestPayload(request));}catch{return false;}
  const state={request:frozenRequest,progress,isCurrent,onResult,onProgress,timer:null,cancellationVersion:this.cancellationVersion,romEpoch:this.epoch};
  const check=()=>{if(this.nativeContinuation!==state||this.cancellationVersion!==state.cancellationVersion||this.epoch!==state.romEpoch||!this.worker||state.isCurrent()!==true)throw continuationAbort();};
  state.check=check;this.stopNativeContinuation();this.nativeContinuation=state;
  try{check();this.queueNativeContinuation(state);return true;}catch{this.stopNativeContinuation(state);return false;}
 }
 queueNativeContinuation(state){
  // Each slice yields a task boundary. A foreground request always cancels this
  // retained schedule and its matching request, leaving shared caches loaded.
  state.timer=setTimeout(async()=>{
   state.timer=null;
   try{
    state.check();if(this.pending){this.stopNativeContinuation(state);return;}
    const result=await this.nativeBodySupport({...state.request,continuationToken:state.progress.token},state.onProgress,{assertCurrent:state.check,nativeContinuation:state});
    state.check();const next=continuationProgress(result),previous=state.progress;
    if(!next||next.token!==previous.token||next.jobsTotal!==previous.jobsTotal||next.slice<=previous.slice||next.firstSweepServed<previous.firstSweepServed||next.totalAttempts<previous.totalAttempts||next.totalPreparationSteps<previous.totalPreparationSteps||next.totalCompletedVisits<previous.totalCompletedVisits||next.totalEmittedPlacementSteps<previous.totalEmittedPlacementSteps||next.laterPlacementPhase!==previous.laterPlacementPhase||!(madeNativeProgress(next,previous)||!next.hasMore&&previous.hasMore)){this.stopNativeContinuation(state);return;}
    state.progress=next;state.onResult(result);state.check();
    if(needsNativeContinuation(next))this.queueNativeContinuation(state);else this.stopNativeContinuation(state);
   }catch{this.stopNativeContinuation(state);}
   // Optional failures end this schedule. Keep the last successful evidence;
   // do not retry an expired/error slice or terminate the worker for it.
  },0);
 }
 clearNativeDeadline(id){const p=this.nativeDeadlines.get(id);if(p){clearTimeout(p.watchdog);this.nativeDeadlines.delete(id);}}
 clearPendingTimers(p){if(p)this.clearNativeDeadline(p.id);if(p?.currentGuard!==undefined)clearInterval(p.currentGuard);}
 forgetWorker(worker=this.worker){if(this.worker!==worker)return;this.stopNativeContinuation();worker?.terminate();for(const id of this.nativeDeadlines.keys())this.clearNativeDeadline(id);this.worker=null;this.romSHA=null;this.catalog=null;}
 cancel(invalidateJob=true){
  if(invalidateJob)this.cancellationVersion++;
  this.stopNativeContinuation();
  const p=this.pending;this.pending=null;
  if(p)this.worker?.postMessage({type:'cancel',id:p.id,romEpoch:p.romEpoch});
  if(p){this.clearPendingTimers(p);p.reject(new DOMException('領域比較を中止しました','AbortError'));}
 }
 release(){this.cancel();this.forgetWorker();}
 request(message,transfer=[],onProgress=()=>{},options={}){
  if(!options.nativeContinuation)this.cancel(false);
  return new Promise((resolve,reject)=>{
   // A queued background callback must never preempt any foreground request.
   if(options.nativeContinuation&&(this.nativeContinuation!==options.nativeContinuation||this.pending)){reject(continuationAbort());return;}
   if(!this.worker){reject(Error('現在のNDSを読み込み直してください'));return;}
   const id='residual-compare-'+(++this.sequence),worker=this.worker,p={id,romEpoch:this.epoch,type:message.type,resolve,reject,onProgress,nativeContinuation:options.nativeContinuation};this.pending=p;
   const check=()=>{if(this.pending!==p)return;try{options.assertCurrent?.();}catch{this.cancel();}};
   if(options.assertCurrent)p.currentGuard=setInterval(check,50);
   if(options.optionalWaitMs){
    this.nativeDeadlines.set(id,p);p.watchdog=setTimeout(()=>{
     if(this.nativeDeadlines.get(id)!==p)return;
     this.clearPendingTimers(p);
     if(this.pending!==p||this.worker!==worker||this.epoch!==p.romEpoch)return;
     this.pending=null;
     // This expires optional evidence only. Main-thread delivery may be late;
     // never destroy the shared DINO/source caches or reject a newer request.
     try{worker.postMessage({type:'cancel',id:p.id,romEpoch:p.romEpoch});}catch{}
     p.reject(Error('Native body optional response wait expired; cancellation requested, unfinished support remains unknown'));
    },options.optionalWaitMs);
   }
   try{check();if(this.pending===p)worker.postMessage({...message,id,romEpoch:this.epoch},transfer);}catch(error){if(this.pending===p)this.pending=null;this.clearPendingTimers(p);reject(error);}
  });
 }
 async load(rom,sha){
  this.stopNativeContinuation();
  if(this.romSHA===sha&&this.catalog&&this.worker)return this.catalog;
  this.release();const worker=new Worker(new URL('../monster-recognition-worker.mjs?v=native-yaw-mse-20261006-2101',import.meta.url),{type:'module'});this.worker=worker;this.epoch++;
  worker.onmessage=({data:m})=>{
   if(this.worker!==worker)return;
   if(m.romEpoch===this.epoch&&['cancelled','error','result'].includes(m.type))this.clearNativeDeadline(m.id);
   if(m.type==='cancelled')return;
   const p=this.pending;if(!p||m.id!==p.id||m.romEpoch!==this.epoch)return;
   if(m.type==='progress'){p.onProgress(m);return;}
   if(m.type==='error'||m.type==='loaded'||m.type==='result'){
    this.pending=null;this.clearPendingTimers(p);
    if(m.type==='error')p.reject(Error(m.message));else p.resolve(m);
   }
  };
  worker.onerror=e=>{if(this.worker!==worker)return;const p=this.pending;this.pending=null;this.clearPendingTimers(p);this.forgetWorker(worker);p?.reject(Error(e.message||'既存ROM比較Workerでエラー'));};
  const copy=rom.slice(),answer=await this.request({type:'load',rom:copy.buffer},[copy.buffer]);
  if(this.worker!==worker)throw new DOMException('NDS読込みが中止されました','AbortError');
  this.catalog=new Map(answer.catalog.map(r=>[r.modelId,r.speciesCandidates]));this.romSHA=sha;return this.catalog;
 }
 async classify(request,onProgress){const {residualEvidence,...recognitionRequest}=request;const copy={...recognitionRequest,crop:{...request.crop,rgba:request.crop.rgba.slice()}};const answer=await this.request({type:'recognize',...copy},[copy.crop.rgba.buffer],onProgress);return answer.result;}
 async nativeBodySupport(request,onProgress,{assertCurrent=()=>{},nativeContinuation=null}={}){
  // Clone once for the whole region set. Nothing owned by the UI is transferred.
  assertCurrent();const copy=structuredClone(nativeBodyRequestPayload(request));assertCurrent();
  const answer=await this.request({type:'native-body-support',request:copy,budget:{...RESIDUAL_NATIVE_BODY_BUDGET}},[],onProgress,{assertCurrent,nativeContinuation,optionalWaitMs:RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS});assertCurrent();return answer.result;
 }
}
