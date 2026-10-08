import {completeNativeBodyPoseSupport} from './monster-camera-body-alternative.mjs?v=route-poses-20261008-d98f497f';
import {completeNativeBodyComparison} from './monster-native-comparison-support.mjs';
import {nativeOriginalProposalDecision} from './monster-native-proposal-support.mjs';
const copy=structuredClone;
export const isRouteHeadingProposal=p=>['conditional-ROM-route-heading-priority','conditional-ROM-current-root-heading-priority'].includes(p?.sourcePlacement?.placementKind);
const sourceKey=p=>JSON.stringify([p.id,p.positionFx,p.pose]);
const matchesProposal=(best,p)=>best?.proposalId===p?.id&&JSON.stringify(best.positionFx)===JSON.stringify(p.positionFx)&&JSON.stringify(best.pose)===JSON.stringify(p.pose);
function positiveComplete(best,expected){return best&&completeNativeBodyPoseSupport(best)&&completeNativeBodyComparison(best,expected)&&best.fit.pixelErrorReduction>0&&nativeOriginalProposalDecision(best.fit,{sourcePixelSHA256:expected.frame.fullRGBA_SHA256,originalResidualId:expected.originalResidualId}).positive===true;}
// Each job owns a finite set of proposals from finite ROM nodes and frozen root
// seeds. No score promotes a proposal into a certified actor or new RNG draw.
export function registerNativeRoutePoseDomain(job,proposals){
 job.routePoseKeys??=new Set();for(const p of proposals)if(isRouteHeadingProposal(p))job.routePoseKeys.add(sourceKey(p));
 job.result.routePoseSupport??={kind:'retained-current-source-route-poses-v1',entries:[],evaluated:[],registeredProposals:0,identityCertified:false,currentPoseCertified:false,unknownAlternativeRetained:true,minimumProvenATCalls:0};
 if(!job.result.routePoseSupport.originalBest&&job.result.best&&!isRouteHeadingProposal({sourcePlacement:job.result.best.sourcePlacement}))job.result.routePoseSupport.originalBest=copy(job.result.best);
 job.result.routePoseSupport.registeredProposals=job.routePoseKeys.size;
}
export function retainNativeRoutePose(job,row,proposal,expected){
 if(!isRouteHeadingProposal(proposal)){const bank=job.result.routePoseSupport;if(bank&&row.best&&(!bank.originalBest||row.best.fit.pixelErrorReduction>bank.originalBest.fit.pixelErrorReduction))bank.originalBest=copy({...row.best,sourcePlacement:proposal.sourcePlacement});return false;}
 if(!job.routePoseKeys?.has(sourceKey(proposal)))return false;
 const bank=job.result.routePoseSupport,record={proposalId:proposal.id,positionFx:proposal.positionFx.slice(),pose:copy(proposal.pose),sourceTargets:copy(proposal.sourcePlacement.routeHeading?.targets??[]),testedProposals:row.testedProposals,comparisonReady:!!row.best&&completeNativeBodyComparison(row.best,expected),pixelErrorReduction:row.best?.fit?.pixelErrorReduction??null,originalProposalSupport:row.best?nativeOriginalProposalDecision(row.best.fit,{sourcePixelSHA256:expected.frame.fullRGBA_SHA256,originalResidualId:expected.originalResidualId}):null,unsupported:copy(row.unsupported??[]),positiveComplete:false};
 const best=row.best?{...row.best,sourcePlacement:proposal.sourcePlacement}:null;record.positiveComplete=matchesProposal(best,proposal)&&!!positiveComplete(best,expected);
 bank.evaluated.push(record);
 if(!record.positiveComplete)return false;
 if(!bank.entries.some(e=>e.proposalId===best.proposalId))bank.entries.push(copy(best));
 return true;
}
export function currentTestedRouteHeadingSeed(row,proposal,expected){
 const best=row?.best;
 if(isRouteHeadingProposal(proposal)||!matchesProposal(best,proposal)||!positiveComplete(best,expected)||proposal.sourcePlacement?.originOnFloorAssumed!==true||typeof proposal.sourcePlacement.planeKey!=='string'||best.pose?.phaseFx!==undefined||best.pose?.actionCondition!==undefined)return null;
 return {id:'current-tested-root:'+proposal.id,positionFx:best.positionFx.slice(),pose:copy(best.pose),sourcePlacement:{...copy(proposal.sourcePlacement),placementKind:'conditional-tested-native-root-heading-seed',sourceTestedRootProposalId:best.proposalId,sourceTestedRootFrame:copy(expected.frame),currentRootCertified:false,identityCertified:false,priorSupportReused:false}};
}
// Resolve retained alternatives against the branch's independently admitted
// comparison tuple. The species gate still belongs to its original best model.
export function validatedRetainedNativeRoutePoses(branch,{frame,modelId,originalResidualId}){
 const bank=branch?.routePoseSupport,base=branch?.best?.nativeComparisonSupport;
 if(bank?.kind!=='retained-current-source-route-poses-v1'||!Array.isArray(bank.entries)||!base)return [];
 const expected={frame,camera:base.camera,alignment:base.alignment,backgroundRGBA_SHA256:base.comparisonBinding?.backgroundRGBA_SHA256,modelId,originalResidualId};
 if(!completeNativeBodyComparison(branch.best,expected))return [];
 return bank.entries.filter(best=>isRouteHeadingProposal({sourcePlacement:best.sourcePlacement})&&bank.evaluated?.some(row=>row.proposalId===best.proposalId&&row.positiveComplete===true&&JSON.stringify(row.positionFx)===JSON.stringify(best.positionFx)&&JSON.stringify(row.pose)===JSON.stringify(best.pose))&&positiveComplete(best,expected));
}
