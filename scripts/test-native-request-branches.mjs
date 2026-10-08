import assert from 'node:assert/strict';
import {nativeBodyRequestPayload} from '../web/map-browser-preview/native-body-request.mjs';
import {attachResidualNativeSupport} from '../web/map-browser-preview/residual-native-support.mjs';
import {runResidualRecognitionJob} from '../web/map-browser-preview/residual-recognition-job.mjs?v=native-async-20261008-43d9a67a';
import {dinoSpec} from '../web/monster-dinov2.mjs';

const clone=structuredClone;
const video={sourceId:'transport-regression',sourceEpoch:1,timelineSegment:1,frameSerial:1,mediaTime:12,fullRGBA_SHA256:'a'.repeat(64)};
const romSHA256='b'.repeat(64),models=['first','second'];
const branches=[0,1].map(i=>({branchId:'branch-'+i,recordKey:'map:'+i,mapId:i,romSHA256,fullRGBA_SHA256:video.fullRGBA_SHA256}));
const support={kind:'same-frame-background-branch-support-v1',ready:true,frame:video,passingBranchCount:branches.length,branches};
const input={regionIds:[9],regions:[{id:9,roi:{x:10,y:10,w:4,h:4}}],videoEvidence:video,backgroundEvidence:{romSHA256,backgroundBranchSupport:support},nativeVideo:{width:256,height:192,rgba:new Uint8Array(256*192*4)},nativeComparison:{},fullFrame:{},isNativeCurrent:()=>true};
const rankings=models.map((modelId,i)=>({modelId,speciesCandidates:[{monsterId:i+1}],similarity:1-i/10,distance:i/10,bodyFit:{unchanged:'legacy-thumbnail'}}));
const appearance={source:{modelPlan:{models:models.map(modelId=>({modelId}))}},sightings:[{originalProposalId:'9',conditionalBodyPrediction:{modelId:null,bodyFit:{unchanged:'legacy-thumbnail'}},classificationEvidence:[{rankings}]}],minimumProvenATCalls:0};
const result={kind:'automatic-source-native-body-support',regions:[{regionId:9,groups:branches.map(b=>{
 const frame={...video,romSHA256,recordKey:b.recordKey};
 return{frame,branchIds:[b.branchId],bundle:{kind:'per-candidate-source-native-body-support',renderer:'source-integer-original-GX-body-subset',frame,branches:[{branchId:b.branchId,assumptions:['synthetic complete support'],unknownAlternatives:['unsearched poses','background','party'],candidates:models.map((modelId,i)=>({modelId,testedProposals:1,unsupported:[{reason:'later poses remain unknown'}],candidateSource:{matchesBranchEncounterPlan:true},best:{proposalId:modelId,fit:{regionId:9,originalProposalSupport:{kind:'conditional-source-native-original-proposal-support-v1',ready:true,originalResidualId:9,sourcePixelSHA256:video.fullRGBA_SHA256,componentPixels:4,knownPixels:4,unavailablePixels:0,backgroundSSE:200,renderedSSE:100+i*10,pixelErrorReduction:100-i*10,outsideProposal:{pixelErrorReduction:0}},pixelErrorReduction:100-i*10,backgroundSSE:200,bodySSE:100+i*10,raster:'source-integer-original-GX-body-subset'},nativeBodyExtent:{frame,bodyColorOwnership:{ready:true,empty:false,completeWithinAdmittedRendererSubset:true,allVisibleContributionsCapturedWithinComposition:true,knownPixels:4,unavailablePixels:0,knownSpatialSupportRank:2,knownBodySpatiallyDegenerate:false}}}}))}]}};
})}]};
function compact(value){let p=value;for(let i=0;i<5;i++)p=nativeBodyRequestPayload(p);return{...p,regionIds:[...value.regionIds]};}
const baseline=attachResidualNativeSupport(appearance,{input,result});
const transported=compact(input),after=attachResidualNativeSupport(appearance,{input:transported,result});
assert.equal(transported.backgroundEvidence.backgroundBranchSupport.passingBranchCount,2);
assert.deepEqual(after,baseline);
assert.equal(after.sightings[0].cameraBodyAlternative.supportedModelId,'first');
assert.deepEqual(after.sightings[0].conditionalBodyPrediction,appearance.sightings[0].conditionalBodyPrediction);
assert.equal(after.minimumProvenATCalls,0);
for(const change of [s=>delete s.passingBranchCount,s=>s.passingBranchCount=3,s=>s.branches.pop()]){
 const bad=clone(transported);change(bad.backgroundEvidence.backgroundBranchSupport);
 const preserved=compact(bad);assert.equal(preserved.backgroundEvidence.backgroundBranchSupport.passingBranchCount,bad.backgroundEvidence.backgroundBranchSupport.passingBranchCount);
 const checked=attachResidualNativeSupport(appearance,{input:preserved,result});
 assert.equal(checked.sightings[0].cameraBodyAlternative.supportedModelId,null);
 assert.match(checked.sightings[0].cameraBodyAlternative.unavailableReason,/Complete retained background-branch support required/);
 assert.deepEqual(checked.sightings[0].conditionalBodyPrediction,appearance.sightings[0].conditionalBodyPrediction);
}
// Exercise the real detached continuation attachment, whose retainedInput is
// compacted while the first attachment receives the original rich input.
let scheduled=null,continued=null;
const client={epoch:1,sequence:1,cancellationVersion:0,classify:async()=>({inference:dinoSpec('wasm'),rankings}),nativeBodySupport:async request=>{assert.equal(request.backgroundEvidence.backgroundBranchSupport.passingBranchCount,2);return result;},scheduleNativeContinuation:args=>{scheduled=args;}};
const first=await runResidualRecognitionJob({input:{...input,onNativePartial:x=>continued=x},plan:appearance.source.modelPlan,variant:'_f',client,choose:async()=>({backend:'wasm',reason:'synthetic'}),makeRequest:()=>({captureStamp:{enemyROI:{x:0,y:0,w:1,h:1}},crop:{rgba:new Uint8Array(4)}}),makeBundle:()=>clone(appearance)});
assert(scheduled);scheduled.onResult(result);assert(continued);
assert.equal(first.sightings[0].cameraBodyAlternative.supportedModelId,'first');
assert.deepEqual(continued,first);
console.log(JSON.stringify({passed:true,branches:2,repeatedTransportPasses:5,originalCountPreserved:true,missingAndMismatchedCountsStayUnknown:true,realDetachedContinuationEqualsInitialAttachment:true,legacyPredictionUnchanged:true,ATUnchanged:true}));
