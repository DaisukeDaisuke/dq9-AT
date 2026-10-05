import {attachResidualNativeSupport,RESIDUAL_NATIVE_BODY_BUDGET} from './residual-native-support.mjs?v=native-body-20261006-0212';
import {chooseResidualBackend,residualBackendProvenance,assertResidualBackendResult} from './residual-recognition-backend.mjs';
import {residualClassificationRequest,residualObservationBundle} from './residual-recognition-input.mjs?v=native-body-20261006-0212';
// A job is all requested regions and all model batches for one frozen frame.
// On GPU failure, discard the entire attempt, clear its displayed partials, and
// start at region zero under WASM. Never sort/merge scores across model hashes.
export async function runResidualRecognitionJob({input,plan,variant,client,preference='wasm',assertCurrent=()=>{},choose=chooseResidualBackend,makeRequest=residualClassificationRequest,makeBundle=residualObservationBundle}){
 const cancellationVersion=client.cancellationVersion,romEpoch=client.epoch;
 const identity=()=>{const v=input.videoEvidence,b=input.backgroundEvidence;return JSON.stringify([b?.romSHA256,b?.recordKey,v?.sourceId,v?.sourceEpoch,v?.timelineSegment,v?.frameSerial,v?.mediaTime??v?.videoTime,v?.fullRGBA_SHA256,input.regionIds]);};
 const frozenIdentity=identity(),frozenBackground=input.backgroundEvidence,frozenVideo=input.nativeVideo,frozenComparison=input.nativeComparison;
 const check=()=>{assertCurrent();if(client.cancellationVersion!==cancellationVersion||client.epoch!==romEpoch||identity()!==frozenIdentity||input.backgroundEvidence!==frozenBackground||input.nativeVideo!==frozenVideo||input.nativeComparison!==frozenComparison)throw new DOMException('領域比較を中止しました','AbortError');};
 const modelIds=plan.models.map(m=>m.modelId);if(!modelIds.length)throw Error('同frameのmap/table候補からROMモデルを供給できません: '+JSON.stringify(plan.unsupported));
 const selection=await choose({preference,assertCurrent:check});check();let fallback=null;
 const attempt=async backend=>{
  const classifications=[],provenance=residualBackendProvenance(backend);
  check();input.onProgress?.({phase:'backend-selected',message:backend==='webgpu'?'保存済みWebGPU / fp16モデルで全領域を比較します（int8とは別の距離です）。':'CPU/WASM / int8固定基準で全領域を比較します。'});
  const bundle=complete=>({...makeBundle({...input,plan,classifications}),classificationJob:{complete,requestedRegionIds:input.regionIds,completed:classifications.length,requestedBackend:preference,selectionReason:selection.reason,backend:provenance,fallback}});
  for(const regionId of input.regionIds){check();const region=input.regions.find(r=>r.id===regionId);if(!region)throw Error('元残差領域が変わりました');let sourceROI=null,cropSHA256=null;const batches=[],rankings=[];
   for(let first=0;first<modelIds.length;first+=4){check();const request=makeRequest({...input,gameplayROI:input.videoEvidence.roi,region,modelIds:modelIds.slice(first,first+4),variant,romEpoch:client.epoch,inferenceBackend:backend});sourceROI=request.captureStamp.enemyROI;
    cropSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.crop.rgba)),x=>x.toString(16).padStart(2,'0')).join('');check();
    let result;try{result=await client.classify(request,input.onProgress);check();assertResidualBackendResult(result,backend);}catch(error){check();if(error?.name==='AbortError')throw error;throw Object.assign(new Error(String(error?.message??error)),{backendAttemptFailed:true});}
    batches.push({...result,rankings:result.rankings.map(({thumbnail,...r})=>r)});rankings.push(...result.rankings.map(({thumbnail,...r})=>r));
   }
   rankings.sort((a,b)=>a.distance-b.distance||a.modelId.localeCompare(b.modelId));classifications.push({regionId,sourceROI,cropSHA256,batches,rankings});check();input.onPartial?.(bundle(false));
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
 // before starting this single additive job, including after a GPU restart.
 input.onPartial?.(appearance);check();
 input.onProgress?.({phase:'native-body-support',message:`全領域まとめてROM身体の条件付き支持を比較します（目安${RESIDUAL_NATIVE_BODY_BUDGET.wallTimeMs} ms / 最大${RESIDUAL_NATIVE_BODY_BUDGET.maxProposals}提案、同期処理の時間上限は保証せず、未探索は不明のまま）。`});
 let nativeResult=null,nativeError=null;
 try{
  if(typeof client.nativeBodySupport!=='function')throw Error('Automatic native body worker unavailable');
  nativeResult=await client.nativeBodySupport({videoEvidence:input.videoEvidence,backgroundEvidence:input.backgroundEvidence,nativeVideo:input.nativeVideo,nativeComparison:input.nativeComparison,regions:input.regionIds.map(id=>input.regions.find(region=>region.id===id)),candidates:plan.models,variant,appearancePoseHints:{romSHA256:input.backgroundEvidence.romSHA256,frame:input.videoEvidence,regions:appearance.sightings.map(s=>({regionId:s.originalProposalId,candidates:(s.classificationEvidence?.[0]?.rankings??[]).map(r=>({modelId:r.modelId,bestPose:r.bestPose}))}))}},input.onProgress,{assertCurrent:check});check();
 }catch(error){check();if(error?.name==='AbortError')throw error;nativeError=error;}
 check();
 return attachResidualNativeSupport(appearance,{input,result:nativeResult,error:nativeError});
}
