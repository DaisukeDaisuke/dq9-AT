import assert from 'node:assert/strict';
import {comparePerspectiveBody} from '../web/monster-perspective-body.mjs';
import {compareCameraBodyAlternative} from '../web/monster-camera-body-alternative.mjs?v=route-poses-20261008-d98f497f';
import {nativeBodyRequestPayload} from '../web/map-browser-preview/native-body-request.mjs';
import {nativeWorkIdentity} from '../web/monster-native-work-identity.mjs';
import {projectMode1MseSceneHypothesis,validateMode1MseSceneHypothesis} from '../web/map-browser-preview/mode1-mse-scene-hypothesis.mjs';
const N=49152,sha='a'.repeat(64),rom='b'.repeat(64),videoRGBA=new Uint8ClampedArray(N*4),backgroundRGBA=new Uint8ClampedArray(N*4),rgba=new Uint8ClampedArray(N*4),validMask=new Uint8Array(N).fill(1),mask=new Uint8Array(N),own=[257,258,513,514],outside=[259,260,515,516],region={id:9,pixels:4,roi:{x:1,y:1,w:2,h:2}};
for(let i=0;i<N;i++){backgroundRGBA[i*4+3]=videoRGBA[i*4+3]=255;}
for(const i of own){mask[i]=1;videoRGBA.set([10,10,10,255],i*4);rgba.set([100,100,100,255],i*4);}
for(const i of outside){videoRGBA.set([200,200,200,255],i*4);rgba.set([200,200,200,255],i*4);}
const proposal={kind:'original-residual-component-support-v1',ready:true,pixelBinding:'same-frozen-native-video-background-residual-mask',sourcePixelSHA256:sha,originalResidualId:9,pixels:4,roi:region.roi,mask,absenceCertified:false},render={width:256,height:192,rgba,raster:'source-integer-original-GX-body-subset',sourceAcceptedSubset:'isolated-opaque-binary-body-polygons',sceneOcclusionApplied:false},base={videoRGBA,backgroundRGBA,validMask,region},old=comparePerspectiveBody(render,base),current=comparePerspectiveBody(render,{...base,sourcePixelSHA256:sha,originalProposalSupport:proposal}),{originalProposalSupport,...unchanged}=current;
assert.deepEqual(unchanged,old);assert(current.pixelErrorReduction>0);assert(originalProposalSupport.pixelErrorReduction<0);assert.equal(originalProposalSupport.pixelErrorReduction+originalProposalSupport.outsideProposal.pixelErrorReduction,current.pixelErrorReduction);assert.equal(originalProposalSupport.bodyContributionCertified,false);
const frame={romSHA256:rom,recordKey:'map:1',sourceId:'synthetic',sourceEpoch:1,timelineSegment:1,mediaTime:1,fullRGBA_SHA256:sha},extent={frame,bodyColorOwnership:{ready:true,empty:false,completeWithinAdmittedRendererSubset:true,allVisibleContributionsCapturedWithinComposition:true,knownPixels:8,unavailablePixels:0,knownSpatialSupportRank:2,knownBodySpatiallyDegenerate:false}},rankings=[{modelId:'a',similarity:1,speciesCandidates:[{monsterId:1}]}],best={proposalId:'fixed',fit:current,nativeBodyExtent:extent},args={appearanceFrame:frame,rankings,legacyPrediction:{modelId:null},backgroundBranchSupport:{kind:'same-frame-background-branch-support-v1',ready:true,frame,passingBranchCount:1,branches:[{branchId:'b',recordKey:'map:1',romSHA256:rom,fullRGBA_SHA256:sha}]},sourceBranches:[{branchId:'b',frame,renderer:'source-integer-original-GX-body-subset',candidates:[{modelId:'a',testedProposals:1,unsupported:[{reason:'untested retained'}],candidateSource:{matchesBranchEncounterPlan:true},best}]}],expectedModelIds:['a'],originalResidualId:9};
let alternative=compareCameraBodyAlternative(args);assert.equal(alternative.supportedModelId,null);assert.equal(alternative.unattributedModelId,'a');assert(alternative.proposalBindingDeferred);assert.equal(alternative.branches[0].candidates[0].pixelErrorReduction,current.pixelErrorReduction);assert.deepEqual(alternative.legacyPrediction,args.legacyPrediction);
for(const i of own)rgba.set([10,10,10,255],i*4);best.fit=comparePerspectiveBody(render,{...base,sourcePixelSHA256:sha,originalProposalSupport:proposal});alternative=compareCameraBodyAlternative(args);assert.equal(alternative.supportedModelId,'a');assert.equal(alternative.identityCertified,false);assert.equal(alternative.minimumProvenATCalls,0);
const positive=structuredClone(best.fit);
for(const change of [x=>x.sourcePixelSHA256='c'.repeat(64),x=>x.originalResidualId=10,x=>x.knownPixels=3,x=>x.unavailablePixels=1,x=>x.pixelErrorReduction++,x=>x.outsideProposal.pixelErrorReduction++]){best.fit=structuredClone(positive);change(best.fit.originalProposalSupport);assert.equal(compareCameraBodyAlternative(args).supportedModelId,null);}
best.fit=positive;extent.bodyColorOwnership.allVisibleContributionsCapturedWithinComposition=false;assert.equal(compareCameraBodyAlternative(args).supportedModelId,null);extent.bodyColorOwnership.allVisibleContributionsCapturedWithinComposition=true;
// Both exact source raster subtypes share the same fail-closed comparison.
// These complete synthetic ownership claims exercise the contract, not the
// completeness of any real composed final-writer mask.
const rasterSubtypes=['source-integer-original-GX-body-subset','source-integer-original-GX-body-composition-subset'];
function completeComparison(raster){
 const input=structuredClone(args);input.sourceBranches[0].candidates[0].best.fit=structuredClone(positive);
 const rival=structuredClone(input.sourceBranches[0].candidates[0]);rival.modelId='rival';rival.best.proposalId='rival';
 rival.best.fit.bodySSE+=100;rival.best.fit.pixelErrorReduction-=100;rival.best.fit.originalProposalSupport.renderedSSE+=100;rival.best.fit.originalProposalSupport.pixelErrorReduction-=100;
 input.sourceBranches[0].candidates.push(rival);input.expectedModelIds.push('rival');input.rankings.push({modelId:'rival',similarity:.5,speciesCandidates:[{monsterId:2}]});
 const other=structuredClone(input.sourceBranches[0]);other.branchId='other';input.sourceBranches.push(other);
 input.backgroundBranchSupport.branches.push({...input.backgroundBranchSupport.branches[0],branchId:'other'});input.backgroundBranchSupport.passingBranchCount++;
 for(const branch of input.sourceBranches)for(const candidate of branch.candidates)candidate.best.fit.raster=raster;
 return input;
}
const isolatedComparison=compareCameraBodyAlternative(completeComparison(rasterSubtypes[0]));
assert.equal(isolatedComparison.supportedModelId,'a');assert.equal(isolatedComparison.branches.length,2);
let rasterNegativeControls=0;
for(const raster of rasterSubtypes){
 const input=completeComparison(raster),unchangedInput=structuredClone(input),result=compareCameraBodyAlternative(input);
 assert.deepEqual(result,isolatedComparison);assert.deepEqual(input,unchangedInput);
 for(const key of ['bodyHypothesisCoverageComplete','identityCertified','bodyExtentCertified','certifiedObservation','legacyPredictionChanged','legacyVetoApplied','appearanceOrderChanged'])assert.equal(result[key],false);
 for(const key of ['unknownNonEnemyPossible','playerPossible','backgroundErrorPossible','missingSourceStatePossible','noEventPossible','conditionalHypothesisOnly'])assert.equal(result[key],true);
 assert.equal(result.minimumProvenATCalls,0);
 const candidate=x=>x.sourceBranches[0].candidates[0],fit=x=>candidate(x).best.fit,ownership=x=>candidate(x).best.nativeBodyExtent.bodyColorOwnership;
 const checks=[
  x=>x.sourceBranches[0].renderer='source-integer-original-GX-body-composition-subset',
  x=>x.sourceBranches[0].frame={...x.sourceBranches[0].frame,recordKey:'map:other'},
  x=>candidate(x).best.nativeBodyExtent.frame={...candidate(x).best.nativeBodyExtent.frame,recordKey:'map:other'},
  ...['romSHA256','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'].map(k=>x=>candidate(x).best.nativeBodyExtent.frame={...candidate(x).best.nativeBodyExtent.frame,[k]:null}),
  x=>candidate(x).testedProposals=0,x=>candidate(x).testedProposals=1.5,
  x=>fit(x).pixelErrorReduction=NaN,x=>fit(x).backgroundSSE=Infinity,x=>fit(x).bodySSE=-1,x=>fit(x).pixelErrorReduction++,
  ...[undefined,'continuous-perspective-CPU-not-native','source-integer-original-GX-body-composition-subset-fake',{}].map(r=>x=>fit(x).raster=r),
  x=>delete candidate(x).best.nativeBodyExtent.bodyColorOwnership,
  ...['ready','completeWithinAdmittedRendererSubset','allVisibleContributionsCapturedWithinComposition'].map(k=>x=>ownership(x)[k]=false),
  x=>ownership(x).empty=true,x=>ownership(x).knownPixels=0,x=>ownership(x).knownPixels=1.5,x=>ownership(x).unavailablePixels=1,x=>ownership(x).knownSpatialSupportRank=1,x=>ownership(x).knownBodySpatiallyDegenerate=true,
  x=>{candidate(x).best.nativeBodyExtent.bodyColorDependency=structuredClone(ownership(x));delete candidate(x).best.nativeBodyExtent.bodyColorOwnership;},
  x=>x.sourceBranches[0].candidates.pop(),x=>x.sourceBranches.pop(),
  x=>x.sourceBranches[0].candidates.push(structuredClone(candidate(x))),
  x=>candidate(x).candidateSource.matchesBranchEncounterPlan=false,
  x=>fit(x).originalProposalSupport.sourcePixelSHA256='c'.repeat(64),x=>fit(x).originalProposalSupport.originalResidualId=10,
  x=>fit(x).originalProposalSupport.knownPixels--,x=>fit(x).originalProposalSupport.unavailablePixels=1,
  x=>fit(x).originalProposalSupport.pixelErrorReduction++,x=>fit(x).originalProposalSupport.outsideProposal.pixelErrorReduction++,
  x=>x.sourceBranches[0].candidates[1].best.fit=structuredClone(fit(x)),
  x=>x.rankings[1].similarity=x.rankings[0].similarity
 ];
 for(const mutate of checks){const bad=completeComparison(raster);mutate(bad);const before=structuredClone(bad),checked=compareCameraBodyAlternative(bad);assert.equal(checked.supportedModelId,null);assert.equal(checked.minimumProvenATCalls,0);assert.deepEqual(bad,before);rasterNegativeControls++;}
 for(const mutate of [x=>x.rankings.pop(),x=>x.backgroundBranchSupport.passingBranchCount--,x=>x.backgroundBranchSupport.frame={...x.backgroundBranchSupport.frame,mediaTime:2}]){const bad=completeComparison(raster);mutate(bad);assert.throws(()=>compareCameraBodyAlternative(bad));rasterNegativeControls++;}
 // Admitted UI competition with missing native-pixel binding stays unresolved.
 const competing=completeComparison(raster),s=positive.originalProposalSupport;
 competing.legacyPrediction={modelId:'a',bodyFit:structuredClone(positive),conditionalNonEnemyAlternatives:[{kind:'conditional-source-command-ui-competition-v1',sourcePixelSHA256:sha,originalResidualId:9,romSHA256:rom,source:{romSHA256:rom,currentUiStateKnown:false},identityCertified:false,absenceCertified:false,minimumProvenATCalls:0,comparison:{unchangedBackgroundOutsideFootprint:true,nativeIntegerSourceRaster:true},search:{completeWithinAdmittedSubset:true,evaluatedPlacements:65536,domainPlacements:65536,unsupportedRows:[]},tiedBest:1,best:{x:0,y:0,pixelErrorReduction:positive.pixelErrorReduction,originalProposalSupport:{componentPixels:s.componentPixels,knownPixels:s.knownPixels,backgroundSSE:s.backgroundSSE,renderedUiSSE:s.renderedSSE,pixelErrorReduction:s.pixelErrorReduction}}}]};
 const deferred=compareCameraBodyAlternative(competing);assert.equal(deferred.supportedModelId,null);assert.equal(deferred.unboundModelId,'a');assert(deferred.nonEnemyCompetitionDecision.bindingDeferred);assert.equal(deferred.nonEnemyCompetitionDecision.nativeSpecificUiComparisonComplete,false);assert.deepEqual(deferred.legacyPrediction,competing.legacyPrediction);rasterNegativeControls++;
}
for(const bad of [{...proposal,sourcePixelSHA256:'c'.repeat(64)},{...proposal,pixels:3},{...proposal,mask:Uint8Array.from(mask,(_x,i)=>i===0?1:0)}]){const fit=comparePerspectiveBody(render,{...base,sourcePixelSHA256:sha,originalProposalSupport:bad});assert.equal(fit.originalProposalSupport.ready,false);const {originalProposalSupport:_,...same}=fit;assert.deepEqual(same,comparePerspectiveBody(render,base));}
const plan={ready:true,request:{present:true}},h={kind:'conditional-mode1-MSE-background-hypothesis-v1',effectPlan:plan,requestedPhase:null,applied:false,gatesEvaluated:false,currentPhaseProven:false,currentEnableFadeOffsetsObserved:false,unknownAlternatives:['unknown'],runtimePixels:new Uint8Array(100)},transported=projectMode1MseSceneHypothesis(h);assert(!('runtimePixels'in transported));assert.deepEqual(validateMode1MseSceneHypothesis(transported,plan),{omitted:true,constructor:false});for(const mutate of [x=>x.requestedPhase={kind:'source-constructor',offset:1},x=>x.currentPhaseProven=true,x=>x.effectPlan.request.present=false]){const bad=structuredClone(h);mutate(bad);assert.throws(()=>validateMode1MseSceneHypothesis(projectMode1MseSceneHypothesis(bad),plan));}
let request={videoEvidence:frame,nativeVideo:{width:256,height:192,rgba:videoRGBA},backgroundEvidence:{romSHA256:rom,backgroundBranchSupport:{ready:true,kind:'same-frame-background-branch-support-v1',frame,passingBranchCount:1,branches:[{branchId:'b',recordKey:'map:1',sourceEnvironment:{mode1Scene:h}}]}},regions:[{...region,originalProposalSupport:proposal}],candidates:[{modelId:'a'}]};
request=nativeBodyRequestPayload(request);assert(request.regions[0].originalProposalSupport.packedMask);const retained=structuredClone(request);for(let i=0;i<5;i++)request=nativeBodyRequestPayload(request);assert.deepEqual(request,retained);assert(!('runtimePixels'in request.backgroundEvidence.backgroundBranchSupport.branches[0].sourceEnvironment.mode1Scene));const hash=await nativeWorkIdentity(request);request.regions[0].originalProposalSupport.sourcePixelSHA256='d'.repeat(64);assert.notEqual(await nativeWorkIdentity(request),hash);
console.log(JSON.stringify({passed:true,sourceRasterSubtypesEquivalent:true,rasterNegativeControls,completeRetainedBranches:2,completeRivalModels:2,fullFitUnchanged:true,positiveOutsideNegativeOriginalDeferred:true,positiveBoundOriginalPermittedWithinExistingOwnershipGuard:true,mixedFinalWriterDoesNotCertifyBody:true,malformedSupportUnknown:true,mode1WhitelistPreservesSourceAndRejectsRuntimePhase:true,repeatedTransportPasses:5,continuationFingerprintIncludesOriginalSupport:true}));
