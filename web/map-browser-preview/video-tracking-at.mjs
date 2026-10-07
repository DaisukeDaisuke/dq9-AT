import {copyObservationBundleForAT} from './observation-bundle-ownership.mjs?v=gap-owned-observation-20261006-1340';
import {compareCameraBodyAlternative} from '../monster-camera-body-alternative.mjs?v=native-scene-link-20261007-0354';
import {trackingSightingMapProvenance} from './map-hypothesis-provenance.mjs';
import {deriveCameraBodySingletonAlternatives,appendCameraBodySingletonAlternatives} from '../tracking-camera-body-alternative.mjs?v=proposal-support-20261006-1152';
import {assertProductionATInput} from '../production-at-input-policy.mjs?v=production-inputs-20261006-1320';
import {searchAutomaticReplayInputs} from '../video-replay-factor-search.mjs?v=automatic-entry-factors-20261006-1120';
import {deriveTrackingEventEvidence,automaticSingletonSearchOptions} from '../tracking-at-event-evidence.mjs?v=proposal-support-20261006-1152';
import {prepareTrackingJob,openTrackingCheckpointStore,startTrackingSession,collectTrackingMotionAssociationInputs} from '../tracking-at-session.mjs?v=map-input-owned-preparation-20261006-1408';
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
 for(const s of snapshot.sightings??[])rows.set(s.id,{s,plan:snapshot.source?.modelPlan,map:trackingSightingMapProvenance(snapshot,s)});
 for(const v of snapshot.videoObservations??[])for(const f of v.timeline?.frames??[])for(const s of f.sightings??[])if(!rows.has(s.id))rows.set(s.id,{s,plan:f.modelPlan,map:trackingSightingMapProvenance(snapshot,s,f)});
 for(const {s,plan,map} of rows.values()){
  const claimed=s.cameraBodyAlternative;if(typeof claimed?.supportedModelId!=='string')continue;
  try{
   const need=(x,m)=>{if(!x)throw Error(m);};
   need(s.classificationEvidence?.length===1&&map?.frame?.frameKey===s.frameKey,'Camera alternative own-frame appearance/provenance unavailable');
   const p=map.frame,frame={romSHA256:p.romSHA256,sourceId:p.sourceId,sourceEpoch:p.sourceEpoch,timelineSegment:p.timelineSegment,mediaTime:p.sourcePTS,fullRGBA_SHA256:p.fullRGBA_SHA256},expected=map.survivingBackgroundCandidates??[],rankings=s.classificationEvidence[0].rankings,expectedModelIds=plan?.models?.map(m=>m.modelId);
   need(expected.length>0&&['romSHA256','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'].every(k=>claimed.frame?.[k]===frame[k]),'Camera alternative frame differs from its owned sighting');
   const backgroundBranchSupport={kind:'same-frame-background-branch-support-v1',ready:true,frame,passingBranchCount:expected.length,branches:expected.map(b=>({...b,romSHA256:frame.romSHA256,fullRGBA_SHA256:frame.fullRGBA_SHA256}))};
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
export function createVideoTrackingAT({getOptions,getTables=()=>({}),engineRevision,onState=()=>{},prepare=prepareTrackingJob,openStore=openTrackingCheckpointStore,startSession=startTrackingSession,loadWasm=async(kind)=>{const file=kind==='known-origin-terminal-indices'?'at_identify_stream.wasm':'at_identify.wasm';const r=await fetch(new URL('../wasm/'+file,import.meta.url));if(!r.ok)throw Error('AT WASM HTTP '+r.status);return new Uint8Array(await r.arrayBuffer());}}){
 let epoch=0,session=null,latest=null,latestNativeBodySupport=null,latestNativeMotionInputs=null,latestReplayInputs=null,storePromise=null,wasmPromises=new Map();
 const emit=(state)=>onState({...scope,...state});
 function cancel(reason='入力が変わりました。',{retainObservation=false}={}){epoch++;session?.cancel();session=null;if(!retainObservation){latest=null;latestNativeBodySupport=null;latestNativeMotionInputs=null;latestReplayInputs=null;}emit({status:'waiting',reason});}
 async function observe(bundle){
  try{assertProductionATInput(bundle);}catch(error){cancel(error.message);return;}
  const mine=++epoch;session?.cancel();session=null;latest=copyObservationBundleForAT(bundle);latestNativeBodySupport=null;latestNativeMotionInputs=null;latestReplayInputs=null;
  const snapshot=latest;emit({status:'waiting',reason:'同じ観測bundleを確認中。種類・出生・AT消費は未確定。',sightings:snapshot.sightings?.length??0});
  try{
   const replayInputs=await searchAutomaticReplayInputs(snapshot,{isCurrent:()=>mine===epoch});if(mine!==epoch)return;latestReplayInputs=replayInputs;
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
   latestNativeMotionInputs=collectTrackingMotionAssociationInputs(snapshot,latestNativeBodySupport);
   const chains=snapshot.conditionalATEventEvidence?.chains??[];
   if(!chains.length&&!singleEvents.length){emit({status:'waiting',reason:'映像観測を接続済み。身体と種類が一致する条件付き予測はまだありません。残差の順位だけではAT解析を開始せず、候補と未確定の可能性を保持します。',sightings:snapshot.sightings?.length??0,missingEvidence:['supported conditional body/species prediction or explicit finite event evidence'],deferredAlternatives:automatic.deferred.length,unobservedGapsRetained:true});return;}
   const options=chains.length?getOptions():automaticSingletonSearchOptions(getTables());
   options.singleEvents=singleEvents;
   // Only an actual automatic producer's explicit conditional evidence is used.
   options.chains=structuredClone(snapshot.conditionalATEventEvidence?.chains??[]);
   // This controller already owns a native-cloned observation; the compiler
   // snapshot is unused by preparation. Generic compiler/preparation callers
   // retain their original independent-copy and rejection behavior by default.
   const job=await prepare(snapshot,options,{engineRevision,isCurrent:()=>mine===epoch,includeReplayInputHypotheses:false,includeCompilerBundleSnapshot:false});if(mine!==epoch)return;
   job.replayInputHypotheses=structuredClone(replayInputs);
   if(job.nativeMotionAssociationInputs)latestNativeMotionInputs=structuredClone(job.nativeMotionAssociationInputs);
   const pending=job.gate.filter(b=>b.status==='pending');
   if(!pending.length){emit({status:'waiting',reason:'有限の抽選イベント列・順序・AT消費間隔の自動根拠を待っています。候補順位や同一追跡を別の抽選に数えません。',gate:job.gate,missingEvidence:job.missingEvidence});return;}
   // Store completion, not Worker progress, is the durable ACK boundary.
   storePromise??=openStore().catch(e=>{storePromise=null;throw e;});
   const kind=options.domain.kind;if(!wasmPromises.has(kind))wasmPromises.set(kind,loadWasm(kind).catch(e=>{wasmPromises.delete(kind);throw e;}));
   const [store,wasmBytes]=await Promise.all([storePromise,wasmPromises.get(kind)]);if(mine!==epoch)return;
   let resume=await store.load(job.checkpointKey);if(mine!==epoch)return;
   emit({status:'running',reason:chains.length?'明示された有限条件下だけを探索中。未知の代替・範囲外・現フレームまでの未観測消費は残ります。':'ROMの身体・種類の条件付き予測について、過去の単一抽選という仮説を解析中。誤観測の可能性と現在ATの全状態は残ります。',producer:cameraAlternatives?.singleEvents.length?'legacy-plus-camera-body-alternatives-v1':automatic.producer,conditionalSingletons:singleEvents.length,...(cameraAlternatives?.singleEvents.length?{cameraBodyConditionalSingletons:cameraAlternatives.singleEvents.length}:{})});
   let lastProgressAt=-Infinity,result;
   for(;;){
   // A state notification can synchronously cancel/supersede this source.
   if(mine!==epoch)return;
   session=startSession({job,wasmBytes,resume,store,onProgress:p=>{if(mine===epoch&&performance.now()-lastProgressAt>=100){lastProgressAt=performance.now();emit({status:'acknowledged',reason:'保存完了した条件付き探索区間のみ反映。現在ATは未特定。',summary:p.summary});}}});
   result=await session.done;if(mine!==epoch)return;session=null;
   if(result.status!=='budget-stopped')break;
   const next=await store.load(job.checkpointKey);if(mine!==epoch)return;
   if(!next||next.sequence<=(resume?.sequence??0))break; // No ACK progress: do not busy-loop.
   resume=next;
   emit({status:'budget-stopped',reason:'計算予算に達した区間を保存済み。残りの同じ条件付き解析を自動で続けます。',summary:result.summary});
   await new Promise(resolve=>setTimeout(resolve,50));if(mine!==epoch)return;
   }

   emit({status:result.status,reason:result.status==='complete'?'条件付きイベント状態の解析終了。誤観測・現在ATの全状態は残り、映像のAT特定完了ではありません。':'計算予算で中断。未探索範囲が残ります。',summary:result.summary});
  }catch(e){if(mine===epoch)emit({status:'waiting',reason:e.message,error:e.name!=='Error'?e.name:undefined});}
 }
 return {observe,cancel,get replayInputHypotheses(){return latestReplayInputs?structuredClone(latestReplayInputs):null;},get nativeBodySupportEvidence(){return latestNativeBodySupport?structuredClone(latestNativeBodySupport):null;},get nativeMotionAssociationInputs(){return latestNativeMotionInputs?structuredClone(latestNativeMotionInputs):null;},retry(){if(latest)return observe(latest);emit({status:'waiting',reason:'先に動画の観測bundleを作成してください。'});}};
}
