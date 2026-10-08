import {classificationNow,classificationDuration,classificationClock,addClassificationDuration} from '../monster-classification-timing.mjs?v=envelope-yield-20261007-0140';
// One bounded aggregate per appearance request. No progress history, timers or
// cross-realm clock subtraction. This never catches the caller's callback.
function retainRequestEnvelope(value,p,status,entryAtMs=null,workerEnvelope=null){try{
 if(!p?.classificationEnvelope||!value||typeof value!=='object')return value;
 value.classificationEnvelopeTiming=structuredClone({...(workerEnvelope??value.classificationEnvelopeTiming??{}),main:{...p.classificationEnvelope,status,...(Number.isFinite(entryAtMs)?{replyHandlerEntryAtMs:entryAtMs,requestToReplyHandlerEntryElapsedMs:classificationDuration(p.classificationEnvelope.requestStartedAtMs,entryAtMs)}:{}),snapshotElapsedMs:classificationDuration(p.classificationEnvelope.requestStartedAtMs)}});
 }catch{}return value;}
import {nativeBodyRequestPayload} from './native-body-request.mjs?v=recognition-20261008-7cf64cf4';
import {RESIDUAL_NATIVE_BODY_BUDGET,RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS} from './residual-native-support.mjs?v=recognition-20261008-7cf64cf4';
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
// A finite nonempty work set can consume its first budget in setup before
// any proposal is visited. Allow its one owned initial continuation only.
// The normal per-slice progress checks below still reject a second zero slice.
const initialNativeSetup=p=>p?.slice===1&&p.jobsTotal>0&&p.laterPlacementPhase===true&&p.firstSweepComplete===false&&p.firstSweepServed===0&&p.totalAttempts===0&&p.totalPreparationSteps===0&&p.totalCompletedVisits===0&&p.totalEmittedPlacementSteps===0&&p.preparationPending===false;
const madeNativeProgress=(next,previous)=>next.firstSweepServed>previous.firstSweepServed||next.totalPreparationSteps>previous.totalPreparationSteps||next.laterPlacementPhase&&(next.totalCompletedVisits>previous.totalCompletedVisits||next.totalEmittedPlacementSteps>previous.totalEmittedPlacementSteps)||!next.laterPlacementPhase&&!next.preparationPending&&next.totalAttempts>previous.totalAttempts;
const continuationAbort=()=>new DOMException('保持フレームの身体比較を中止しました','AbortError');
// One ROM worker owns both its appearance cache and optional source preparations.
export class ResidualRecognitionClient{
 constructor(){this.cancellationVersion=0;this.sequence=0;this.epoch=0;this.worker=null;this.pending=null;this.romSHA=null;this.catalog=null;this.nativeDeadlines=new Map();this.nativeContinuation=null;this.nativeSetupContinuation=null;}
 stopNativeContinuation(state=this.nativeContinuation,terminal={status:'cancelled',reason:'owned-native-continuation-cancelled'}){
  if(!state||this.nativeContinuation!==state)return;
  this.nativeContinuation=null;if(state.timer!==null)clearTimeout(state.timer);
  if(!state.terminalSent){state.terminalSent=true;try{Promise.resolve(state.onTerminal?.({...terminal,progress:structuredClone(state.progress),romEpoch:state.romEpoch,cancellationVersion:state.cancellationVersion})).catch(()=>{});}catch{}}
  const p=this.pending;
  if(p?.nativeContinuation===state){this.pending=null;this.clearPendingTimers(p);try{this.worker?.postMessage({type:'cancel',id:p.id,romEpoch:p.romEpoch});}catch{}p.reject(continuationAbort());}
 }
 scheduleNativeContinuation({request,result,isCurrent,onResult,onProgress,onTerminal,requestSequence=this.sequence}){
  if(typeof isCurrent!=='function'||typeof onResult!=='function')return false;
  const progress=continuationProgress(result),setupOnly=initialNativeSetup(progress);
  if(setupOnly&&this.nativeSetupContinuation?.token===progress.token&&this.nativeSetupContinuation.romEpoch===this.epoch&&this.nativeSetupContinuation.cancellationVersion===this.cancellationVersion)return false;
  if(!needsNativeContinuation(progress)||!(setupOnly||progress.firstSweepServed>0||progress.totalPreparationSteps>0||!progress.preparationPending&&progress.totalAttempts>0)||this.pending||requestSequence!==this.sequence){try{onTerminal?.({status:progress?.hasMore===false?'source-exhausted':this.pending||requestSequence!==this.sequence?'cancelled':'stalled',reason:'no-admissible-owned-continuation',progress:structuredClone(progress)});}catch{}return false;}
  let frozenRequest;try{frozenRequest=structuredClone(nativeBodyRequestPayload(request));}catch{return false;}
  const state={request:frozenRequest,progress,isCurrent,onResult,onProgress,onTerminal,timer:null,cancellationVersion:this.cancellationVersion,romEpoch:this.epoch};
  const check=()=>{if(this.nativeContinuation!==state||this.cancellationVersion!==state.cancellationVersion||this.epoch!==state.romEpoch||!this.worker||state.isCurrent()!==true)throw continuationAbort();};
  state.check=check;this.stopNativeContinuation();this.nativeContinuation=state;
  try{check();if(setupOnly)this.nativeSetupContinuation={token:progress.token,romEpoch:this.epoch,cancellationVersion:this.cancellationVersion};this.queueNativeContinuation(state);return true;}catch{this.stopNativeContinuation(state);return false;}
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
    if(!next||next.token!==previous.token||next.jobsTotal!==previous.jobsTotal||next.slice<=previous.slice||next.firstSweepServed<previous.firstSweepServed||next.totalAttempts<previous.totalAttempts||next.totalPreparationSteps<previous.totalPreparationSteps||next.totalCompletedVisits<previous.totalCompletedVisits||next.totalEmittedPlacementSteps<previous.totalEmittedPlacementSteps||next.laterPlacementPhase!==previous.laterPlacementPhase||!(madeNativeProgress(next,previous)||!next.hasMore&&previous.hasMore)){this.stopNativeContinuation(state,{status:'stalled',reason:'continuation-progress-or-token-validation-failed'});return;}
    state.progress=next;await state.onResult(result);state.check();
    if(needsNativeContinuation(next))this.queueNativeContinuation(state);else this.stopNativeContinuation(state,{status:next.hasMore?'stalled':'source-exhausted',reason:next.hasMore?'unsupported-continuation-domain':'source-domain-exhausted'});
   }catch(error){this.stopNativeContinuation(state,{status:error?.name==='AbortError'?'cancelled':'error',reason:String(error?.message??error)});}
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
  if(p){this.clearPendingTimers(p);p.reject(retainRequestEnvelope(new DOMException('領域比較を中止しました','AbortError'),p,'cancelled'));}
 }
 release(){this.cancel();this.forgetWorker();}
 request(message,transfer=[],onProgress=()=>{},options={}){
  const requestStartedAtMs=classificationNow();
  if(!options.nativeContinuation)this.cancel(false);
  return new Promise((resolve,reject)=>{
   // A queued background callback must never preempt any foreground request.
   if(options.nativeContinuation&&(this.nativeContinuation!==options.nativeContinuation||this.pending)){reject(continuationAbort());return;}
   if(!this.worker){reject(Error('現在のNDSを読み込み直してください'));return;}
   const id='residual-compare-'+(++this.sequence),worker=this.worker,p={id,romEpoch:this.epoch,type:message.type,resolve,reject,onProgress,nativeContinuation:options.nativeContinuation};this.pending=p;
   if(p.type==='recognize')p.classificationEnvelope={schema:'classification-request-envelope-v1',clock:classificationClock('window-main-thread'),requestId:id,romEpoch:this.epoch,requestStartedAtMs,postMessageSyncMs:null,progressHandlerCount:0,progressHandlerSyncMs:0,progressHandlerThrows:0,measurementKind:'async-elapsed-except-explicit-sync-spans',scope:'Request posting, delivery and callback intervals overlap worker elapsed; do not align clock origins or sum as CPU.'};
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
   try{check();if(this.pending===p){const postStarted=classificationNow();try{worker.postMessage({...message,id,romEpoch:this.epoch},transfer);}finally{try{if(p.classificationEnvelope)p.classificationEnvelope.postMessageSyncMs=classificationDuration(postStarted);}catch{}}}}catch(error){if(this.pending===p)this.pending=null;this.clearPendingTimers(p);reject(retainRequestEnvelope(error,p,'post-failed'));}
  });
 }
 async load(rom,sha){
  this.stopNativeContinuation();
  if(this.romSHA===sha&&this.catalog&&this.worker)return this.catalog;
  this.release();const worker=new Worker(new URL('../monster-recognition-worker.mjs?v=temporal-prior-20261008-e462320d',import.meta.url),{type:'module'});this.worker=worker;this.epoch++;
  worker.onmessage=({data:m})=>{
   const handlerEntryAtMs=classificationNow();
   if(this.worker!==worker)return;
   if(m.romEpoch===this.epoch&&['cancelled','error','result'].includes(m.type))this.clearNativeDeadline(m.id);
   if(m.type==='cancelled')return;
   const p=this.pending;if(!p||m.id!==p.id||m.romEpoch!==this.epoch)return;
   if(m.type==='progress'){const started=classificationNow();let returned=false;retainRequestEnvelope(m,p,'progress-before-callback');try{p.onProgress(m);returned=true;}finally{try{if(p.classificationEnvelope){p.classificationEnvelope.progressHandlerCount++;if(!returned)p.classificationEnvelope.progressHandlerThrows++;addClassificationDuration(p.classificationEnvelope,'progressHandlerSyncMs',started);}}catch{}}return;}
   if(m.type==='error'||m.type==='loaded'||m.type==='result'){
    this.pending=null;this.clearPendingTimers(p);
    if(m.type==='error')p.reject(retainRequestEnvelope(Error(m.message),p,'worker-error',handlerEntryAtMs,m.classificationEnvelopeTiming));else{if(m.type==='result')retainRequestEnvelope(m.result,p,'completed',handlerEntryAtMs);p.resolve(m);}
   }
  };
  worker.onerror=e=>{if(this.worker!==worker)return;const p=this.pending;this.pending=null;this.clearPendingTimers(p);this.forgetWorker(worker);p?.reject(retainRequestEnvelope(Error(e.message||'既存ROM比較Workerでエラー'),p,'worker-error-event'));};
  const copy=rom.slice(),answer=await this.request({type:'load',rom:copy.buffer},[copy.buffer]);
  if(this.worker!==worker)throw new DOMException('NDS読込みが中止されました','AbortError');
  this.catalog=new Map(answer.catalog.map(r=>[r.modelId,r.speciesCandidates]));this.romSHA=sha;return this.catalog;
 }
 async classify(request,onProgress){const {residualEvidence,...recognitionRequest}=request;const copy={...recognitionRequest,crop:{...request.crop,rgba:request.crop.rgba.slice()}};const answer=await this.request({type:'recognize',...copy},[copy.crop.rgba.buffer],onProgress);return answer.result;}
 async nativeBodySupport(request,onProgress,{assertCurrent=()=>{},nativeContinuation=null,retainNativeJob=false}={}){
  // Owned asynchronous work is cancelled by its frame/epoch/worker lifecycle,
  // not by the UI optional-result wait. Foreground-only callers retain the deadline.
  // Clone once for the whole region set. Nothing owned by the UI is transferred.
  assertCurrent();const copy=structuredClone(nativeBodyRequestPayload(request));assertCurrent();
  const answer=await this.request({type:'native-body-support',request:copy,budget:{...RESIDUAL_NATIVE_BODY_BUDGET}},[],onProgress,{assertCurrent,nativeContinuation,optionalWaitMs:nativeContinuation||retainNativeJob===true?undefined:RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS});assertCurrent();return answer.result;
 }
}
