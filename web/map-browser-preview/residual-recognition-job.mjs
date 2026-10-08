import {waitForOptionalNativeResult} from './native-optional-result.mjs?v=native-async-20261008-43d9a67a';
import {classificationNow,classificationDuration,classificationClock,emitClassificationTiming} from '../monster-classification-timing.mjs?v=envelope-yield-20261007-0140';
import {nativeBodyRequestPayload} from './native-body-request.mjs?v=recognition-20261008-7cf64cf4';
import {attachResidualNativeSupport,RESIDUAL_NATIVE_BODY_BUDGET,RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS} from './residual-native-support.mjs?v=recognition-20261008-7cf64cf4';
import {chooseResidualBackend,residualBackendProvenance,assertResidualBackendResult} from './residual-recognition-backend.mjs?v=envelope-yield-20261007-0140';
import {residualClassificationRequest,residualObservationBundle} from './residual-recognition-input.mjs?v=conditional-ui-20261007-0257';
// Claim a queued frame's native-only destination while its one-frame mailbox
// still exists. The background used by appearance/export remains unchanged.
function nativeBackgroundBinding(payload){
 const bg=payload.backgroundEvidence,support=bg?.backgroundBranchSupport;
 const backgroundEvidence=support?{...bg,backgroundBranchSupport:{...support,branches:support.branches.map(({nativeBodyDestinationReuse,...branch})=>branch)}}:bg;
 return JSON.stringify({videoEvidence:payload.videoEvidence,backgroundEvidence});
}
export function captureResidualNativeBackground(input){
 try{const payload=nativeBodyRequestPayload(input);return{kind:'frozen-residual-native-background-v1',videoEvidence:structuredClone(payload.videoEvidence),backgroundEvidence:structuredClone(payload.backgroundEvidence)};}
 catch(error){return{kind:'frozen-residual-native-background-v1',error:{name:error?.name??'Error',message:String(error?.message??error)}};}
}
// A job is all requested regions and all model batches for one frozen frame.
// On GPU failure, discard the entire attempt, clear its displayed partials, and
// start at region zero under WASM. Never sort/merge scores across model hashes.
export async function runResidualRecognitionJob({input,plan,variant,client,preference='wasm',assertCurrent=()=>{},choose=chooseResidualBackend,makeRequest=residualClassificationRequest,makeBundle=residualObservationBundle}){
 const cancellationVersion=client.cancellationVersion,romEpoch=client.epoch;
 const identity=()=>{const v=input.videoEvidence,b=input.backgroundEvidence;return JSON.stringify([b?.romSHA256,b?.recordKey,v?.sourceId,v?.sourceEpoch,v?.timelineSegment,v?.frameSerial,v?.mediaTime??v?.videoTime,v?.fullRGBA_SHA256,input.regionIds]);};
 const frozenIdentity=identity(),frozenBackground=input.backgroundEvidence,frozenVideo=input.nativeVideo,frozenComparison=input.nativeComparison;
 const checkFrozen=()=>{if(client.cancellationVersion!==cancellationVersion||client.epoch!==romEpoch||identity()!==frozenIdentity||input.backgroundEvidence!==frozenBackground||input.nativeVideo!==frozenVideo||input.nativeComparison!==frozenComparison)throw new DOMException('領域比較を中止しました','AbortError');};
 const check=()=>{assertCurrent();checkFrozen();};
 const nativeCurrent=()=>{checkFrozen();return input.isNativeCurrent?.()===true;};
 const modelIds=plan.models.map(m=>m.modelId);if(!modelIds.length)throw Error('同frameのmap/table候補からROMモデルを供給できません: '+JSON.stringify(plan.unsupported));
 // Claim the native-only background payload while this frozen appearance job
 // owns a current handoff. Later playback/name-unresolved searches may replace
 // the one-frame mailbox while DINO runs. Keep only this job's exact snapshot;
 // never put its planes into appearance bundles or extend mailbox lifetime.
 let nativeBackgroundEvidence=null,nativeBackgroundCaptureError=null;
 check();try{
  const current=nativeBodyRequestPayload({videoEvidence:input.videoEvidence,backgroundEvidence:frozenBackground,nativeComparison:frozenComparison}),snapshot=input.nativeBackgroundSnapshot;
  if(snapshot){
   if(snapshot.kind!=='frozen-residual-native-background-v1')throw Error('Frozen native background snapshot kind differs');
   if(snapshot.error)throw Object.assign(new Error(snapshot.error.message),{name:snapshot.error.name});
   const retained=nativeBodyRequestPayload({videoEvidence:snapshot.videoEvidence,backgroundEvidence:snapshot.backgroundEvidence,nativeComparison:frozenComparison});
   if(nativeBackgroundBinding(retained)!==nativeBackgroundBinding(current))throw Error('Frozen native background snapshot differs from appearance input');
   nativeBackgroundEvidence=structuredClone(retained.backgroundEvidence);
  }else nativeBackgroundEvidence=structuredClone(current.backgroundEvidence);
 }catch(error){if(error.name==='AbortError')throw error;nativeBackgroundCaptureError=error;}check();
 const selection=await choose({preference,assertCurrent:check});check();let fallback=null;
 const attempt=async backend=>{
  const classifications=[],provenance=residualBackendProvenance(backend);
  check();input.onProgress?.({phase:'backend-selected',message:backend==='webgpu'?'保存済みWebGPU / fp16モデルで全領域を比較します（int8とは別の距離です）。':'CPU/WASM / int8固定基準で全領域を比較します。'});
  const bundle=complete=>({...makeBundle({...input,plan,classifications}),classificationJob:{complete,requestedRegionIds:input.regionIds,completed:classifications.length,requestedBackend:preference,selectionReason:selection.reason,backend:provenance,fallback}});
  for(const regionId of input.regionIds){check();const region=input.regions.find(r=>r.id===regionId);if(!region)throw Error('元残差領域が変わりました');let sourceROI=null,cropSHA256=null;const batches=[],rankings=[];const regionStarted=classificationNow(),regionTiming={clock:classificationClock('window-main-thread'),kind:'async-elapsed-not-CPU-time',regionId,backend,status:'running',startedAtMs:regionStarted,scope:'Main-thread elapsed includes preparation, hash, worker delivery and partial publication; it overlaps worker stages and concurrent background work, and is not CPU occupancy.'};let batchTiming=null,regionComplete=false;const reportRegion=()=>emitClassificationTiming(input,{...regionTiming,kind:'region',measurementKind:'async-elapsed-not-CPU-time',batch:batchTiming});reportRegion();try{
   for(let first=0;first<modelIds.length;first+=4){check();const batchStarted=classificationNow();batchTiming={index:first/4,modelIds:modelIds.slice(first,first+4),status:'preparing',startedAtMs:batchStarted};reportRegion();let request;const prepareStarted=classificationNow();try{request=makeRequest({...input,gameplayROI:input.videoEvidence.roi,region,modelIds:modelIds.slice(first,first+4),variant,romEpoch:client.epoch,inferenceBackend:backend});}finally{batchTiming.requestPreparationSyncMs=classificationDuration(prepareStarted);}sourceROI=request.captureStamp.enemyROI;
    const cropHashStarted=classificationNow();try{cropSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.crop.rgba)),x=>x.toString(16).padStart(2,'0')).join('');}finally{batchTiming.cropHashElapsedMs=classificationDuration(cropHashStarted);}check();batchTiming.status='worker-pending';reportRegion();
    let result;const classifyStarted=classificationNow();try{result=await client.classify(request,p=>{emitClassificationTiming(input,{kind:'worker-progress',regionId,backend,batchIndex:first/4,workerRequestId:p.id??null,workerRomEpoch:p.romEpoch??null,phase:p.phase??null,timings:p.timings??null,inferencePreparationTiming:p.inferencePreparationTiming??null,terminal:p.classificationTimingTerminal??null,classificationEnvelopeTiming:p.classificationEnvelopeTiming??null});if(!p.diagnosticOnly)input.onProgress?.(p);});check();assertResidualBackendResult(result,backend);}catch(error){batchTiming.status=error?.name==='AbortError'?'cancelled':'failed';batchTiming.reason=String(error?.message??error);try{if(error?.classificationEnvelopeTiming)batchTiming.classificationEnvelopeTiming=error.classificationEnvelopeTiming;}catch{}check();if(error?.name==='AbortError')throw error;throw Object.assign(new Error(String(error?.message??error)),{backendAttemptFailed:true});}finally{batchTiming.workerRoundTripElapsedMs=classificationDuration(classifyStarted);batchTiming.elapsedMs=classificationDuration(batchStarted);reportRegion();}batchTiming.status='completed';
    batches.push({...result,residualBatchTiming:{...batchTiming,clock:regionTiming.clock,kind:'async-elapsed-not-CPU-time',requestPreparationKind:'synchronous-span',workerRoundTripScope:'Awaited request/reply elapsed including message queues and main-thread delivery; not exclusive worker execution.'},rankings:result.rankings.map(({thumbnail,...r})=>r)});rankings.push(...result.rankings.map(({thumbnail,...r})=>r));
   }
   const comparisonStarted=classificationNow();rankings.sort((a,b)=>a.distance-b.distance||a.modelId.localeCompare(b.modelId));regionTiming.finalRankingSyncMs=classificationDuration(comparisonStarted);regionTiming.status='classified-before-partial-publication';regionTiming.classificationElapsedMsBeforePublication=classificationDuration(regionStarted);if(batches[0])batches[0].residualRegionTiming=regionTiming;classifications.push({regionId,sourceROI,cropSHA256,batches,rankings});check();const partialStarted=classificationNow();try{input.onPartial?.(bundle(false));}finally{regionTiming.bundleAndPartialSyncMs=classificationDuration(partialStarted);}regionComplete=true;
  }catch(error){regionTiming.status=error?.name==='AbortError'?'cancelled':'failed';regionTiming.reason=String(error?.message??error);throw error;}finally{if(regionComplete)regionTiming.status='completed';regionTiming.elapsedMs=classificationDuration(regionStarted);reportRegion();}
  }
  check();return bundle(true);
 };
 let appearance;try{appearance=await attempt(selection.backend);}catch(error){check();if(selection.backend!=='webgpu'||!error.backendAttemptFailed)throw error;
  fallback={from:'webgpu',to:'wasm',reason:error.message,discardedEntireAttempt:true};
  input.onPartial?.({...makeBundle({...input,plan,classifications:[]}),classificationJob:{complete:false,requestedRegionIds:input.regionIds,completed:0,requestedBackend:preference,selectionReason:selection.reason,backend:residualBackendProvenance('wasm'),fallback}});
  check();input.onProgress?.({phase:'backend-restart',message:'GPU比較を破棄し、全領域をCPU/WASM int8で最初から比較します。'});appearance=await attempt('wasm');
 }
 check();
 // All old region partials and the completed appearance bundle are visible
 // before the first additive native slice, including after a GPU restart.
 input.onPartial?.(appearance);check();
 input.onProgress?.({phase:'native-body-support',message:`全領域まとめてROM身体の条件付き支持を比較します（目安${RESIDUAL_NATIVE_BODY_BUDGET.wallTimeMs} ms / 最大${RESIDUAL_NATIVE_BODY_BUDGET.maxProposals}提案、同期処理の時間上限は保証せず、未探索は不明のまま）。`});
 let nativeResult=null,nativeError=null,nativeRequest=null,nativeRequestSequence;
 const detachable=typeof input.isNativeCurrent==='function'&&typeof input.onNativePartial==='function'&&typeof client.scheduleNativeContinuation==='function';
 const onNativePartial=input.onNativePartial;
 let retainedAppearance=null,retainedInput=null;
 const checkNative=()=>{if(!nativeCurrent())throw new DOMException('保持フレームの身体比較を中止しました','AbortError');};
 const startContinuation=result=>{
  if(!result||!detachable)return;
  try{client.scheduleNativeContinuation({request:nativeRequest,result,requestSequence:nativeRequestSequence,isCurrent:nativeCurrent,onResult:value=>{if(nativeCurrent())onNativePartial(attachResidualNativeSupport(retainedAppearance,{input:retainedInput,result:value}));}});}catch{/* Optional setup cannot discard successful evidence. */}
 };
 const publishLate=outcome=>{
  try{
   if(!nativeCurrent())return;
   if(outcome.status==='error'&&outcome.error?.name==='AbortError')return;
   onNativePartial(attachResidualNativeSupport(retainedAppearance,{input:retainedInput,result:outcome.result??null,error:outcome.error??null}));
   if(nativeCurrent())startContinuation(outcome.result);
  }catch{/* Cancelled/replaced optional work cannot update another frame. */}
 };
 try{
  if(typeof client.nativeBodySupport!=='function')throw Error('Automatic native body worker unavailable');
  if(nativeBackgroundCaptureError)throw nativeBackgroundCaptureError;
  nativeRequest=structuredClone(nativeBodyRequestPayload({videoEvidence:input.videoEvidence,backgroundEvidence:nativeBackgroundEvidence,nativeVideo:input.nativeVideo,nativeComparison:input.nativeComparison,regions:input.regionIds.map(id=>input.regions.find(region=>region.id===id)),candidates:plan.models,variant,appearancePoseHints:{romSHA256:input.backgroundEvidence.romSHA256,frame:input.videoEvidence,regions:appearance.sightings.map(s=>({regionId:s.originalProposalId,candidates:(s.classificationEvidence?.[0]?.rankings??[]).map(r=>({modelId:r.modelId,bestPose:r.bestPose}))}))}}));
  if(detachable){retainedAppearance=structuredClone(appearance);retainedInput={regionIds:[...input.regionIds],regions:nativeRequest.regions,videoEvidence:nativeRequest.videoEvidence,backgroundEvidence:nativeRequest.backgroundEvidence};}
  const pending=client.nativeBodySupport(nativeRequest,input.onProgress,{assertCurrent:detachable?checkNative:check,retainNativeJob:detachable});nativeRequestSequence=client.sequence;
  if(detachable){
   const outcome=await waitForOptionalNativeResult(pending,RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS);check();
   if(outcome.status==='pending'){
    // Publish appearance/unknown support now; the exact owned job continues.
    // Late completion uses its retained frame and can start the usual slices.
    // Publish on a later task so the caller commits its initial pending
    // snapshot first, even if source completion races this wait boundary.
    outcome.settled.then(value=>setTimeout(()=>publishLate(value),0));
    const first=attachResidualNativeSupport(appearance,{input});
    return {...first,nativeBodyWork:{status:'pending',optionalDisplayWaitExpired:true,identityCertified:false,minimumProvenATCalls:0}};
   }
   if(outcome.status==='error')throw outcome.error;
   nativeResult=outcome.result;
  }else nativeResult=await pending;
  check();
 }catch(error){check();if(error?.name==='AbortError')throw error;nativeError=error;}
 check();
 const first=attachResidualNativeSupport(appearance,{input,result:nativeResult,error:nativeError});
 startContinuation(nativeResult);
 return first;
}
