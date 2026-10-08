import {compareCameraBodyAlternative} from '../monster-camera-body-alternative.mjs?v=route-poses-20261008-d98f497f';
import {attachNativeBodySupport} from '../monster-native-support.mjs?v=route-poses-20261008-d98f497f';

// Cooperative work budget for the entire frozen set, including preparation.
// Synchronous source work cannot be preempted, so this is not a hard elapsed-
// time guarantee. Every untested model/branch remains unknown.
export const RESIDUAL_NATIVE_BODY_BUDGET=Object.freeze({wallTimeMs:1500,maxProposals:128});
// Optional result wait only: expiry preserves the shared worker and caches.
export const RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS=2000;
// Per-frame scheduling allowance, not a recognition or domain-completion gate.
// Sum source evaluate elapsed only; import/service preparation is separate.
// Checked after each owned slice; atomic source work can overrun this allowance.
export const RESIDUAL_NATIVE_FRAME_SOURCE_BUDGET_MS=30000;
const clone=value=>structuredClone(value);
const FRAME_KEYS=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const unknown=(branchId,recordKey,reason)=>({branchId,recordKey,status:'unavailable',reason,ownGain:null,unknownRetained:true});
function groupsFromBackground(input){
 const background=input.backgroundEvidence,support=background?.backgroundBranchSupport,rows=support?.branches;
 if(Array.isArray(rows)&&rows.length){
  const groups=new Map();
  for(const row of rows){
   if(typeof row.recordKey!=='string'||typeof row.branchId!=='string')throw Error('Preserved background record/branch identity missing');
   if(!groups.has(row.recordKey))groups.set(row.recordKey,{recordKey:row.recordKey,branchIds:[],backgroundFrame:support?.frame?{...support.frame,romSHA256:background.romSHA256,recordKey:row.recordKey}:null,sourceBindingsValid:support?.ready===true});
   const group=groups.get(row.recordKey);
   if(group.branchIds.includes(row.branchId))throw Error('Preserved background branch identity repeated');
   group.branchIds.push(row.branchId);
   group.sourceBindingsValid&&=row.romSHA256===background.romSHA256&&row.fullRGBA_SHA256===input.videoEvidence.fullRGBA_SHA256;
  }
  return [...groups.values()];
 }
 // The legacy path has only one frozen background. It is still conditional.
 return typeof background?.recordKey==='string'?[{recordKey:background.recordKey,branchIds:['selected-background'],backgroundFrame:background.automaticSearch?.inputFrame?{...background.automaticSearch.inputFrame,romSHA256:background.romSHA256,recordKey:background.recordKey}:null,sourceBindingsValid:background.automaticSearch?.acceptedCount===1}]:[];
}
function frameFor(input,recordKey){
 const v=input.videoEvidence;
 return{romSHA256:input.backgroundEvidence.romSHA256,recordKey,sourceId:v.sourceId,sourceEpoch:v.sourceEpoch,timelineSegment:v.timelineSegment,mediaTime:v.mediaTime??v.videoTime,fullRGBA_SHA256:v.fullRGBA_SHA256};
}
function sameFrame(a,b){return FRAME_KEYS.every(key=>a?.[key]!==null&&a?.[key]!==undefined&&a[key]===b?.[key]);}


// The original prediction, full source fits and every failure stay where they
// already live. Reference them rather than duplicating them into the timeline.
function cameraAlternativeAttachment(sighting,{appearance,input,native}){
 const frame=frameFor(input,undefined);
 try{
  if(sighting.classificationEvidence?.length!==1)throw Error('One complete frozen appearance domain required');
  const rankings=sighting.classificationEvidence[0].rankings,expectedModelIds=appearance.source?.modelPlan?.models?.map(m=>m.modelId),sourceBranches=(native?.groups??[]).flatMap(group=>(group.bundle?.branches??[]).map(branch=>({...branch,frame:group.frame,renderer:group.bundle.renderer})));
  const result=compareCameraBodyAlternative({appearanceFrame:frame,rankings,legacyPrediction:sighting.conditionalBodyPrediction,backgroundBranchSupport:input.backgroundEvidence?.backgroundBranchSupport,sourceBranches,expectedModelIds,originalResidualId:Number(sighting.originalProposalId)});
  const {legacyPrediction,...attachment}=result;
  return {...attachment,legacyPredictionReference:'conditionalBodyPrediction',branches:result.branches.map(branch=>({...branch,candidates:branch.candidates.map(candidate=>({modelId:candidate.modelId,ready:candidate.ready,...(typeof candidate.bodySupportReady==='boolean'?{comparisonReady:candidate.ready,bodySupportReady:candidate.bodySupportReady}:{}),encounterCompatible:candidate.encounterCompatible,pixelErrorReduction:candidate.pixelErrorReduction,sourceProposalId:candidate.sourceProposalId,originalProposalSupport:clone(candidate.originalProposalSupport),reasons:candidate.reasons,unsupportedCount:candidate.unsupported.length,sourceEvidenceReference:{kind:'same-sighting-source-native-support-reference',classificationEvidenceIndex:0,modelId:candidate.modelId,branchId:branch.branchId,recordKey:branch.recordKey,field:'sourceNativeSupport'}}))}))};
 }catch(error){return{kind:'conditional-camera-body-alternative-v1',frame,supportedModelId:null,speciesCandidates:[],appearanceModelId:null,branches:[],unavailableReason:String(error?.message??error),legacyPredictionReference:'conditionalBodyPrediction',legacyPredictionChanged:false,appearanceOrderChanged:false,unknownNonEnemyPossible:true,playerPossible:true,backgroundErrorPossible:true,identityCertified:false,minimumProvenATCalls:0,noEventPossible:true,certifiedObservation:false,conditionalHypothesisOnly:true};}
}

// Existing sourceNativeSupport and a distinct conditional camera alternative are merged. Reusing the already
// built observation bundle leaves bodyFit, conditionalBodyPrediction, AT and
// appearance order byte-for-byte equivalent after this field is removed.
export function attachResidualNativeSupport(appearance,{input,result=null,error=null}){
 if(!Array.isArray(appearance.sightings))return appearance;
 const failure=error?String(error?.message??error):null;
 let expected=[],setupError=null;
 try{expected=groupsFromBackground(input);}catch(e){setupError=e.message;}
 const valid=result?.kind==='automatic-source-native-body-support'&&Array.isArray(result.regions);
 const progress=result?.continuation,workProgress=progress?.kind==='same-frozen-native-job'?{slice:progress.slice,totalAttempts:progress.totalAttempts,totalPreparationSteps:progress.totalPreparationSteps??0,preparationPending:progress.preparationPending===true,...(progress.laterPlacementPhase==='source-native-emitted-envelope-v1'?{laterPlacementPhase:progress.laterPlacementPhase,totalCompletedVisits:progress.totalCompletedVisits,totalEmittedPlacementSteps:progress.totalEmittedPlacementSteps}:{}),pairsWithFirstOutcome:progress.firstSweepServed,totalPairs:progress.jobsTotal,firstSweepComplete:progress.firstSweepComplete===true,hasUntestedPoseDomain:progress.hasMore===true,poseAndCameraCoverageComplete:false}:null;
 const reason=failure??setupError??(valid?'Native body candidate/branch not evaluated':'Automatic source-native body result unavailable');
 const supportByRegion=new Map();
 for(const regionId of input.regionIds){
  const matching=valid?result.regions.filter(row=>row?.regionId===regionId):[];
  supportByRegion.set(regionId,matching.length===1?matching[0]:null);
 }
 return{...appearance,sightings:appearance.sightings.map(sighting=>{
  const region=input.regions.find(row=>String(row.id)===sighting.originalProposalId);
  const native=region?supportByRegion.get(region.id):null;
  const next={...sighting,classificationEvidence:sighting.classificationEvidence.map(evidence=>{
   const rows=evidence.rankings??[];
   const branchesByModel=new Map(rows.map(row=>[row.modelId,[]]));
   for(const group of expected){
    const frame=frameFor(input,group.recordKey),matches=Array.isArray(native?.groups)?native.groups.filter(row=>row?.frame?.recordKey===group.recordKey):[];
    let attached=null,unavailableReason=native?.unavailableReason??reason;
    if(matches.length===1){
     const match=matches[0];
     try{
      if(!sameFrame(frame,match.frame))throw Error('Native support frame differs from frozen appearance');
      if(!group.sourceBindingsValid||!sameFrame(frame,group.backgroundFrame))throw Error('Preserved background frame differs from frozen appearance');
      if(!Array.isArray(match.branchIds)||match.branchIds.length!==group.branchIds.length||match.branchIds.some(id=>!group.branchIds.includes(id)))throw Error('Native support branch set differs from preserved background');
      attached=attachNativeBodySupport(rows,{appearanceFrame:frame,backgroundFrame:group.backgroundFrame,branchIds:group.branchIds,bundle:match.bundle});
     }catch(e){unavailableReason=String(e?.message??e);}
    }else if(matches.length>1)unavailableReason='Duplicate native map-record group rejected';
    for(const row of rows){
     const support=attached?.rankings.find(value=>value.modelId===row.modelId)?.sourceNativeSupport;
     branchesByModel.get(row.modelId).push(...(support?support.branches.map(branch=>({...branch,recordKey:group.recordKey})):group.branchIds.map(id=>unknown(id,group.recordKey,unavailableReason))));
    }
   }
   return{...evidence,rankings:rows.map(row=>({...row,sourceNativeSupport:{modelId:row.modelId,kind:'conditional-source-native-own-support',...(workProgress?{workProgress:{...workProgress}}:{}),branches:branchesByModel.get(row.modelId),...(expected.length?{}:{unavailableReason:reason}),budget:clone(RESIDUAL_NATIVE_BODY_BUDGET),budgetStopped:result?.budgetStopped===true,complete:false,identityCertified:false,bodyExtentCertified:false,poseAndCameraCoverageComplete:false,unknownNonEnemyPossible:true,noEventPossible:true,minimumProvenATCalls:0}}))};
  })};
  next.cameraBodyAlternative=cameraAlternativeAttachment(next,{appearance,input,native});
  return next;
 })};
}
