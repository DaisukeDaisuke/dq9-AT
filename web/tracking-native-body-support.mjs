import {validatedRetainedNativeRoutePoses} from './monster-native-route-pose-support.mjs?v=route-poses-20261008-d98f497f';
import {buildNativeMotionContinuity} from './tracking-native-motion.mjs?v=route-poses-20261008-d98f497f';
// Compact machine-readable native support for tracking, not an entity merger.
// The caller supplies each sighting's OWN model plan and map/frame provenance.
// Scores remain descriptive. No overlap/IoU threshold, source-pose search,
// identity selection, track assignment, event count, or AT predicate is added.
// Bound source roots also feed conditional cross-frame predecessor candidates.
const finite=Number.isFinite,integer=Number.isSafeInteger;
const scalar=v=>v===null||['string','boolean'].includes(typeof v)||(typeof v==='number'&&finite(v));
const fields=(v,keys)=>v?Object.fromEntries(keys.filter(k=>scalar(v[k])).map(k=>[k,v[k]])):null;
const box=r=>r?fields(r,['x','y','w','h']):null;
const frameKeys=['romSHA256','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const ownedKinds=new Set(['isolated-source-opaque-binary-body-coverage','source-final-body-color-ownership']);
const roi=r=>r&&['x','y','w','h'].every(k=>finite(r[k]))&&r.w>0&&r.h>0;
function summary(value,ownership=false){
 if(!value||typeof value.ready!=='boolean')return null;
 if(!value.ready)return{ready:false,empty:null,roi:null,pixels:null,reason:typeof value.reason==='string'?value.reason.slice(0,512):'Native source extent unsupported'};
 if(ownership&&!ownedKinds.has(value.kind))return null;
 if(!integer(value.pixels)||value.pixels<0||value.pixels>49152||value.empty!==(value.pixels===0))return null;
 if(value.pixels===0?value.roi!==null:!roi(value.roi)||!['x','y','w','h'].every(k=>integer(value.roi[k]))||value.roi.x<0||value.roi.y<0||value.roi.x+value.roi.w>256||value.roi.y+value.roi.h>192||value.pixels>value.roi.w*value.roi.h)return null;
 if(!integer(value.knownPixels)||!integer(value.unavailablePixels)||Math.min(value.knownPixels,value.unavailablePixels)<0||value.knownPixels+value.unavailablePixels!==value.pixels)return null;
 return {...fields(value,['ready','empty','kind','pixels','knownPixels','unavailablePixels','outsideFramePixels','clippedByAlignment','completeWithinAdmittedRendererSubset','allSceneOcclusionReconstructed','allVisibleContributionsCapturedWithinComposition','mayOmitEarlierBodyContributionThroughLaterMapBlending']),roi:box(value.roi)};
}
function projected(value){
 if(!value||typeof value.ready!=='boolean')return null;
 if(!value.ready)return{ready:false,reason:typeof value.reason==='string'?value.reason.slice(0,512):'Projected source envelope unavailable'};
 if(value.kind!=='source-emitted-geometric-envelope'||!value.roi||!['x','y','w','h'].every(k=>finite(value.roi[k]))||value.roi.w<0||value.roi.h<0)return null;
 return {...fields(value,['ready','kind','sourcePolygons','textureAlphaApplied','sceneOcclusionApplied']),roi:box(value.roi),center:Array.isArray(value.center)&&value.center.length===2&&value.center.every(finite)?value.center.slice():null};
}
function expectedFrame(s,map){
 const f=map?.frame;
 if(!f||f.frameKey!==s.frameKey||f.sourcePTS!==s.sourcePTS)return null;
 const frame={romSHA256:f.romSHA256,sourceId:f.sourceId,sourceEpoch:f.sourceEpoch,timelineSegment:f.timelineSegment,mediaTime:f.sourcePTS,fullRGBA_SHA256:f.fullRGBA_SHA256};
 if(!['romSHA256','fullRGBA_SHA256'].every(k=>/^[a-f0-9]{64}$/.test(frame[k]??''))||typeof frame.sourceId!=='string'||!frame.sourceId||!['sourceEpoch','timelineSegment'].every(k=>integer(frame[k])&&frame[k]>=0)||!finite(frame.mediaTime))return null;
 return frame;
}
function bind({s,plan,mapProvenance,ranking,support,branch,expected}){
 if(!support||support.modelId!==ranking.modelId)return{ready:false,reason:'Native support missing or attached to a different model'};
 if(!branch)return{ready:false,reason:'No native camera branch was supplied'};
 const best=branch.best;
 if(!best)return{ready:false,reason:'No tested native proposal; unsupported and untested alternatives remain'};
 if(!expected)return{ready:false,reason:'Sighting own-frame provenance unavailable or inconsistent'};
 const models=Array.isArray(plan?.models)?plan.models.filter(m=>m?.modelId===ranking.modelId):[],model=models[0];
 if(models.length!==1||!model||!['_f','regular'].includes(model.variant))return{ready:false,reason:'Own-frame source model/variant provenance unavailable'};
 if(typeof branch.branchId!=='string'||typeof branch.recordKey!=='string')return{ready:false,reason:'Native branch/record binding unavailable'};
 if(support.branches.filter(b=>b?.branchId===branch.branchId&&b?.recordKey===branch.recordKey).length!==1)return{ready:false,reason:'Duplicate native branch/record evidence is ambiguous'};
 const matches=(Array.isArray(mapProvenance?.survivingBackgroundCandidates)?mapProvenance.survivingBackgroundCandidates:[]).filter(b=>b?.branchId===branch.branchId&&b.recordKey===branch.recordKey&&b.accepted===true);
 if(matches.length!==1)return{ready:false,reason:'Native branch is not a unique retained own-frame background branch'};
 const e=best.nativeBodyExtent;
 if(e?.kind!=='conditional-source-native-body-extent-v1'||e.width!==256||e.height!==192||frameKeys.some(k=>e.frame?.[k]!==expected[k])||e.frame?.recordKey!==branch.recordKey)return{ready:false,reason:'Native extent source/frame/ROM/record binding differs from sighting'};
 if(e.bodyExtentCertified!==false||e.identityCertified!==false||e.actorMembershipCertified!==false||e.observedBodyCountCertified!==false||e.minimumProvenATCalls!==0)return{ready:false,reason:'Native extent contains an unsupported certification claim'};
 const p=best.pose,pos=best.positionFx;
 if(typeof best.proposalId!=='string'||!best.proposalId||typeof p?.clip!=='string'||(p.clip==='bind'?p.frame!==null:!integer(p.frame)||p.frame<0)||!integer(p.actorScaleFx)||p.actorScaleFx<=0||p.actorScaleFx>=32768||!integer(p.yawFx)||p.yawFx< -2147483648||p.yawFx>2147483647||!Array.isArray(pos)||pos.length!==3||!pos.every(x=>integer(x)&&x>=-2147483648&&x<=2147483647))return{ready:false,reason:'Tested source pose/root/proposal reference unavailable or invalid'};
 const fit=best.fit;
 if(!['pixelErrorReduction','backgroundSSE','bodySSE'].every(k=>finite(fit?.[k]))||!['bodyPixels','knownBodyPixels','unavailableBodyPixels'].every(k=>integer(fit?.[k])&&fit[k]>=0&&fit[k]<=49152)||fit.knownBodyPixels+fit.unavailableBodyPixels!==fit.bodyPixels||branch.status!=='evaluated-subset'||branch.ownGain!==fit.pixelErrorReduction||!integer(branch.testedProposals)||branch.testedProposals<=0||String(fit.regionId)!==String(s.originalProposalId))return{ready:false,reason:'Tested native score/residual reference is inconsistent'};
 const bodyColorOwnership=summary(e.bodyColorOwnership,true),rasterFootprint=summary(e.rasterFootprint),projectedEnvelope=projected(e.projectedEnvelope);
 if(!bodyColorOwnership||!rasterFootprint||!projectedEnvelope)return{ready:false,reason:'Native ownership/footprint/envelope summary malformed'};
 return{ready:true,variant:model.variant,extent:{bodyExtentCertified:false,identityCertified:false,actorMembershipCertified:false,minimumProvenATCalls:0,sourceAcceptedSubset:typeof e.sourceAcceptedSubset==='string'?e.sourceAcceptedSubset:null,sceneOcclusionApplied:e.sceneOcclusionApplied===true,bodyColorOwnership,rasterFootprint,projectedEnvelope}};
}
/** One compact observation per original sighting. Hypothesis references retain
 * original sighting/frame/branch/model/proposal keys, pose and root separately.
 * Overlapping boxes or equal model IDs never collapse these records. No full
 * frame masks, raw source branches, material programs or source pixel arrays
 * are copied into this companion. Original evidence remains in the bundle. */
export function collectNativeTrackingBodySupport(rows){
 const observations=[];
 for(const {s,plan,mapProvenance}of rows){
  const frame=expectedFrame(s,mapProvenance),alternatives=[];
  for(const [evidenceIndex,evidence]of (Array.isArray(s.classificationEvidence)?s.classificationEvidence:[]).entries())for(const [rankingIndex,rawRanking]of (Array.isArray(evidence?.rankings)?evidence.rankings:[]).entries()){
   const ranking=rawRanking??{};
   const support=ranking.sourceNativeSupport,branches=Array.isArray(support?.branches)&&support.branches.length?support.branches:[null];
   for(const [branchIndex,originalBranch]of branches.entries()){
    const retained=validatedRetainedNativeRoutePoses(originalBranch,{frame:{...frame,recordKey:originalBranch?.recordKey},modelId:ranking.modelId,originalResidualId:Number(s.originalProposalId)}).filter(best=>best.proposalId!==originalBranch?.best?.proposalId);
    for(const [poseIndex,branch] of [originalBranch,...retained.map(best=>({...originalBranch,best,ownGain:best.fit.pixelErrorReduction}))].entries()){
    const best=branch?.best;let binding;
    try{binding=bind({s,plan,mapProvenance,ranking,support,branch,expected:frame});}catch(error){binding={ready:false,reason:'Optional native tracking metadata unavailable: '+String(error.message).slice(0,512)};}
    alternatives.push({evidenceIndex,rankingIndex,branchIndex:branch?branchIndex:null,modelId:typeof ranking.modelId==='string'?ranking.modelId:null,branchId:typeof branch?.branchId==='string'?branch.branchId:null,recordKey:typeof branch?.recordKey==='string'?branch.recordKey:null,proposalId:typeof best?.proposalId==='string'?best.proposalId:null,...(poseIndex?{sourcePoseReference:{kind:'retained-route-pose',proposalId:best.proposalId}}:{}),...(best?.sourcePlacement?.routeHeading?{routeHeading:structuredClone(best.sourcePlacement.routeHeading)}:{}),status:typeof branch?.status==='string'?branch.status:'unavailable',ownGain:finite(branch?.ownGain)?branch.ownGain:null,testedProposals:integer(branch?.testedProposals)?branch.testedProposals:null,binding:fields(binding,['ready','reason']),variant:binding.ready?binding.variant:null,pose:fields(best?.pose,['clip','frame','actorScaleFx','yawFx']),positionFx:Array.isArray(best?.positionFx)&&best.positionFx.length===3&&best.positionFx.every(finite)?best.positionFx.slice():null,fit:fields(best?.fit,['pixelErrorReduction','backgroundSSE','bodySSE','bodyPixels','knownBodyPixels','unavailableBodyPixels']),extent:binding.ready?binding.extent:null,unknownRetained:true,noEventPossible:true});
    }
   }
  }
  const h=s.tentativeImageTrack;
  observations.push({sightingId:s.id,frameKey:typeof s.frameKey==='string'?s.frameKey:null,sourcePTS:finite(s.sourcePTS)?s.sourcePTS:null,originalProposalId:typeof s.originalProposalId==='string'?s.originalProposalId:null,frame,...(alternatives.length?{}:{nativeSupportUnavailableReason:'No per-candidate native support records in sighting'}),tentativeImageTrack:h?{...fields(h,['kind','trackId','association','frameKey','sourcePTS','proposalId']),sameObservationBinding:Boolean(frame&&h.frameKey===s.frameKey&&h.sourcePTS===s.sourcePTS&&h.proposalId===s.originalProposalId&&Array.isArray(h.sourceIdentity)&&h.sourceIdentity.length===3&&h.sourceIdentity.every((x,i)=>x===[frame.sourceId,frame.sourceEpoch,frame.timelineSegment][i])),sourceIdentity:Array.isArray(h.sourceIdentity)&&h.sourceIdentity.length===3&&h.sourceIdentity.every(scalar)?h.sourceIdentity.slice():null}:null,alternatives,associationAlternatives:['same-entity','different-entity','observation-error'],identityCertified:false,actorMembershipCertified:false,independentDrawCertified:false,minimumProvenATCalls:0});
 }
 return{schema:'conditional-native-tracking-body-support-v1',observations,motionContinuity:buildNativeMotionContinuity(observations),originalSightingsPreserved:true,sourceHypothesisKeysPreserved:true,sameModelImpliesSameActor:false,boxOverlapImpliesSameActor:false,actorCount:null,associationCertified:false,identityCertified:false,minimumProvenATCalls:0,usedForATConstraints:false,complete:false,scope:'Per-sighting conditional tested native extents for later tracking. Shared models, overlapping envelopes and separate residual tracks neither merge actors nor prove distinct actors. No native score selects species or creates an AT event. Unsupported bindings stay explicit; original full evidence remains in the observation bundle.'};
}
