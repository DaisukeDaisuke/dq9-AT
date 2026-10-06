import {searchAutomaticReplayInputs} from './video-replay-factor-search.mjs?v=automatic-entry-factors-20261006-1120';
import {compileTrackingObservations} from './tracking-at-observation-adapter.mjs?v=native-tracking-ownership-20261006-1006';
import {fingerprint} from './tracking-at-runner.mjs?v=field-stream-20261005-1108';
const need=(v,m)=>{if(!v)throw Error(m);};
// Call directly from the completed, immutable continuous-bundle callback.
// This hook accepts only explicit bounded search options; it invents no prior.
export async function prepareTrackingJob(bundle,options,{engineRevision,observationRevision}){
 const prepared=compileTrackingObservations(bundle,options),romSHA256=bundle.source?.background?.romSHA256;
 need(/^[a-f0-9]{64}$/.test(romSHA256??''),'ROM identity missing');need(typeof engineRevision==='string'&&engineRevision.length,'Engine revision missing');
 const identity={bundleSHA256:await fingerprint(bundle),romSHA256,engineRevision,observationRevision,tablesSHA256:await fingerprint(options.tables??{})};
 return {replayInputHypotheses:await searchAutomaticReplayInputs(bundle),nativeBodySupportEvidence:prepared.nativeBodySupportEvidence,checkpointKey:await fingerprint({request:prepared.request,identity}),request:prepared.request,identity,gate:prepared.gate,missingEvidence:prepared.missingEvidence};
}
// Browser transaction completion is the ACK boundary; request success alone is
// not ACK. IndexedDB availability/quota failure is surfaced, never hidden.
export async function openTrackingCheckpointStore(name='dq9-tracking-at-v1'){
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>q.result.createObjectStore('checkpoints');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 return {load:key=>new Promise((resolve,reject)=>{const tx=db.transaction('checkpoints','readonly'),q=tx.objectStore('checkpoints').get(key);let value; q.onsuccess=()=>{value=q.result??null;};tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(tx.error??q.error);}),save:(key,value)=>new Promise((resolve,reject)=>{const tx=db.transaction('checkpoints','readwrite');const bucket=tx.objectStore('checkpoints'),read=bucket.get(key);let conflict=null;read.onsuccess=()=>{const old=read.result;if(old&&(old.inputHash!==value.inputHash||old.sequence+1!==value.sequence)){if(old.checksum===value.checksum)return;conflict=Error('Concurrent or stale checkpoint write; reload last ACK');tx.abort();return;}if(!old&&value.sequence!==1){conflict=Error('Missing predecessor ACK');tx.abort();return;}bucket.put(structuredClone(value),key);};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(conflict??tx.error??Error('Checkpoint transaction failed'));}),close:()=>db.close()};
}
// Each start gets its own Worker and run token. A previous revision never updates
// a new session. Cancel terminates immediately; last completed host ACK survives.
export function startTrackingSession({job,wasmBytes,resume=null,store,checkpointKey,onProgress=()=>{}}){
 checkpointKey??=job.checkpointKey;need(checkpointKey===job.checkpointKey,'Use the hashed job checkpoint key');const runId=crypto.randomUUID(),worker=new Worker(new URL('./tracking-at-worker.mjs?v=field-stream-20261005-1108',import.meta.url),{type:'module'});let stopped=false,lastAcknowledged=resume,resolveDone,rejectDone;
 const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
 const stop=()=>{stopped=true;worker.terminate();};
 worker.onerror=e=>{if(!stopped){stop();rejectDone(Error(e.message??'AT Worker failed'));}};
 worker.onmessage=async({data})=>{if(stopped||data.runId!==runId)return;
  if(data.type==='persist'){try{await store.save(checkpointKey,data.checkpoint);lastAcknowledged=data.checkpoint;if(!stopped)worker.postMessage({type:'persisted',runId,sequence:data.checkpoint.sequence});}catch(e){if(!stopped)worker.postMessage({type:'persist-failed',runId,sequence:data.checkpoint.sequence,message:e.message});}return;}
  if(data.type==='progress'){onProgress(data.progress);return;}
  if(data.type==='result'){stop();resolveDone(data.result);}else if(data.type==='error'){stop();rejectDone(Error(data.message));}
 };
 worker.postMessage({type:'run',runId,args:{request:job.request,identity:job.identity,wasmBytes,resume}});
 return {done,cancel(){if(!stopped){stop();resolveDone({status:'cancelled',checkpoint:structuredClone(lastAcknowledged),scope:'Only last completed host ACK is reusable; load the store again after any in-flight transaction settles.'});}},get lastAcknowledged(){return structuredClone(lastAcknowledged);}};
}
