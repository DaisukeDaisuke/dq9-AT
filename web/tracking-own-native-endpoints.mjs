import {collectTrackingSightings} from './tracking-at-event-evidence.mjs?v=route-poses-20261008-d98f497f';
import {resolveCameraATBackgroundSupport} from './map-browser-preview/camera-at-background-support.mjs?v=camera-at-20261008-f1a85661';
import {encounterModelCandidates} from './map-browser-preview/encounter-model-candidates.mjs';
import {completeNativeBodyComparison} from './monster-native-comparison-support.mjs?v=recognition-20261008-7cf64cf4';
import {completeNativeBodyPoseSupport} from './monster-camera-body-alternative.mjs?v=route-poses-20261008-d98f497f';
import {nativeOriginalProposalDecision} from './monster-native-proposal-support.mjs?v=recognition-20261008-7cf64cf4';
import {validatedRetainedNativeRoutePoses} from './monster-native-route-pose-support.mjs?v=route-poses-20261008-d98f497f';
import {compareNativeUiCompetition} from './monster-native-ui-competition.mjs?v=native-scene-link-20261007-0354';
const owned=new WeakSet(),copy=structuredClone,equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),int=Number.isSafeInteger,int32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const flags={conditionalHypothesisOnly:true,speciesCertified:false,identityCertified:false,birthCertified:false,independentDrawCertified:false,minimumProvenATCalls:0,noEventPossible:true,unknownAlternativeRetained:true};
const need=(ok,reason)=>{if(!ok)throw Error(reason);};
// This does not edit a classifier outcome or create a weighted birth. Each row
// says: IF this independently compared own-model/root/pose is the actor and its
// encounter origin is this table, these are its source species/table choices.
export function deriveOwnNativeModelEndpoints(bundle){
 const backgrounds=new Map(),endpoints=[],deferred=[];let rows;try{({rows}=collectTrackingSightings(bundle));}catch(error){const result={schema:'conditional-own-native-endpoints-v1',endpoints,deferred:[{reason:'Full raw observation unavailable: '+error.message,...flags}],existingClassifierOutcomesChanged:false,newWeightedEvents:0,...flags};owned.add(result);return result;}
 for(const s of bundle.sightings??[])backgrounds.set(s.id,bundle.source?.background?.backgroundBranchSupport);
 for(const v of bundle.videoObservations??[])for(const f of v.timeline?.frames??[])for(const s of f.sightings??[])if(!backgrounds.has(s.id))backgrounds.set(s.id,f.cameraATBackgroundSupport);
 for(const {s,plan,mapProvenance:map} of rows){
  const f=map?.frame,frame=f?{romSHA256:f.romSHA256,sourceId:f.sourceId,sourceEpoch:f.sourceEpoch,timelineSegment:f.timelineSegment,mediaTime:f.sourcePTS,fullRGBA_SHA256:f.fullRGBA_SHA256}:null;
  let background;
  try{need(f?.frameKey===s.frameKey&&f.sourcePTS===s.sourcePTS,'Own sighting frame unavailable');background=resolveCameraATBackgroundSupport(backgrounds.get(s.id),frame,map.survivingBackgroundCandidates);need(background?.ready===true,'Own frozen background unavailable');}
  catch(error){deferred.push({sightingId:s.id,reason:error.message,...flags});continue;}
  for(const [evidenceIndex,evidence]of(s.classificationEvidence??[]).entries())for(const[rankingIndex,rank]of(evidence.rankings??[]).entries()){
   const modelId=rank.modelId,support=rank.sourceNativeSupport;
   for(const[branchIndex,branch]of(support?.branches??[]).entries()){
    const ref={sightingId:s.id,modelId,branchId:branch.branchId,recordKey:branch.recordKey,evidenceIndex,rankingIndex,branchIndex};
    try{
     need(support.kind==='conditional-source-native-own-support'&&support.modelId===modelId&&branch.status==='evaluated-subset'&&int(branch.testedProposals)&&branch.testedProposals>0,'Owned tested model support unavailable');
     const models=(plan?.models??[]).filter(m=>m.modelId===modelId),aliases=(s.modelAliases??[]).filter(m=>m.modelId===modelId);need(models.length===1&&aliases.length===1&&['_f','regular'].includes(models[0].variant),'Unique own model/variant/alias unavailable');const model=models[0],alias=aliases[0];
     const species=model.speciesCandidates??[];need(species.length>0&&species.every(x=>int(x.monsterId)&&alias.speciesCandidates?.some(y=>y.monsterId===x.monsterId)),'Own ROM species alias differs');
     const maps=(map.survivingBackgroundCandidates??[]).filter(m=>m.branchId===branch.branchId&&m.recordKey===branch.recordKey&&m.accepted===true),bgs=(background.branches??[]).filter(b=>b.branchId===branch.branchId&&b.recordKey===branch.recordKey);
     need(maps.length===1&&bgs.length===1&&(support.branches??[]).filter(b=>b.branchId===branch.branchId&&b.recordKey===branch.recordKey).length===1,'Unique accepted own map/camera branch unavailable');const m=maps[0],bg=bgs[0],candidate=branch.candidateSource;
     need(candidate?.matchesBranchEncounterPlan===true&&candidate.branchRecordKey===m.recordKey&&candidate.branchMapId===m.mapId&&candidate.originMapIds?.includes(m.mapId),'Native model does not belong to this branch encounter source');
     const joins=encounterModelCandidates(plan,modelId,{mapId:m.mapId,speciesCandidates:species});need(joins.tableSpeciesAlternatives.length>0&&!joins.unresolvedOrigins.length,'Exact own encounter table/species pairs unavailable');
     need(joins.tableSpeciesAlternatives.every(p=>candidate.origins?.some(o=>o.mapId===m.mapId&&o.tableId===p.tableId&&o.monsterId===p.monsterId&&(model.origins??[]).some(q=>equal(q,o)))),'Native candidate origin differs from own ROM model plan');
     const expected={frame:{...frame,recordKey:m.recordKey},camera:bg.camera,alignment:bg.alignment,backgroundRGBA_SHA256:bg.alignedBackgroundRGBA_SHA256,modelId,originalResidualId:Number(s.originalProposalId)};
     const poses=[branch.best,...validatedRetainedNativeRoutePoses(branch,{frame:expected.frame,modelId,originalResidualId:expected.originalResidualId}).filter(p=>p.proposalId!==branch.best?.proposalId)];
     for(const best of poses){
      try{
       need(best&&typeof best.proposalId==='string'&&best.fit?.pixelErrorReduction>0,'No positive evaluated own-model pose');
       need(completeNativeBodyComparison(best,expected)&&completeNativeBodyPoseSupport(best),'Complete own-frame source comparison/body support unavailable');
       need(nativeOriginalProposalDecision(best.fit,{sourcePixelSHA256:frame.fullRGBA_SHA256,originalResidualId:expected.originalResidualId}).positive===true,'Exact original component support unavailable');
       need(Array.isArray(best.positionFx)&&best.positionFx.length===3&&best.positionFx.every(int32)&&typeof best.pose?.clip==='string'&&(best.pose.clip==='bind'?best.pose.frame===null:int(best.pose.frame)&&best.pose.frame>=0)&&int(best.pose.actorScaleFx)&&best.pose.actorScaleFx>0&&best.pose.actorScaleFx<32768&&int32(best.pose.yawFx),'Native pose/root is not explicit');
       const ui=compareNativeUiCompetition({modelId,sourceBranches:[{branchId:m.branchId,candidates:[{modelId,best}]}],legacyPrediction:s.conditionalBodyPrediction,appearanceFrame:frame,originalResidualId:expected.originalResidualId});
       const endpoint={kind:'conditional-own-native-species-table-endpoint-v1',id:'own-native-endpoint:'+JSON.stringify([s.id,evidenceIndex,rankingIndex,branchIndex,modelId,m.branchId,m.recordKey,best.proposalId,bg.camera,bg.alignment,bg.alignedBackgroundRGBA_SHA256]),...ref,frame:{...copy(frame),frameKey:s.frameKey},sourcePTS:s.sourcePTS,originalProposalId:s.originalProposalId,mapId:m.mapId,variant:model.variant,proposalId:best.proposalId,positionFx:best.positionFx.slice(),pose:copy(best.pose),camera:copy(bg.camera),alignment:copy(bg.alignment),backgroundRGBA_SHA256:bg.alignedBackgroundRGBA_SHA256,tableSpeciesAlternatives:copy(joins.tableSpeciesAlternatives),candidateSource:copy(candidate),comparisonReference:{field:'sourceNativeSupport',poseField:best===branch.best?'best':'routePoseSupport.entries',proposalId:best.proposalId},conditions:['This exact own-model/root/pose explains the observed pixels under this camera/map hypothesis','This actor has one of the retained ROM encounter table/species origins','Identity, actual actor heading, reached source handler, clock and other AT consumers are not observed'],alternatives:{appearanceModelId:s.cameraBodyAlternative?.appearanceModelId??s.conditionalBodyPrediction?.appearanceModelId??null,appearanceAgreement:(s.cameraBodyAlternative?.appearanceModelId??s.conditionalBodyPrediction?.appearanceModelId)===modelId,existingAcceptedModelId:s.cameraBodyAlternative?.supportedModelId??s.conditionalBodyPrediction?.modelId??null,otherModelIds:(plan.models??[]).map(x=>x.modelId).filter(x=>x!==modelId),uiCompetition:copy(ui),nonEnemyAlternativeReferences:(s.conditionalBodyPrediction?.conditionalNonEnemyAlternatives??[]).map((a,index)=>({index,kind:a.kind,member:a.source?.member??null,sourcePixelSHA256:a.sourcePixelSHA256})),uiPossible:true,playerPossible:true,backgroundErrorPossible:true,otherCameraBranchesRetained:true},...flags};endpoints.push(endpoint);
      }catch(error){deferred.push({...ref,proposalId:best?.proposalId??null,reason:error.message,...flags});}
     }
    }catch(error){deferred.push({...ref,reason:error.message,...flags});}
   }
  }
 }
 const result={schema:'conditional-own-native-endpoints-v1',endpoints,deferred,existingClassifierOutcomesChanged:false,newWeightedEvents:0,...flags};owned.add(result);return result;
}
export function linkOwnNativeEndpoints(candidate,evidence,nativeFrames,endpoint){
 if(!owned.has(evidence))throw Error('Own native endpoints must be freshly derived from the immutable raw bundle');
 const sightingId=endpoint==='prior'?candidate.fromSightingId:candidate.toSightingId,nativeFrame=nativeFrames.get(sightingId),links=[];
 for(const[hypothesisIndex,h]of candidate.hypotheses.entries())for(const e of evidence.endpoints){const ref=endpoint==='prior'?h.from:h.to,pos=endpoint==='prior'?h.fromPositionFx:h.toPositionFx,pose=endpoint==='prior'?h.fromPose:h.toPose;
  if(e.evidenceIndex!==ref.evidenceIndex||e.rankingIndex!==ref.rankingIndex||e.branchIndex!==ref.branchIndex||e.sightingId!==sightingId||e.modelId!==h.modelId||e.variant!==h.variant||e.recordKey!==h.recordKey||e.branchId!==ref.branchId||e.proposalId!==ref.proposalId||e.frame.frameKey!==ref.frameKey||e.sourcePTS!==ref.sourcePTS||e.frame.romSHA256!==candidate.romSHA256||e.frame.fullRGBA_SHA256!==nativeFrame?.fullRGBA_SHA256||['sourceId','sourceEpoch','timelineSegment'].some((k,i)=>e.frame[k]!==candidate.sourceIdentity[i])||!equal(e.positionFx,pos)||!equal(e.pose,pose))continue;
  links.push({endpoint,hypothesisIndex,kind:e.kind,automaticSingletonId:null,atBranchId:null,atEventId:null,compiledInputLinked:false,sightingId,fromSightingId:candidate.fromSightingId,toSightingId:candidate.toSightingId,modelId:h.modelId,recordKey:h.recordKey,frameKey:ref.frameKey,branchId:ref.branchId,sourceSpecificTableSpeciesAlternatives:copy(e.tableSpeciesAlternatives),ownModelEndpointReference:{kind:'conditional-own-native-endpoint-reference-v1',endpointId:e.id},nativeHypothesisReference:{from:copy(h.from),to:copy(h.to)},sourcePredicatePolicy:'explicit-own-model-species-table-condition; no weighted birth introduced',associationRemainsConditional:true,independentDrawCount:null,additionalDrawsCertified:0,...flags});
 }
 return links;
}

// Re-resolve compact route references against freshly validated raw evidence.
// A persisted ID or a borrowed proposal from another frame is never authority.
export function validateOwnNativeRouteReferences(evidence,reference){
 if(!owned.has(evidence))throw Error('Own endpoint lookup requires freshly validated raw evidence');
 const refs=reference.endpointSpeciesHypotheses;need(refs?.kind==='conditional-own-native-route-references-v1','Unknown own endpoint reference contract');
 for(const [side,field]of[['prior','from'],['incoming','to']]){
  need(Array.isArray(refs[side]),'Own endpoint reference list missing');
  for(const ref of refs[side]){
   need(ref?.kind==='conditional-own-native-endpoint-reference-v1'&&typeof ref.endpointId==='string','Own endpoint ID missing');
   const matches=evidence.endpoints.filter(e=>e.id===ref.endpointId);need(matches.length===1,'Own endpoint is absent or ambiguous in this exact raw observation');const e=matches[0],r=reference[field];
   need(e.modelId===reference.modelId&&e.variant===reference.variant&&e.recordKey===reference.recordKey&&e.sightingId===reference[field+'SightingId']&&e.branchId===r?.branchId&&e.proposalId===r.proposalId&&e.frame.frameKey===r.frameKey&&e.sourcePTS===r.sourcePTS&&e.evidenceIndex===r.evidenceIndex&&e.rankingIndex===r.rankingIndex&&e.branchIndex===r.branchIndex,'Own endpoint model/frame/ROI/camera/proposal reference differs');
   need(e.frame.romSHA256===reference.romSHA256&&['sourceId','sourceEpoch','timelineSegment'].every((k,i)=>e.frame[k]===reference.sourceIdentity?.[i])&&equal(e.positionFx,reference[field+'PositionFx'])&&equal(e.pose,reference[field+'Pose']),'Own endpoint ROM/epoch/root/pose differs');
   need(e.tableSpeciesAlternatives.some(p=>p.tableId===reference.pair?.tableId&&p.monsterId===reference.pair?.monsterId),'Own endpoint encounter pair differs');
  }
 }
 return true;
}
