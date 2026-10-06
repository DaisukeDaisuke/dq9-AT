import {bindConditionalBodyPrediction} from '../web/map-browser-preview/conditional-body-map-compatibility.mjs';
import assert from 'node:assert/strict';
import {originalResidualProposalSupport} from '../web/map-browser-preview/residual-proposal-support.mjs';
import {fitRenderedBody,conditionalBodyPrediction} from '../web/monster-body-support.mjs';
const N=256*192,hash='a'.repeat(64),region={id:0,pixels:3,roi:{x:10,y:10,w:2,h:2}},mask=new Uint8Array(N),validMask=new Uint8Array(N).fill(1),video=new Uint8ClampedArray(N*4),background=new Uint8ClampedArray(N*4);
for(let i=0;i<N;i++)video[i*4+3]=background[i*4+3]=255;
for(const [x,y]of[[10,10],[11,10],[10,11]]){const i=y*256+x;mask[i]=1;video.set([200,20,20,255],i*4);}
// A separate component within the same frozen frame must not enter the mask.
mask[20*256+20]=1;video.set([200,20,20,255],(20*256+20)*4);
const comparison={residualMask:mask,validMask,alignedBackground:background,components:[region,{id:1,pixels:1,roi:{x:20,y:20,w:1,h:1}}],stats:{residualThreshold:32}},nativeVideo={width:256,height:192,rgba:video},binding={nativeVideo,sourcePixelSHA256:hash};
const support=originalResidualProposalSupport(comparison,region,binding);assert.equal(support.ready,true);assert.equal(support.mask.reduce((a,b)=>a+b,0),3);assert.equal(support.mask[20*256+20],0);assert.equal(support.sourcePixelSHA256,hash);
const template={width:2,height:2,rgba:Uint8ClampedArray.from([200,20,20,255,200,20,20,255,200,20,20,255,0,0,0,0])},evidence={width:256,height:192,videoRGBA:video,backgroundRGBA:background,validMask,region,sourcePixelSHA256:hash};
const before=fitRenderedBody(template,evidence),after=fitRenderedBody(template,{...evidence,originalProposalSupport:support}),strip=({originalProposalSupport,...r})=>r;
assert.deepEqual(strip(after),strip(before));assert.equal(after.originalProposalSupport.pixelErrorReduction,after.pixelErrorReduction);assert.equal(after.originalProposalSupport.outsideProposal.pixelErrorReduction,0);
const predictionBinding={sourcePixelSHA256:hash,originalResidualId:region.id};
const ranking={modelId:'synthetic',speciesCandidates:[{monsterId:1}],similarity:.9,bodyFit:after};
assert.equal(conditionalBodyPrediction([ranking],predictionBinding).modelId,'synthetic');
for(const gain of[-1,0]){const r=structuredClone(ranking),own=r.bodyFit.originalProposalSupport;own.pixelErrorReduction=gain;own.backgroundSSE=100;own.renderedBodySSE=100-gain;own.outsideProposal.pixelErrorReduction=r.bodyFit.pixelErrorReduction-gain;const p=conditionalBodyPrediction([r],predictionBinding);assert.equal(p.modelId,null);assert.equal(p.proposalSupportDecision.unattributedModelId,'synthetic');assert.equal(p.proposalSupportDecision.bindingDeferred,true);assert.equal(p.proposalSupportDecision.status,'original-proposal-not-improved');assert.deepEqual(p.bodyFit,r.bodyFit);assert.equal(p.alternatives[0].pixelErrorReduction,r.bodyFit.pixelErrorReduction);assert.equal(p.noEventPossible,true);assert.equal(p.minimumProvenATCalls,0);}
for(const invalid of [{},{...predictionBinding,sourcePixelSHA256:'b'.repeat(64)},{...predictionBinding,originalResidualId:1}])assert.equal(conditionalBodyPrediction([ranking],invalid).proposalSupportDecision.status,'original-proposal-support-unavailable');
const missing=conditionalBodyPrediction([{...ranking,bodyFit:before}],predictionBinding);assert.equal(missing.modelId,null);assert.equal(missing.proposalSupportDecision.status,'original-proposal-support-unavailable');
for(const mutate of[c=>delete c.residualMask,c=>c.residualMask[10*256+10]=0,c=>c.components[0].pixels++,c=>c.stats.residualThreshold=255,c=>c.validMask[10*256+10]=0]){const c=structuredClone(comparison);mutate(c);assert.equal(originalResidualProposalSupport(c,region,binding).ready,false);}
const changedVideo=structuredClone(nativeVideo);changedVideo.rgba[10*256*4+10*4]=0;changedVideo.rgba[10*256*4+10*4+1]=0;changedVideo.rgba[10*256*4+10*4+2]=0;assert.equal(originalResidualProposalSupport(comparison,region,{nativeVideo:changedVideo,sourcePixelSHA256:hash}).ready,false);
assert.equal(originalResidualProposalSupport(comparison,region,{nativeVideo}).ready,false);
const mismatched=fitRenderedBody(template,{...evidence,originalProposalSupport:{...support,sourcePixelSHA256:'b'.repeat(64)}});assert.equal(mismatched.originalProposalSupport.ready,false);assert.deepEqual(strip(mismatched),strip(after));
// Numerical score remains complete even if support metadata is unavailable.
const unknownPixel=structuredClone(support);unknownPixel.mask[20*256+20]=1;assert.equal(fitRenderedBody(template,{...evidence,originalProposalSupport:unknownPixel}).originalProposalSupport.ready,false);
// Keep every preexisting selection guard and full-fit ordering. A runner-up
// cannot replace a higher full-fit candidate merely to pass attribution.
for(const change of [r=>r.bodyFit.spatialSupportRank=1,r=>r.bodyFit.backgroundOnlyPreferred=true]){const r=structuredClone(ranking);change(r);assert.equal(conditionalBodyPrediction([r],predictionBinding).modelId,null);}
const contaminated=structuredClone(ranking);contaminated.bodyFit.originalProposalSupport.pixelErrorReduction=-1;contaminated.bodyFit.originalProposalSupport.backgroundSSE=0;contaminated.bodyFit.originalProposalSupport.renderedBodySSE=1;
const rival=structuredClone(ranking);rival.modelId='rival';rival.similarity=.8;rival.bodyFit.pixelErrorReduction-=1;
const notReranked=conditionalBodyPrediction([contaminated,rival],predictionBinding);assert.equal(notReranked.modelId,null);assert.equal(notReranked.bodyModelId,'synthetic');assert.equal(notReranked.alternatives.length,2);assert.equal(notReranked.proposalSupportDecision.unattributedModelId,'synthetic');
const mapBound=bindConditionalBodyPrediction(notReranked,{plan:{models:[{modelId:'synthetic',speciesCandidates:[{monsterId:1}],origins:[{mapId:1,tableId:1,monsterId:1}]}]},videoEvidence:{sourceId:'fixture',sourceEpoch:1,timelineSegment:1,mediaTime:1,fullRGBA_SHA256:hash},backgroundEvidence:{romSHA256:'b'.repeat(64),mapId:1,recordKey:'map:1'}});assert.equal(mapBound.modelId,null);assert.deepEqual(mapBound.speciesCandidates,[]);assert(mapBound.mapCompatibility);assert.equal(mapBound.proposalSupportDecision.unattributedModelId,'synthetic');assert.deepEqual(mapBound.bodyFit,notReranked.bodyFit);
const tied=structuredClone(rival);tied.bodyFit.pixelErrorReduction=ranking.bodyFit.pixelErrorReduction;assert.equal(conditionalBodyPrediction([ranking,tied],predictionBinding).modelId,null);
console.log(JSON.stringify({passed:true,exactComponentMask:true,frozenPixelAndHashBinding:true,fullFitUnchanged:true,negativeZeroMissingSupportRemainUnbound:true,neighborSupportPreserved:true,noSizeOrTunedScoreCutoff:true,unknownAndATPreserved:true}));
