import {assertProductionATInput} from './production-at-input-policy.mjs?v=production-inputs-20261006-1320';
import {searchAutomaticReplayInputs} from './video-replay-factor-search.mjs?v=automatic-entry-factors-20261006-1120';
import {compileTrackingObservations} from './tracking-at-observation-adapter.mjs?v=map-input-owned-preparation-20261006-1408';
import {fingerprint} from './tracking-at-runner.mjs?v=native-lineage-at-20261008-556f7ca6';
import {createNativeMotionContinuityIndex} from './tracking-native-motion.mjs?v=enc-motion-at-20261006-1156';
const need=(v,m)=>{if(!v)throw Error(m);};
// A predecessor with the same model is not necessarily the prior classified
// actor. Bind each exact endpoint sighting and its own frame/map/camera evidence.
// Source-specific pairs remain alternatives; do not intersect actor predicates.
function indexEndpointSelections(singleEvents,compiledBranches){
 const bySighting=new Map(),compiledById=new Map((compiledBranches??[]).map(b=>[b.id,b]));
 for(const event of singleEvents??[]){
  if(event?.status!=='conditional-source-model-evidence'||typeof event.id!=='string'||typeof event.modelId!=='string'||typeof event.provenance!=='string'||!event.provenance.length)continue;
  for(const source of event.sourceEvidence??[]){
   if(typeof source?.sightingId!=='string'||!event.sightingIds?.includes(source.sightingId))continue;
   if(!bySighting.has(source.sightingId))bySighting.set(source.sightingId,[]);
   bySighting.get(source.sightingId).push({event,source,compiledBranch:compiledById.get(event.id)});
  }
 }
 return bySighting;
}
function bindSelectionEndpoint(candidate,bySighting,nativeFrames,endpoint){
 const links=[],deferred=[],sightingId=endpoint==='prior'?candidate.fromSightingId:candidate.toSightingId,nativeFrame=nativeFrames.get(sightingId);
 for(const [hypothesisIndex,h] of candidate.hypotheses.entries()){
  const reference=endpoint==='prior'?h.from:h.to,entries=bySighting.get(sightingId)??[];
  for(const {event,source,compiledBranch}of entries){
   const frame=source.mapHypothesisProvenance?.frame,compatibility=source.mapCompatibility,background=compatibility?.bodyBackground,prediction=source.conditionalBodyPrediction;
   const sameFrame=frame&&nativeFrame&&frame.frameKey===reference.frameKey&&source.frameKey===reference.frameKey&&source.sourcePTS===reference.sourcePTS&&frame.sourcePTS===reference.sourcePTS&&frame.fullRGBA_SHA256===nativeFrame.fullRGBA_SHA256&&frame.romSHA256===candidate.romSHA256&&['sourceId','sourceEpoch','timelineSegment'].every((k,i)=>frame[k]===candidate.sourceIdentity[i]);
   const camera=source.cameraBodyAlternative,cameraFrame=camera?.frame;
   const cameraBound=camera?.kind==='conditional-camera-body-alternative-v1'&&camera.supportedModelId===h.modelId&&camera.appearanceModelId===h.modelId&&camera.identityCertified===false&&camera.certifiedObservation===false&&camera.conditionalHypothesisOnly===true&&camera.noEventPossible===true&&camera.minimumProvenATCalls===0&&cameraFrame?.romSHA256===candidate.romSHA256&&cameraFrame.fullRGBA_SHA256===nativeFrame?.fullRGBA_SHA256&&cameraFrame.mediaTime===reference.sourcePTS&&['sourceId','sourceEpoch','timelineSegment'].every((k,i)=>cameraFrame[k]===candidate.sourceIdentity[i]);
   const cameraRows=source.branchSpecificEncounterAlternatives?.filter(b=>b.branchId===reference.branchId&&b.recordKey===h.recordKey)??[],cameraRow=cameraRows.length===1?cameraRows[0]:null;
   const cameraBranch=camera?.branches?.filter(b=>b.branchId===reference.branchId&&b.recordKey===h.recordKey)??[];
   const cameraBackground=cameraBound&&cameraRow&&cameraRow.unresolvedOrigins?.length===0&&cameraBranch.length===1&&cameraBranch[0].status==='conditional-tested-body-preference'&&cameraBranch[0].bestTestedModelId===h.modelId&&source.mapHypothesisProvenance?.survivingBackgroundCandidates?.some(b=>b.branchId===reference.branchId&&b.recordKey===h.recordKey&&b.mapId===cameraRow.mapId);
   const legacyBody=prediction?.modelId===h.modelId&&prediction.appearanceModelId===h.modelId&&prediction.bodyModelId===h.modelId&&prediction.agreement===true&&Number.isFinite(prediction.pixelErrorReduction)&&prediction.pixelErrorReduction>0&&prediction.spatialSupportRank>=2;
   const legacyBackground=compatibility?.jointlySupported===true&&compatibility.modelId===h.modelId&&background?.frameKey===reference.frameKey&&background.recordKey===h.recordKey&&background.branchId===reference.branchId;
   // A body from one route cannot borrow the other route's map/table binding.
   const cameraReady=cameraBound&&cameraBackground,legacyReady=legacyBody&&legacyBackground;
   const sameBody=event.modelId===h.modelId&&source.modelId===h.modelId&&(cameraBound||legacyBody);
   const sameBackground=cameraReady||legacyReady;
   const validPair=p=>Number.isInteger(p?.tableId)&&p.tableId>=0&&p.tableId<=65535&&Number.isInteger(p?.monsterId)&&p.monsterId>=0&&p.monsterId<=65535;
   const pairs=cameraReady?cameraRow.tableSpeciesAlternatives:compatibility?.tableSpeciesAlternatives;
   const exactPairs=Array.isArray(pairs)&&pairs.length>0&&pairs.every(p=>validPair(p)&&event.tableSpeciesAlternatives?.some(e=>e.tableId===p.tableId&&e.monsterId===p.monsterId));
   if(!sameFrame||!sameBody||!sameBackground||!exactPairs){deferred.push({hypothesisIndex,automaticSingletonId:event.id,reason:!sameFrame?'event-frame-ROM-source-binding-mismatch':!sameBody?'event-model-body-binding-mismatch':!sameBackground?'event-map-camera-binding-unresolved':'event-exact-table-species-pairs-unavailable'});continue;}
   const compiledEventId=compiledBranch?.sightingEventBindings?.[source.sightingId],compiledEventLinked=typeof compiledEventId==='string'&&compiledBranch.events?.some(e=>e.id===compiledEventId);
   links.push({endpoint,hypothesisIndex,automaticSingletonId:event.id,atBranchId:compiledEventLinked?compiledBranch.id:null,atEventId:compiledEventLinked?compiledEventId:null,compiledInputLinked:Boolean(compiledEventLinked),sightingId:source.sightingId,fromSightingId:candidate.fromSightingId,toSightingId:candidate.toSightingId,modelId:h.modelId,recordKey:h.recordKey,frameKey:reference.frameKey,branchId:reference.branchId,sourceSpecificTableSpeciesAlternatives:structuredClone(pairs),nativeHypothesisReference:{from:structuredClone(h.from),to:structuredClone(h.to)},associationRemainsConditional:true,sourcePredicatePolicy:'retain-endpoint-pair-alternatives-without-intersection',identityCertified:false,independentDrawCount:null,additionalDrawsCertified:0,noEventPossible:true,unknownAlternativeRetained:true});
  }
 }
 return {links,deferred,missingReason:links.length?null:bySighting.has(sightingId)?'Same-sighting event does not have matching frame/model/map/camera and exact table/species provenance':'No automatic singleton references this exact endpoint sighting; another same-model residual cannot supply its species'};
}
function bindRelationSelections(candidate,bySighting,nativeFrames){
 const prior=bindSelectionEndpoint(candidate,bySighting,nativeFrames,'prior'),incoming=bindSelectionEndpoint(candidate,bySighting,nativeFrames,'incoming');
 return {...candidate,conditionalATInput:{...candidate.conditionalATInput,priorSelectionLinks:prior.links,incomingSelectionLinks:incoming.links,priorSelectionLinkStatus:prior.links.length?'conditional-prior-selection-linked':'prior-selection-unresolved',priorSourceSpecificTableSpeciesPairsAvailable:prior.links.length>0,incomingSourceSpecificTableSpeciesPairsAvailable:incoming.links.length>0,priorSelectionLinkDeferrals:prior.deferred,incomingSelectionLinkDeferrals:incoming.deferred,priorSelectionLinkMissingReason:prior.missingReason,incomingSelectionLinkMissingReason:incoming.missingReason,endpointPredicatesIntersected:false}};
}
// Resolve the actual predecessor consumer against this owned observation.
// This companion never enters the experiment, fingerprinted bundle or request.
export function collectTrackingMotionAssociationInputs(bundle,nativeBodySupportEvidence,{identity=null,singleEvents=bundle.automaticATEventEvidence?.singleEvents??[],compiledBranches=null}={}){
 const index=createNativeMotionContinuityIndex(nativeBodySupportEvidence,{bundle}),graph=index.snapshot();
 const ids=[...new Set((nativeBodySupportEvidence?.observations??[]).map(o=>o.sightingId).filter(id=>typeof id==='string'))];
 const video=bundle.source?.video??{},endpointSelections=indexEndpointSelections(singleEvents,compiledBranches),nativeFrames=new Map((nativeBodySupportEvidence?.observations??[]).map(o=>[o.sightingId,o.frame]));
 return {schema:'conditional-tracking-at-motion-inputs-v1',observationIdentity:identity?{...identity}:null,observationSource:{romSHA256:bundle.source?.background?.romSHA256??null,sourceId:video.sourceId??null,sourceEpoch:video.sourceEpoch??null,timelineSegment:video.timelineSegment??null},perSightingPriorCandidates:ids.map(id=>{const resolved=index.resolvePriorKnownMonsterCandidates(id);return {...resolved,candidates:resolved.candidates.map(c=>bindRelationSelections(c,endpointSelections,nativeFrames))};}),enumeration:{budgets:graph.budgets,pairEvaluations:graph.pairEvaluations,budgetStopped:graph.budgetStopped,omittedIncomingSightings:graph.omittedIncomingSightings,associationEnumerationComplete:false},usedForATConstraints:false,additionalDrawsCertified:0,minimumProvenATCalls:0,identityCertified:false,unknownAlternativeRetained:true,currentVideoStateRecovered:false,scope:'Resolved conditional predecessor inputs for this observation snapshot. Exact table/species pairs and same-entity assumptions are still required before any constraint; independent actors are not intersected and repeated sightings create no additional draw.'};
}
// Call directly from the completed, immutable continuous-bundle callback.
// This hook accepts only explicit bounded search options; it invents no prior.
export async function prepareTrackingJob(bundle,options,{engineRevision,observationRevision,isCurrent=()=>true,includeReplayInputHypotheses=true,includeCompilerBundleSnapshot=true}){
 assertProductionATInput({bundle,options});
 const current=()=>{if(!isCurrent())throw new DOMException('Tracking preparation cancelled or stale','AbortError');};
 current();
 const prepared=compileTrackingObservations(bundle,options,{includeBundleSnapshot:includeCompilerBundleSnapshot}),romSHA256=bundle.source?.background?.romSHA256;
 need(/^[a-f0-9]{64}$/.test(romSHA256??''),'ROM identity missing');need(typeof engineRevision==='string'&&engineRevision.length,'Engine revision missing');
 const bundleSHA256=await fingerprint(bundle);current();
 // The controller's revision has always been the complete owned snapshot hash.
 // Compute it once, without a cross-observation cache or a reduced identity.
 if(observationRevision===undefined)observationRevision=bundleSHA256;
 const tablesSHA256=await fingerprint(options.tables??{});current();
 const identity={bundleSHA256,romSHA256,engineRevision,observationRevision,tablesSHA256};
 // The mounted controller already owns the companion from its earlier search.
 // Omitting this diagnostic copy never changes the request or checkpoint hash.
 const replayInputHypotheses=includeReplayInputHypotheses?await searchAutomaticReplayInputs(bundle,{isCurrent}):null;current();
 const checkpointKey=await fingerprint({request:prepared.request,identity});current();
 const nativeMotionAssociationInputs=collectTrackingMotionAssociationInputs(bundle,prepared.nativeBodySupportEvidence,{identity,singleEvents:options.singleEvents??[],compiledBranches:prepared.request.experiment.branches});current();
 return {replayInputHypotheses,nativeBodySupportEvidence:prepared.nativeBodySupportEvidence,nativeMotionAssociationInputs,checkpointKey,request:prepared.request,identity,gate:prepared.gate,missingEvidence:prepared.missingEvidence};
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
 checkpointKey??=job.checkpointKey;need(checkpointKey===job.checkpointKey,'Use the hashed job checkpoint key');const runId=crypto.randomUUID(),worker=new Worker(new URL('./tracking-at-worker.mjs?v=native-lineage-at-20261008-556f7ca6',import.meta.url),{type:'module'});let stopped=false,lastAcknowledged=resume,resolveDone,rejectDone;
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
