import {nativeBodyRequestPayload} from './native-body-request.mjs?v=native-body-20261006-0212';
import {RESIDUAL_NATIVE_BODY_BUDGET,RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS} from './residual-native-support.mjs?v=native-body-20261006-0212';
// One ROM worker owns both its appearance cache and optional source preparations.
export class ResidualRecognitionClient{
 constructor(){this.cancellationVersion=0;this.sequence=0;this.epoch=0;this.worker=null;this.pending=null;this.romSHA=null;this.catalog=null;this.nativeDeadlines=new Map();}
 clearNativeDeadline(id){const p=this.nativeDeadlines.get(id);if(p){clearTimeout(p.watchdog);this.nativeDeadlines.delete(id);}}
 clearPendingTimers(p){if(p)this.clearNativeDeadline(p.id);if(p?.currentGuard!==undefined)clearInterval(p.currentGuard);}
 forgetWorker(worker=this.worker){if(this.worker!==worker)return;worker?.terminate();for(const id of this.nativeDeadlines.keys())this.clearNativeDeadline(id);this.worker=null;this.romSHA=null;this.catalog=null;}
 cancel(invalidateJob=true){
  if(invalidateJob)this.cancellationVersion++;
  const p=this.pending;this.pending=null;
  if(p)this.worker?.postMessage({type:'cancel',id:p.id,romEpoch:p.romEpoch});
  if(p){this.clearPendingTimers(p);p.reject(new DOMException('領域比較を中止しました','AbortError'));}
 }
 release(){this.cancel();this.forgetWorker();}
 request(message,transfer=[],onProgress=()=>{},options={}){
  this.cancel(false);
  return new Promise((resolve,reject)=>{
   if(!this.worker){reject(Error('現在のNDSを読み込み直してください'));return;}
   const id='residual-compare-'+(++this.sequence),worker=this.worker,p={id,romEpoch:this.epoch,type:message.type,resolve,reject,onProgress};this.pending=p;
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
     p.reject(Error('Native body optional response wait expired; unfinished support remains unknown (cooperative work may finish later)'));
    },options.optionalWaitMs);
   }
   try{check();if(this.pending===p)worker.postMessage({...message,id,romEpoch:this.epoch},transfer);}catch(error){if(this.pending===p)this.pending=null;this.clearPendingTimers(p);reject(error);}
  });
 }
 async load(rom,sha){
  if(this.romSHA===sha&&this.catalog&&this.worker)return this.catalog;
  this.release();const worker=new Worker(new URL('../monster-recognition-worker.mjs?v=native-body-20261006-0212',import.meta.url),{type:'module'});this.worker=worker;this.epoch++;
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
 async nativeBodySupport(request,onProgress,{assertCurrent=()=>{}}={}){
  // Clone once for the whole region set. Nothing owned by the UI is transferred.
  assertCurrent();const copy=structuredClone(nativeBodyRequestPayload(request));assertCurrent();
  const answer=await this.request({type:'native-body-support',request:copy,budget:{...RESIDUAL_NATIVE_BODY_BUDGET}},[],onProgress,{assertCurrent,optionalWaitMs:RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS});assertCurrent();return answer.result;
 }
}
