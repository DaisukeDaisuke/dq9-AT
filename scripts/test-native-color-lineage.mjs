import assert from 'node:assert/strict';
import {composeNativeBodyOverSourceDestination as compose,packNativeMapTranslucentFragments as pack} from '../web/monster-native-scene-composition.mjs?v=automatic-playback-source-cache-20261006-1100';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const baseline=process.env.DQ9_BASELINE_ROOT?await import(pathToFileURL(resolve(process.env.DQ9_BASELINE_ROOT,'web/monster-native-scene-composition.mjs')).href):null;
import {nativeBodyExtentEvidence as extent} from '../web/monster-native-extent-evidence.mjs';
import {createNativeBodyColorLineage,readNativeBodyColorLineage} from '../web/monster-native-color-lineage.mjs?v=recognition-20261008-7cf64cf4';
import {compareCameraBodyAlternative} from '../web/monster-camera-body-alternative.mjs?v=route-poses-20261008-d98f497f';
const N=49152,I=40*256+40,camera={viewFx:Array(16).fill(0),projectionFx:Array(16).fill(0)},alignment={dx:0,dy:0},frame={romSHA256:'a'.repeat(64),fullRGBA_SHA256:'b'.repeat(64),recordKey:'map:test',sourceId:'test',sourceEpoch:0,timelineSegment:0,mediaTime:0};
function dest(){const d={kind:'source-prefog-opaque-body-destination-v1',recordKey:frame.recordKey,snapshot:camera,rgba6665:new Uint8Array(N*4),depth24:new Uint32Array(N).fill(1000),owner:new Int32Array(N).fill(90),frontFacing:new Uint8Array(N),knownMask:new Uint8Array(N).fill(1),sourceFogMask:new Uint8Array(N).fill(1),opaqueId:new Uint8Array(N).fill(20),unknownOrderMask:new Uint8Array(N),controls:{alphaBlendEnabled:true,alphaTestEnabled:false,alphaTestRef:null,translucentSortMode:'manual-source-order'},unknownReasons:[],sourceOrder:{kind:'source-ordinary-map-before-natural-body-v1'},binding:{kind:'same-frozen-source-destination-v1',frame:structuredClone(frame),camera:structuredClone(camera),alignment:{...alignment}}};for(let i=0;i<N;i++)d.rgba6665.set([10,20,30,31],i*4);d.mapFragments=pack([],{coverage:d.knownMask,depth24:d.depth24});return d;}
function poly(index,alpha,id,z,{rgb=[60,30,10],opaque=false,facing=true,fog=true}={}){return{index,translucent:!opaque,frontFacing:facing,attribute:((id<<24)|(31<<16)|(fog?0x8000:0)|192)>>>0,clipVerticesFx:[[0,0,0,4096],[2,0,0,4096],[0,2,0,4096]],fragments:[{x:40,y:40,depth24:z,rgb6:rgb,alpha5:alpha}]};}
const projected=parts=>({polygons:parts.map(p=>({index:p.index,material:{effective:{polygonAttribute:p.attribute}}})),transform:{camera}});
const valid=new Uint8Array(N).fill(1);let parityCases=0,negativeCases=0;
function render(parts,map=[],options={},d=dest()){
 d.mapFragments=pack(map,{coverage:d.knownMask,depth24:d.depth24});const p=projected(parts),opts={destination:d,alignment,...options},r=compose(p,parts,opts);
 if(baseline){assert.deepEqual(r,baseline.composeNativeBodyOverSourceDestination(p,parts,opts));parityCases++;}
 return r;
}
const evidence=(r,changes={})=>extent({rendered:r,alignment,frame,comparisonValidMask:valid,...changes});
const support=r=>evidence(r).bodyColorLineage;
const body=()=>poly(0,31,1,500,{opaque:true}),overlay=(alpha=15,rgb=[40,20,10])=>poly(9,alpha,9,400,{rgb});
let r=render([body()],[overlay()]),s=support(r);assert.equal(s.pixels,1);assert.equal(r.nativeState.colorOwnerIsBody[I],0);assert.equal(evidence(r).bodyColorOwnership.allVisibleContributionsCapturedWithinComposition,false);assert.equal(s.actualAcceptedRGBReplayVerified,true);assert.equal(s.allDisplayedBodyOperandDependenciesCaptured,true);assert.equal(s.actualROMColorContrastCertified,false);assert.equal(s.bodyRemovalDifferenceCertified,false);assert.equal(s.identityCertified,false);assert.equal(s.minimumProvenATCalls,0);
// Source-state identity survives a legitimate shallow wrapper but not import.
assert.deepEqual(support({...r,isolatedBody:{ready:false}}),s);assert.equal(support(structuredClone(r)),undefined);
assert.equal(support({...r,nativeState:{...r.nativeState}}),undefined);assert.equal(support({...r,rgba:r.rgba.slice()}),undefined);
for(const key of ['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256']){assert.equal(evidence(r,{frame:{...frame,[key]:null}}).bodyColorLineage,undefined);negativeCases++;}
assert.equal(evidence(r,{alignment:{dx:1,dy:0}}).bodyColorLineage,undefined);
for(const [map,pixels] of [[[overlay(31)],0],[[overlay(30,[0,0,0])],0],[[overlay(30,[0,0,0]),poly(10,30,10,300,{rgb:[0,0,0]})],0],[[overlay(0)],1],[[poly(9,15,9,600)],1]])assert.equal(support(render([body()],map)).pixels,pixels);
let d=dest();d.controls.alphaBlendEnabled=false;assert.equal(support(render([body()],[overlay()],{},d)).pixels,0);
d=dest();d.rgba6665[I*4+3]=0;assert.equal(support(render([poly(0,15,1,500)],[],{},d)).pixels,1);
d=dest();d.unknownOrderMask[I]=1;assert.equal(render([body()],[],{},d).ready,false);
d=dest();d.knownMask[I]=0;assert.equal(render([body()],[],{},d).ready,false);
assert.equal(render([poly(0,31,1,1000,{opaque:true})]).ready,false);
r=render([poly(0,15,7,500)],[poly(9,15,7,400)]);assert.equal(r.stats.duplicateIdSuppressed,1);assert.equal(support(r).pixels,0);
const fog=w=>({parameters:{enabled:true,alphaOnly:false,color:32767|(31<<16),density:new Uint8Array(32),shift:0,offset:0},table:new Uint8Array(32768).fill(w)});
for(const [w,pixels] of [[0,1],[64,1],[127,0],[128,0]])assert.equal(support(render([body()],[],{fog:fog(w)})).pixels,pixels);
for(const k of ['enabled','alphaOnly']){const f=fog(128);f.parameters[k]=k==='alphaOnly';assert.equal(support(render([body()],[],{fog:f})).pixels,1);}
assert.equal(support(render([body()],[],{fog:fog(129)})),undefined);
for(const [alpha,pixels] of [[15,1],[30,0],[31,0]]){d=dest();d.postActorEffect={fragments:pack([overlay(alpha,[0,0,0])],{coverage:d.knownMask,depth24:d.depth24})};r=render([body()],[],{},d);assert.equal(support(r).pixels,pixels);assert.equal(r.nativeState.colorOwnerIsBody[I],0);}
// Mutating pixels or coverage invalidates the producer's exact-byte witness.
r=render([body()],[overlay()]);const saved=r.rgba[I*4];r.rgba[I*4]^=1;assert.equal(support(r),undefined);r.rgba[I*4]=saved;assert.equal(support(r).pixels,1);
r.rgba[0]=1;assert.equal(support(r),undefined);r.rgba[0]=0;r.sourceCoverage[0]=1;assert.equal(support(r),undefined);r.sourceCoverage[0]=0;assert.equal(support(r).pixels,1);
const exposed=readNativeBodyColorLineage(r,{frame,alignment});exposed.displayMask.fill(0);assert.equal(support(r).pixels,1);
// Unsupported fog metadata is unavailable even if the final RGB looks plausible.
for(const change of [f=>f.parameters.color=-1,f=>f.parameters.color=2**32,f=>f.parameters.color=.5,f=>f.parameters.offset=2**31,f=>f.parameters.offset=NaN,f=>f.parameters.shift=16,f=>f.parameters.shift=.5,f=>f.parameters.alphaOnly=0,f=>f.parameters.enabled=1,f=>f.parameters.density[0]=128,f=>f.parameters.density=new Uint8Array(31),f=>f.table=new Uint8Array(1),f=>f.table.fill(129)]){
 d=dest();const t=createNativeBodyColorLineage(d.rgba6665,d.binding),p=new Uint8Array(N);p[I]=1;t.accept(I,[60,30,10],31,true,true,31);const pre=d.rgba6665.slice();pre.set([60,30,10,31],I*4);const f=fog(0);change(f);assert.equal(t.finish({ready:true,stats:{opaqueWrites:1,blended:0},nativeState:{},rgba:new Uint8ClampedArray(N*4),sourceCoverage:p},{footprint:p,preFogRGBA6665:pre,postFogRGBA6665:pre,depth24:d.depth24,isFogged:d.sourceFogMask,fog:f}),false);negativeCases++;
}
// Exact accepted replay is necessary even when interval endpoints look valid.
for(const mismatch of ['prefog','postfog','display','alpha']){
 d=dest();const t=createNativeBodyColorLineage(d.rgba6665,d.binding),p=new Uint8Array(N);p[I]=1;t.accept(I,[60,30,10],31,true,true,mismatch==='alpha'?0:31);
 const pre=d.rgba6665.slice();pre.set([60,30,10,31],I*4);const post=pre.slice(),out={ready:true,stats:{opaqueWrites:1,blended:0},nativeState:{},rgba:new Uint8ClampedArray(N*4),sourceCoverage:p,sourceAcceptedSubset:'known-source-destination-mixed-body',sceneOcclusionApplied:true};for(let c=0;c<3;c++){const x=post[I*4+c]>>>1;out.rgba[I*4+c]=(x<<3)|(x>>>2);}out.rgba[I*4+3]=255;
 if(mismatch==='prefog')pre[I*4]--;if(mismatch==='postfog')post[I*4]--;if(mismatch==='display')out.rgba[I*4]--;
 assert.equal(t.finish(out,{footprint:p,preFogRGBA6665:pre,postFogRGBA6665:post,depth24:d.depth24,isFogged:d.sourceFogMask,fog:null}),false);assert.equal(readNativeBodyColorLineage(out,{frame,alignment}),null);negativeCases++;
}
// Three noncollinear accepted-source body operands, retained through MSE.
const locations=[I,I+1,I+256],spread=p=>({...p,fragments:locations.map(i=>({...p.fragments[0],x:i%256,y:i>>8}))});d=dest();d.postActorEffect={fragments:pack([spread(overlay())],{coverage:d.knownMask,depth24:d.depth24})};r=render([spread(body())],[],{},d);const ext=evidence(r);assert.equal(ext.bodyColorLineage.knownSpatialSupportRank,2);assert.equal(ext.bodyColorOwnership.empty,true);
const gain=100,fit={regionId:1,raster:'source-integer-original-GX-body-composition-subset',backgroundSSE:200,bodySSE:100,pixelErrorReduction:gain,originalProposalSupport:{kind:'conditional-source-native-original-proposal-support-v1',ready:true,originalResidualId:1,sourcePixelSHA256:frame.fullRGBA_SHA256,componentPixels:3,knownPixels:3,unavailablePixels:0,backgroundSSE:200,renderedSSE:100,pixelErrorReduction:gain,outsideProposal:{backgroundSSE:0,renderedSSE:0,pixelErrorReduction:0}}};
const args={appearanceFrame:frame,rankings:[{modelId:'a',similarity:1,speciesCandidates:[{monsterId:1}]}],legacyPrediction:{modelId:null,unknown:true},backgroundBranchSupport:{kind:'same-frame-background-branch-support-v1',ready:true,frame,passingBranchCount:1,branches:[{branchId:'b',recordKey:frame.recordKey,romSHA256:frame.romSHA256,fullRGBA_SHA256:frame.fullRGBA_SHA256}]},sourceBranches:[{branchId:'b',frame,renderer:'source-integer-original-GX-body-subset',candidates:[{modelId:'a',testedProposals:1,unsupported:[],candidateSource:{matchesBranchEncounterPlan:true},best:{proposalId:'source',fit,nativeBodyExtent:ext}}]}],expectedModelIds:['a'],originalResidualId:1};
let decision=compareCameraBodyAlternative(args);assert.equal(decision.branches[0].candidates[0].ready,true);assert.equal(decision.unattributedModelId,'a');assert.equal(decision.supportedModelId,'a');assert.equal(decision.minimumProvenATCalls,0);assert.equal(decision.identityCertified,false);assert.equal(decision.unknownNonEnemyPossible,true);assert.equal(decision.playerPossible,true);assert.deepEqual(decision.legacyPrediction,args.legacyPrediction);
for(const mutate of [x=>delete x.bodyColorLineage,x=>x.bodyColorLineage.kind='source-fixed-trace-body-rgb555-dependency-v1',...['actualAcceptedRGBReplayVerified','sourceDestinationFrameBindingVerified','completeWithinAdmittedComposition','allDisplayedBodyOperandDependenciesCaptured','fixedAcceptanceTrace','integerBlendAndFogQuantizationIncluded'].map(k=>x=>x.bodyColorLineage[k]=false),x=>x.bodyColorLineage.knownSpatialSupportRank=1,x=>x.bodyColorLineage.unavailablePixels=1,x=>x.bodyColorLineage.empty=true,x=>x.bodyColorLineage.observedBodyCertified=true,x=>x.frame.mediaTime++,x=>x.sceneOcclusionApplied=false,x=>x.sourceAcceptedSubset='isolated-opaque-binary-body-polygons',x=>x.bodyColorLineage.acceptedBodyColorWrites=0,x=>x.bodyColorLineage.bodyRGBOperandDomain=[0,31]]){const bad=structuredClone(args);mutate(bad.sourceBranches[0].candidates[0].best.nativeBodyExtent);assert.equal(compareCameraBodyAlternative(bad).supportedModelId,null);assert.equal(compareCameraBodyAlternative(bad).branches[0].candidates[0].ready,false);negativeCases++;}
// Independent scalar oracle: actual accepted replay and every RGB6 body value
// for 4096 deterministic layered traces, including every blend/replace case.
let seed=0x61c2c373;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
d=dest();for(let i=0;i<N;i++)d.rgba6665.set([10,10,10,31],i*4);const tracker=createNativeBodyColorLineage(d.rgba6665,d.binding),fp=new Uint8Array(N),pre=d.rgba6665.slice(),expected=[];let writeCount=0;
for(let i=0;i<4096;i++){
 fp[i]=1;const ops=[{body:true,a:1+rand(31),rgb:rand(64),blend:!!rand(2)}];const layers=rand(7);for(let k=0;k<layers;k++)ops.push({body:false,a:1+rand(31),rgb:rand(64),blend:!!rand(2)});
 const scalar=x=>{let v=10,a=31;for(const op of ops){const c=op.body?x:op.rgb;v=op.a===31||!op.blend||a===0?c:Math.floor(((op.a+1)*c+(31-op.a)*v)/32);a=op.a===31||!op.blend||a===0?op.a:Math.max(op.a,a);}return{v,a};};
 let a=31;for(const op of ops){writeCount++;tracker.accept(i,[op.rgb,op.rgb,op.rgb],op.a,op.body,op.blend,a);a=op.a===31||!op.blend||a===0?op.a:Math.max(op.a,a);}
 const actual=scalar(ops[0].rgb);pre.set([actual.v,actual.v,actual.v,actual.a],i*4);
 const colors=Array.from({length:64},(_,x)=>scalar(x).v>>>1);expected.push(+(Math.min(...colors)!==Math.max(...colors)));
}
const out={ready:true,stats:{opaqueWrites:writeCount,blended:0},nativeState:{},rgba:new Uint8ClampedArray(N*4),sourceCoverage:fp,sourceAcceptedSubset:'known-source-destination-mixed-body',sceneOcclusionApplied:true};for(let i=0;i<4096;i++){const v=pre[i*4]>>>1,x=(v<<3)|(v>>>2);out.rgba.set([x,x,x,255],i*4);}
assert(tracker.finish(out,{footprint:fp,preFogRGBA6665:pre,postFogRGBA6665:pre,depth24:d.depth24,isFogged:d.sourceFogMask,fog:null}));const lineage=readNativeBodyColorLineage(out,{frame,alignment});for(let i=0;i<4096;i++)assert.equal(lineage.displayMask[i],expected[i]);
console.log(JSON.stringify({passed:true,parityCases,negativeCases,exhaustiveLayeredTraces:4096,bodyRGBValuesPerTrace:64,finalWriterUnchanged:true,diagnosticNotPromoted:true,sourceLineageConditionallyAdmitted:true,actualReplayEqualityRequired:true,quantizationErasureCovered:true,unknownOrderDepthAndFrameGatesRetained:true,legacyPredictionsAndATBoundsUnchanged:true}));
