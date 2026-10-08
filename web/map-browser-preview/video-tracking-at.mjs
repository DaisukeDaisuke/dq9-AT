import {preparedCurrentNativeAdmission} from '../tracking-current-native-admission.mjs?v=route-poses-20261008-d98f497f';
import {fingerprint} from '../tracking-at-runner.mjs';
import {createTrackingObservationWorkQueue} from '../tracking-observation-work-queue.mjs?v=browser-at-20261008-138417cd';
import {createNativeRouteProducer} from '../tracking-native-route-producer.mjs?v=route-poses-20261008-d98f497f';
import {resolveCameraATBackgroundSupport} from './camera-at-background-support.mjs?v=camera-at-20261008-f1a85661';
import {prepareVideoReplaySources} from '../video-replay-source-preparation.mjs?v=replay-source-20261007-0743';
import {copyObservationBundleForAT} from './observation-bundle-ownership.mjs?v=gap-owned-observation-20261006-1340';
import {compareCameraBodyAlternative} from '../monster-camera-body-alternative.mjs?v=route-poses-20261008-d98f497f';
import {trackingSightingMapProvenance} from './map-hypothesis-provenance.mjs';
import {deriveCameraBodySingletonAlternatives,appendCameraBodySingletonAlternatives} from '../tracking-camera-body-alternative.mjs?v=route-poses-20261008-d98f497f';
import {assertProductionATInput} from '../production-at-input-policy.mjs?v=production-inputs-20261006-1320';
import {searchAutomaticReplayInputs,mineAutomaticReplayFactors} from '../video-replay-factor-search.mjs?v=automatic-entry-factors-20261006-1120';
import {deriveTrackingEventEvidence,automaticSingletonSearchOptions} from '../tracking-at-event-evidence.mjs?v=route-poses-20261008-d98f497f';
import {prepareTrackingJob,openTrackingCheckpointStore,startTrackingSession,collectTrackingMotionAssociationInputs} from '../tracking-at-session.mjs?v=route-poses-20261008-d98f497f';
// This is an execution budget/prior supplied by the user, never inferred from PTS.
export function videoATSearchOptions(values,tables){
 const {seed,seedProvenance,first,last,indexProvenance}=values;
 if(!/^(?:0x[\da-f]+|\d+)$/i.test(seed.trim())||!Number.isSafeInteger(Number(seed))||Number(seed)<0||Number(seed)>0xffffffff)throw Error('既知の初期seed（10進または0x付き16進）を入力してください。ファイル名からは読みません。');
 if(!seedProvenance.trim()||!indexProvenance.trim())throw Error('seedと探索index範囲の根拠を入力してください。');
 if(!/^[1-9]\d*$/.test(first)||!/^[1-9]\d*$/.test(last)||BigInt(last)<BigInt(first)||BigInt(last)>0xffffffffffffffffn||BigInt(last)-BigInt(first)+1n>0x80000000n)throw Error('有限の最終抽選index範囲（1以上、幅2^31以内）が必要です。秒数はAT回数に変換しません。');
 return {tables,domain:{kind:'known-origin-terminal-indices',origin:{kind:'initial-state-before-draw-1',initialSeed:Number(seed),provenance:seedProvenance.trim()},first,last,provenance:indexProvenance.trim(),predecessorPolicy:'post-boot-events-only'},budget:{maxInspectedIndices:65536,maxWallTimeMs:2000,chunkIndices:4096},materialization:{maxCandidatesTotal:1000}};
}

// Independently resolve compact references against full evidence owned by this
// exact snapshot. An attachment alone is never authority to schedule a branch.
function validatedCameraComparisons(snapshot){
 const rows=new Map(),alternatives=[],deferred=[];
 for(const s of snapshot.sightings??[])rows.set(s.id,{s,plan:snapshot.source?.modelPlan,background:snapshot.source?.background?.backgroundBranchSupport,map:trackingSightingMapProvenance(snapshot,s)});
 for(const v of snapshot.videoObservations??[])for(const f of v.timeline?.frames??[])for(const s of f.sightings??[])if(!rows.has(s.id))rows.set(s.id,{s,plan:f.modelPlan,background:f.cameraATBackgroundSupport,map:trackingSightingMapProvenance(snapshot,s,f)});
 for(const {s,plan,map,background} of rows.values()){
  const claimed=s.cameraBodyAlternative;if(typeof claimed?.supportedModelId!=='string')continue;
  try{
   const need=(x,m)=>{if(!x)throw Error(m);};
   need(s.classificationEvidence?.length===1&&map?.frame?.frameKey===s.frameKey,'Camera alternative own-frame appearance/provenance unavailable');
   const p=map.frame,frame={romSHA256:p.romSHA256,sourceId:p.sourceId,sourceEpoch:p.sourceEpoch,timelineSegment:p.timelineSegment,mediaTime:p.sourcePTS,fullRGBA_SHA256:p.fullRGBA_SHA256},expected=map.survivingBackgroundCandidates??[],rankings=s.classificationEvidence[0].rankings,expectedModelIds=plan?.models?.map(m=>m.modelId);
   need(expected.length>0&&['romSHA256','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'].every(k=>claimed.frame?.[k]===frame[k]),'Camera alternative frame differs from its owned sighting');
   const backgroundBranchSupport=resolveCameraATBackgroundSupport(background,frame,expected);
   const sourceBranches=expected.map(branch=>({branchId:branch.branchId,frame:{...frame,recordKey:branch.recordKey},renderer:'source-integer-original-GX-body-subset',candidates:rankings.map(r=>{
    need(r.sourceNativeSupport?.kind==='conditional-source-native-own-support','Owned source-body support unavailable');
    const matches=r.sourceNativeSupport.branches?.filter(b=>b.branchId===branch.branchId&&b.recordKey===branch.recordKey)??[];need(matches.length===1,'Owned body branch is missing or ambiguous');const b=matches[0];
    return{modelId:r.modelId,testedProposals:b.testedProposals??0,best:b.best??null,unsupported:b.unsupported??[],candidateSource:b.candidateSource??null};
   })}));
   const checked=compareCameraBodyAlternative({appearanceFrame:frame,rankings,legacyPrediction:s.conditionalBodyPrediction,backgroundBranchSupport,sourceBranches,expectedModelIds,originalResidualId:Number(s.originalProposalId)});
   need(checked.supportedModelId===claimed.supportedModelId&&checked.appearanceModelId===claimed.appearanceModelId&&JSON.stringify(checked.speciesCandidates)===JSON.stringify(claimed.speciesCandidates)&&checked.branches.length===claimed.branches?.length&&claimed.identityCertified===false&&claimed.certifiedObservation===false&&claimed.conditionalHypothesisOnly===true&&claimed.noEventPossible===true&&claimed.minimumProvenATCalls===0&&claimed.unknownNonEnemyPossible===true&&claimed.playerPossible===true&&claimed.backgroundErrorPossible===true,'Camera attachment no longer matches complete owned body evidence');
   for(const branch of checked.branches){const b=claimed.branches.find(b=>b.branchId===branch.branchId&&b.recordKey===branch.recordKey);need(b&&b.status===branch.status&&b.bestTestedModelId===branch.bestTestedModelId&&b.candidates?.length===branch.candidates.length,'Camera branch/model domain attachment differs');
    for(const candidate of branch.candidates){const c=b.candidates.find(c=>c.modelId===candidate.modelId),ref=c?.sourceEvidenceReference;need(c&&c.ready===candidate.ready&&c.encounterCompatible===candidate.encounterCompatible&&c.pixelErrorReduction===candidate.pixelErrorReduction&&c.sourceProposalId===candidate.sourceProposalId&&ref?.kind==='same-sighting-source-native-support-reference'&&ref.classificationEvidenceIndex===0&&ref.modelId===candidate.modelId&&ref.branchId===branch.branchId&&ref.recordKey===branch.recordKey&&ref.field==='sourceNativeSupport','Camera model evidence reference is missing or changed');}
   }
   // The consumer receives its independently revalidated fields and the same
   // compact references, not a new copy of the full raw failure arrays.
   alternatives.push({sightingId:s.id,comparison:claimed});
  }catch(error){deferred.push({sightingId:s.id,reason:String(error?.message??error),unknownAlternativeRetained:true,noEventPossible:true});}
 }
 return{alternatives,deferred};
}

const scope={minimumProvenATCalls:0,currentVideoStateRecovered:false,unknownAlternativeRetained:true,branchCountsSummed:false};
// Conditional ROM-body/species predictions can produce single-event filters.
// Multi-event search still needs explicit event/order/gap evidence; PTS is not calls.
export function createVideoTrackingAT({getOptions,getTables=()=>({}),getReplaySourceContext=null,produceNativeRoutes=createNativeRouteProducer(),onNativeATValidated=()=>{},engineRevision,onState=()=>{},prepare=prepareTrackingJob,openStore=openTrackingCheckpointStore,startSession=startTrackingSession,loadWasm=async(kind)=>{const file=kind==='known-origin-terminal-indices'?'at_identify_stream.wasm':'at_identify.wasm';const r=await fetch(new URL('../wasm/'+file,import.meta.url));if(!r.ok)throw Error('AT WASM HTTP '+r.status);return new Uint8Array(await r.arrayBuffer());}}){
 let epoch=0,session=null,latest=null,latestNativeBodySupport=null,latestNativeMotionInputs=null,latestReplayInputs=null,latestReplaySources=null,storePromise=null,wasmPromises=new Map();
 let workQueue=null;
 const emit=(state)=>onState({...scope,...state,...(workQueue?{observationScheduling:workQueue.state()}:{}),...(latestReplaySources?{replaySourcePreparation:{status:latestReplaySources.status??'conditional-static-source-preparation',inputBindings:latestReplaySources.bindings?.length??0,sourceRecords:latestReplaySources.sources?.length??0,sourceReadyRecords:latestReplaySources.sources?.filter(s=>s.sourceReady).length??0,nativeRuntimePacketConstructed:false,nativeReplayExecuted:false,minimumProvenATCalls:0,missingRuntimeInputs:latestReplaySources.missingRuntimeInputs??[],error:latestReplaySources.error??null}}:{})});
 function invalidate(reason='入力が変わりました。',{retainObservation=false}={}){epoch++;session?.cancel();session=null;if(!retainObservation){latest=null;latestNativeBodySupport=null;latestNativeMotionInputs=null;latestReplayInputs=null;latestReplaySources=null;}emit({status:'waiting',reason});}
 async function processObservation(bundle,{hasPending}){
  try{assertProductionATInput(bundle);}catch(error){invalidate(error.message);return;}
  const mine=++epoch;session?.cancel();session=null;latest=bundle;latestNativeBodySupport=null;latestNativeMotionInputs=null;latestReplayInputs=null;latestReplaySources=null;
  const snapshot=latest;emit({status:'waiting',reason:'同じ観測bundleを確認中。種類・出生・AT消費は未確定。',sightings:snapshot.sightings?.length??0});
  try{
   const replayInputs=await searchAutomaticReplayInputs(snapshot,{isCurrent:()=>mine===epoch});if(mine!==epoch)return;latestReplayInputs=replayInputs;
   // Static source preparation is a separate companion. It never modifies the
   // existing experiment, fingerprint, event masks or AT continuation request.
   if(typeof getReplaySourceContext==='function'){
    try{const sources=await prepareVideoReplaySources(replayInputs,getReplaySourceContext(),{isCurrent:()=>mine===epoch});if(mine!==epoch)return;latestReplaySources=sources;}
    catch(error){if(mine!==epoch||error?.name==='AbortError')return;latestReplaySources={status:'source-preparation-unresolved',error:String(error?.message??error),nativeReplayExecuted:false,minimumProvenATCalls:0};}
   }
   // Only this newly produced tracking companion is kept out of the legacy
   // fingerprinted AT snapshot. All preexisting automatic fields remain hashed.
   const {nativeBodySupportEvidence,...automatic}=deriveTrackingEventEvidence(snapshot);
   latestNativeBodySupport=nativeBodySupportEvidence??null;
   snapshot.automaticATEventEvidence=automatic;
   // Keep this producer separate from legacy prediction/motion provenance.
   // Repeated timeline sightings are resolved by the existing track grouping;
   // each optional singleton is a disjunctive explanation, not an extra draw.
   const cameraValidation=validatedCameraComparisons(snapshot);
   const cameraAlternatives=cameraValidation.alternatives.length?deriveCameraBodySingletonAlternatives(snapshot,{alternatives:cameraValidation.alternatives}):null;
   if(cameraAlternatives)snapshot.cameraBodyATAlternatives=cameraAlternatives;
   if(cameraValidation.deferred.length)snapshot.cameraBodyATValidationDeferrals=cameraValidation.deferred;
   const singleEvents=cameraAlternatives?appendCameraBodySingletonAlternatives(automatic.singleEvents,cameraAlternatives):automatic.singleEvents;
   latestNativeMotionInputs=collectTrackingMotionAssociationInputs(snapshot,latestNativeBodySupport,{singleEvents});
   let routeEvidence=null;
   try{routeEvidence=await produceNativeRoutes(latestNativeMotionInputs,getReplaySourceContext?.(),{isCurrent:()=>mine===epoch});if(mine!==epoch)return;}
   catch(error){if(mine!==epoch||error?.name==='AbortError')return;routeEvidence={chains:[],deferred:[{reason:String(error?.message??error)}],unknownAlternativeRetained:true,currentVideoStateRecovered:false};}
   snapshot.automaticNativeRouteEvidence=routeEvidence;
   const nativeRouteChains=routeEvidence?.chains??[];
   const chains=snapshot.conditionalATEventEvidence?.chains??[];
   if(!chains.length&&!nativeRouteChains.length&&!singleEvents.length){emit({status:'waiting',reason:'映像観測を接続済み。身体と種類が一致する条件付き予測はまだありません。残差の順位だけではAT解析を開始せず、候補と未確定の可能性を保持します。',sightings:snapshot.sightings?.length??0,missingEvidence:['supported conditional body/species prediction or explicit finite event evidence'],deferredAlternatives:automatic.deferred.length,unobservedGapsRetained:true});return;}
   const options=chains.length?getOptions():automaticSingletonSearchOptions(getTables());
   options.singleEvents=singleEvents;
   options.nativeRouteChains=nativeRouteChains;
   if(nativeRouteChains.length&&!chains.length)options.budget={...options.budget,maxInspectedStates:65536};
   // Only an actual automatic producer's explicit conditional evidence is used.
   options.chains=structuredClone(snapshot.conditionalATEventEvidence?.chains??[]);
   // This controller already owns a native-cloned observation; the compiler
   // snapshot is unused by preparation. Generic compiler/preparation callers
   // retain their original independent-copy and rejection behavior by default.
   const job=await prepare(snapshot,options,{engineRevision,isCurrent:()=>mine===epoch,includeReplayInputHypotheses:false,includeCompilerBundleSnapshot:false});if(mine!==epoch)return;
   const admittedNative=preparedCurrentNativeAdmission(snapshot,job);if(admittedNative)onNativeATValidated(admittedNative.frame,admittedNative);
   job.replayInputHypotheses=structuredClone(replayInputs);
   if(job.nativeMotionAssociationInputs)latestNativeMotionInputs=structuredClone(job.nativeMotionAssociationInputs);
   const pending=job.gate.filter(b=>b.status==='pending');
   if(!pending.length){emit({status:'waiting',reason:'有限の抽選イベント列・順序・AT消費間隔の自動根拠を待っています。候補順位や同一追跡を別の抽選に数えません。',gate:job.gate,missingEvidence:job.missingEvidence});return;}
   // Store completion, not Worker progress, is the durable ACK boundary.
   storePromise??=openStore().catch(e=>{storePromise=null;throw e;});
   const kind=options.domain.kind;if(!wasmPromises.has(kind))wasmPromises.set(kind,loadWasm(kind).catch(e=>{wasmPromises.delete(kind);throw e;}));
   const [store,wasmBytes]=await Promise.all([storePromise,wasmPromises.get(kind)]);if(mine!==epoch)return;
   emit({status:'running',reason:(chains.length||nativeRouteChains.length)?'明示された有限条件下だけを探索中。未知の代替・範囲外・現フレームまでの未観測消費は残ります。':'ROMの身体・種類の条件付き予測について、過去の単一抽選という仮説を解析中。誤観測の可能性と現在ATの全状態は残ります。',producer:cameraAlternatives?.singleEvents.length?'legacy-plus-camera-body-alternatives-v1':automatic.producer,conditionalSingletons:singleEvents.length,conditionalNativeRouteChains:nativeRouteChains.length,nativeRouteEnumerationBudgetStopped:routeEvidence?.budgetStopped??false,...(cameraAlternatives?.singleEvents.length?{cameraBodyConditionalSingletons:cameraAlternatives.singleEvents.length}:{})});
   const result=await runPreparedSlice(job,store,wasmBytes,mine,snapshot.source?.video);if(mine!==epoch)return result;
   emit({status:result.status,reason:result.status==='complete'?'条件付きイベント状態の解析終了。誤観測・現在ATの全状態は残り、映像のAT特定完了ではありません。':'計算予算で中断。未探索範囲が残ります。',summary:result.summary});
   return result;

  }catch(e){if(mine===epoch)emit({status:'waiting',reason:e.message,error:e.name!=='Error'?e.name:undefined});return {status:'error',reason:e.message};}
 }
 async function runPreparedSlice(job,store,wasmBytes,mine,sourceVideo){
  const resume=await store.load(job.checkpointKey);if(mine!==epoch)return {status:'cancelled'};
  let lastProgressAt=-Infinity;
  session=startSession({job,wasmBytes,resume,store,onProgress:p=>{if(mine===epoch&&performance.now()-lastProgressAt>=100){lastProgressAt=performance.now();emit({status:'acknowledged',reason:'保存完了した条件付き探索区間のみ反映。現在ATは未特定。',summary:p.summary,sourceObservationIdentity:job.identity,sourceVideo});}}});
  const result=await session.done;if(mine!==epoch)return {status:'cancelled'};session=null;
  if(result.status!=='budget-stopped')return result;
  const progressed=(result.checkpoint?.sequence??0)>(resume?.sequence??0);
  if(!progressed){emit({status:'waiting',reason:'保存済み AT 区間が進みませんでした。未探索範囲は保持しています。',sourceObservationIdentity:job.identity});return {...result,status:'stalled',progressed:false};}
  const key=`tracking-prepared-work:${job.checkpointKey}`;
  const old=await store.load(key);if(mine!==epoch)return {status:'cancelled'};
  if(!old){const payload={schema:'tracking-prepared-work-v1',inputHash:job.checkpointKey,sequence:1,job:{checkpointKey:job.checkpointKey,identity:job.identity,request:job.request},sourceVideo};await store.save(key,{...payload,checksum:await fingerprint(payload)});}
  else{const {checksum,...payload}=old;if(payload.inputHash!==job.checkpointKey||await fingerprint(payload)!==checksum)throw Error('Prepared work checkpoint differs');}
  if(mine!==epoch)return {status:'cancelled'};
  return {...result,resumeKey:key,progressed:true};
 }
 async function resumePrepared(key,control){
  if(!control.isCurrent())return {status:'cancelled'};
  const mine=++epoch;storePromise??=openStore().catch(e=>{storePromise=null;throw e;});const store=await storePromise;
  const saved=await store.load(key);if(mine!==epoch||!control.isCurrent())return {status:'cancelled'};
  if(!saved)throw Error('Prepared AT work is missing; remaining states are not complete');
  const {checksum,...payload}=saved;if(payload.schema!=='tracking-prepared-work-v1'||key!==`tracking-prepared-work:${payload.inputHash}`||await fingerprint(payload)!==checksum||payload.job?.checkpointKey!==payload.inputHash)throw Error('Prepared AT work checksum/identity differs');
  const job=payload.job,kind=job.request.domain.kind;if(!wasmPromises.has(kind))wasmPromises.set(kind,loadWasm(kind).catch(e=>{wasmPromises.delete(kind);throw e;}));
  const wasmBytes=await wasmPromises.get(kind);if(mine!==epoch)return {status:'cancelled'};
  const result=await runPreparedSlice(job,store,wasmBytes,mine,payload.sourceVideo);
  if(mine===epoch)emit({status:result.status,reason:result.status==='complete'?'保存した条件付き AT 探索を完了。現在 AT の確定ではありません。':'保存 ACK から探索を進め、未探索範囲を巡回待ちへ保持。',summary:result.summary,sourceObservationIdentity:job.identity,sourceVideo:payload.sourceVideo});
  return result;
 }
 function schedulingKey(bundle){
  if(bundle.conditionalATEventEvidence)return `explicit:${crypto.randomUUID()}`;
  const automatic=deriveTrackingEventEvidence(bundle),validation=validatedCameraComparisons(bundle);
  const camera=validation.alternatives.length?deriveCameraBodySingletonAlternatives(bundle,{alternatives:validation.alternatives}):null;
  const singles=camera?appendCameraBodySingletonAlternatives(automatic.singleEvents,camera):automatic.singleEvents;
  const native=(automatic.nativeBodySupportEvidence?.observations??[]).map(o=>({sightingId:o.sightingId,frame:o.frame,frameKey:o.frameKey,sourcePTS:o.sourcePTS,tentativeImageTrack:o.tentativeImageTrack,alternatives:(o.alternatives??[]).filter(a=>a.binding?.ready===true&&Number.isFinite(a.ownGain)&&a.ownGain>0).map(a=>({modelId:a.modelId,variant:a.variant,recordKey:a.recordKey,branchId:a.branchId,proposalId:a.proposalId,positionFx:a.positionFx,pose:a.pose,bodyColorOwnership:a.extent?.bodyColorOwnership}))})).filter(o=>o.alternatives.length);
  const predicates=singles.map(e=>({id:e.id,sightingIds:e.sightingIds,modelId:e.modelId,tableSpeciesAlternatives:e.tableSpeciesAlternatives,source:e.sourceEvidence?.map(s=>({sightingId:s.sightingId,frameKey:s.frameKey,sourcePTS:s.sourcePTS,mapHypothesisProvenance:s.mapHypothesisProvenance,branchSpecificEncounterAlternatives:s.branchSpecificEncounterAlternatives}))}));
  return JSON.stringify({frame:bundle.source?.video,rom:bundle.source?.background?.romSHA256,replay:mineAutomaticReplayFactors(bundle),singleEvents:predicates,tracks:automatic.tracks,native});
 }
 workQueue=createTrackingObservationWorkQueue({
  sourceKey:bundle=>JSON.stringify([bundle.source?.background?.romSHA256,bundle.source?.video?.sourceId,bundle.source?.video?.sourceEpoch,bundle.source?.video?.timelineSegment]),
  conditionKey:schedulingKey,own:copyObservationBundleForAT,process:processObservation,resumeProcess:resumePrepared,invalidate,
  onQueue:()=>{} });
 function observe(bundle){try{assertProductionATInput(bundle);}catch(error){cancel(error.message);return Promise.resolve();}return workQueue.submit(bundle);}
 function cancel(reason='入力が変わりました。',options){workQueue.clear(reason,options);}
 async function observeBounded(bundle){try{assertProductionATInput(bundle);}catch(error){cancel(error.message);return;}const admitted=await workQueue.admit(bundle);void admitted.done.catch(error=>emit({status:'waiting',reason:error.message}));return {status:'admitted-or-superseded',saved:false};}
 return {observe,observeBounded,cancel,get replaySourcePreparation(){return latestReplaySources?structuredClone(latestReplaySources):null;},get replayInputHypotheses(){return latestReplayInputs?structuredClone(latestReplayInputs):null;},get nativeBodySupportEvidence(){return latestNativeBodySupport?structuredClone(latestNativeBodySupport):null;},get nativeMotionAssociationInputs(){return latestNativeMotionInputs?structuredClone(latestNativeMotionInputs):null;},retry(){if(latest){const retained=latest;cancel('同じ保存観測を明示的に再試行します。',{retainObservation:true});return observe(retained);}emit({status:'waiting',reason:'先に動画の観測bundleを作成してください。'});}};
}
