import {attachNativeBodySupport} from '../monster-native-support.mjs';

// Cooperative work budget for the entire frozen set, including preparation.
// Synchronous source work cannot be preempted, so this is not a hard elapsed-
// time guarantee. Every untested model/branch remains unknown.
export const RESIDUAL_NATIVE_BODY_BUDGET=Object.freeze({wallTimeMs:1500,maxProposals:128});
// Optional result wait only: expiry preserves the shared worker and caches.
export const RESIDUAL_NATIVE_BODY_OPTIONAL_WAIT_MS=2000;
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

// Only the optional sourceNativeSupport field is merged. Reusing the already
// built observation bundle leaves bodyFit, conditionalBodyPrediction, AT and
// appearance order byte-for-byte equivalent after this field is removed.
export function attachResidualNativeSupport(appearance,{input,result=null,error=null}){
 if(!Array.isArray(appearance.sightings))return appearance;
 const failure=error?String(error?.message??error):null;
 let expected=[],setupError=null;
 try{expected=groupsFromBackground(input);}catch(e){setupError=e.message;}
 const valid=result?.kind==='automatic-source-native-body-support'&&Array.isArray(result.regions);
 const reason=failure??setupError??(valid?'Native body candidate/branch not evaluated':'Automatic source-native body result unavailable');
 const supportByRegion=new Map();
 for(const regionId of input.regionIds){
  const matching=valid?result.regions.filter(row=>row?.regionId===regionId):[];
  supportByRegion.set(regionId,matching.length===1?matching[0]:null);
 }
 return{...appearance,sightings:appearance.sightings.map(sighting=>{
  const region=input.regions.find(row=>String(row.id)===sighting.originalProposalId);
  const native=region?supportByRegion.get(region.id):null;
  return{...sighting,classificationEvidence:sighting.classificationEvidence.map(evidence=>{
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
   return{...evidence,rankings:rows.map(row=>({...row,sourceNativeSupport:{modelId:row.modelId,kind:'conditional-source-native-own-support',branches:branchesByModel.get(row.modelId),...(expected.length?{}:{unavailableReason:reason}),budget:clone(RESIDUAL_NATIVE_BODY_BUDGET),budgetStopped:result?.budgetStopped===true,complete:false,identityCertified:false,bodyExtentCertified:false,poseAndCameraCoverageComplete:false,unknownNonEnemyPossible:true,noEventPossible:true,minimumProvenATCalls:0}}))};
  })};
 })};
}
