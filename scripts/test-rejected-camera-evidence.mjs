import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {EnemyProposalTracker,estimateCameraTranslation,IMAGE_TRANSLATION_LIMITS,PROPOSAL_LIMITS} from '../web/monster-position-proposals.mjs';
import {VideoTrackingReplay} from '../web/map-browser-preview/video-tracking-replay.mjs';
import {patchTrackingFrame,videoTrackingFrameKey} from '../web/map-browser-preview/video-patch-correspondence.mjs';
const roi={x:20,y:20,w:24,h:24};
const stamp=(pts,sourceEpoch=0)=>({sourceId:'synthetic-camera-failure',sourceEpoch,timelineSegment:0,frameSerial:Math.round(pts*100),mediaTime:pts,videoTime:pts,timestampBasis:'retained-VideoFrame.timestamp',layout:'single',gameplayRGBA_SHA256:'a'.repeat(64)});
function pixels(textured=false){const rgba=new Uint8ClampedArray(196608);for(let i=0;i<49152;i++){const v=textured?(i*73+(i%256)**2*19)%251:100;rgba.set([v,v,v,255],i*4);}return{width:256,height:192,rgba};}
function tracking(masked=false){return{width:256,height:192,gray:new Uint8Array(49152).fill(100),blocked:new Uint8Array(49152),mask:new Uint8Array(49152).fill(masked?1:0),identity:'same-source'};}
function trackerResult(masked=false){const tracker=new EnemyProposalTracker(),first={videoTime:1,frameSerial:1,sceneContext:{gameplayROI:{x:0,y:0,w:256,h:192}}};tracker.update({captureStamp:first,proposals:[{proposalId:'one',roi}],trackingFrame:tracking(masked)});return tracker.update({captureStamp:{...first,videoTime:1.1,frameSerial:2},proposals:[{proposalId:'one',roi}],trackingFrame:tracking(masked)});}
test('rejected camera remains null and the original measured failed gate is separate',()=>{
 const result=trackerResult();assert.equal(result.camera,null);assert.equal(result.resetReason,'camera-registration-unknown');assert.deepEqual(result.rejectedCameraAttempt.failedGates,['texture-below-existing-minimum']);assert.equal(result.rejectedCameraAttempt.texture,0);assert.equal(result.rejectedCameraAttempt.residual,0);assert.equal(result.rejectedCameraAttempt.reliable,false);assert.equal(result.rejectedCameraAttempt.diagnosticOnly,true);assert.equal(result.ATDrawsCertified,0);
 assert.equal(result.rejectedCameraAttempt.limits.minimumTexture,IMAGE_TRANSLATION_LIMITS.minimumTexture);assert(result.observed.every(r=>r.association==='first-observed-or-unmatched'));
});
test('nonfinite rejected residual survives JSON without silently becoming null',()=>{
 const result=JSON.parse(JSON.stringify(trackerResult(true)));assert.equal(result.camera,null);assert.equal(result.rejectedCameraAttempt.residual,'Infinity');assert.equal(result.rejectedCameraAttempt.residualFinite,false);assert(result.rejectedCameraAttempt.failedGates.includes('nonfinite-registration-residual'));
});
const seed=(replay,pts,sourceEpoch=0)=>{replay.retain({image:pixels(),stamp:stamp(pts,sourceEpoch)});return replay.seed({stamp:stamp(pts,sourceEpoch),backgroundEvidence:{romSHA256:'rom',recordKey:'map',mapId:1},tracking:{observed:[{id:'seed-'+pts,originalResidualId:7,roi,firstSeen:pts,lastSeen:pts,sightings:1}]}});};
test('first loss and exact camera pair survive later empty-track replay steps',async()=>{
 const replay=new VideoTrackingReplay({maximumFrames:4,yieldTask:()=>Promise.resolve()});assert.equal(seed(replay,1).ready,true);replay.retain({image:pixels(),stamp:stamp(1.1)});await replay.settled();const first=replay.snapshot().lossEvidence.firstCameraFailure;
 assert.equal(first.from.key,videoTrackingFrameKey(stamp(1)));assert.equal(first.to.key,videoTrackingFrameKey(stamp(1.1)));assert.equal(first.from.stamp.gameplayRGBA_SHA256,'a'.repeat(64));assert.equal(first.reason,'camera-registration-unknown');assert.equal(first.remainingCount,0);
 for(let i=2;i<30;i++){replay.retain({image:pixels(),stamp:stamp(1+i/10)});await replay.settled();}
 const state=replay.snapshot();assert.equal(state.lastFailures.length,0);assert.deepEqual(state.lossEvidence.firstCameraFailure,first);assert.equal(state.lossEvidence.totalLosses,1);assert.equal(state.lossEvidence.failurePixels.retainedBytes,196608);assert.equal(state.diagnosticPixelBytes,196608);assert.equal(state.totalRetainedPixelBytes,state.pixelBytes+196608);assert(!JSON.stringify(state).includes('"gray":'));
 const exported=replay.failurePixelPairSnapshot();assert.equal(exported.previous.gray.length,49152);assert.equal(exported.current.blocked.length,49152);assert.equal(exported.previous.stamp.mediaTime,1);assert.equal(exported.current.stamp.mediaTime,1.1);exported.previous.gray[0]=7;exported.previous.stamp.mediaTime=999;assert.equal(replay.failurePixelPairSnapshot().previous.gray[0],100);assert.equal(replay.failurePixelPairSnapshot().previous.stamp.mediaTime,1);
});
test('retained gray/blocked pair and ROI lists reproduce the rejected camera attempt',async()=>{
 const replay=new VideoTrackingReplay({yieldTask:()=>Promise.resolve()});seed(replay,1);replay.retain({image:pixels(),stamp:stamp(1.1)});await replay.settled();const pair=replay.failurePixelPairSnapshot(),restore=f=>({...f,gray:Uint8Array.from(f.gray),blocked:Uint8Array.from(f.blocked)}),actual=estimateCameraTranslation(patchTrackingFrame(restore(pair.previous),pair.previousTracks),patchTrackingFrame(restore(pair.current),pair.currentProposals));
 for(const key of ['dx','dy','texture','reliable','method','calibrated'])assert.equal(actual[key],pair.rejectedCameraAttempt[key]);assert.equal(Number.isFinite(actual.residual)?actual.residual:String(actual.residual),pair.rejectedCameraAttempt.residual);
});
test('reseeding cannot overwrite the first camera pair and loss history stays bounded',async()=>{
 const replay=new VideoTrackingReplay({yieldTask:()=>Promise.resolve()});for(let i=0;i<12;i++){const t=1+i;seed(replay,t);replay.retain({image:pixels(),stamp:stamp(t+.1)});await replay.settled();}
 const state=replay.snapshot();assert.equal(state.lossEvidence.totalLosses,12);assert.equal(state.lossEvidence.recentLosses.length,8);assert.equal(state.lossEvidence.evictedRecentLosses,4);assert.equal(state.lossEvidence.firstLoss.from.sourcePTS,1);assert.equal(state.lossEvidence.firstCameraFailure.from.sourcePTS,1);assert.equal(replay.failurePixelPairSnapshot().previous.sourcePTS,1);assert.equal(state.diagnosticPixelBytes,196608);
});
test('source reset releases failure pixels and evidence instead of mixing identities',async()=>{
 const replay=new VideoTrackingReplay({yieldTask:()=>Promise.resolve()});seed(replay,1);replay.retain({image:pixels(),stamp:stamp(1.1)});await replay.settled();replay.reset('new-source');assert.equal(replay.failurePixelPairSnapshot(),null);assert.equal(replay.snapshot().lossEvidence.firstLoss,null);assert.equal(replay.snapshot().diagnosticPixelBytes,0);seed(replay,2,1);replay.retain({image:pixels(),stamp:stamp(2.1,1)});await replay.settled();assert.equal(replay.failurePixelPairSnapshot().previous.stamp.sourceEpoch,1);
});
test('real frame-gap rejection remains distinct and creates no camera fallback or pixel pair',async()=>{
 const replay=new VideoTrackingReplay({yieldTask:()=>Promise.resolve()});seed(replay,1);replay.retain({image:pixels(),stamp:stamp(1+PROPOSAL_LIMITS.maxGapSeconds+.01)});const s=await replay.settled();assert.equal(s.stopped,'unobserved-or-conflicted-frame-gap');assert.equal(s.tracks.length,0);assert.equal(s.lossEvidence.firstLoss.reason,s.stopped);assert.equal(s.lossEvidence.firstCameraFailure,null);assert.equal(replay.failurePixelPairSnapshot(),null);assert.equal(s.minimumProvenATCalls,0);
});
test('pixels are only exposed through the existing explicit comparison download',()=>{
 const panel=readFileSync(new URL('../web/map-browser-preview/map-video-comparison.mjs?v=replay-sequence-20261008-a60b0c3b',import.meta.url),'utf8');assert.equal((panel.match(/failurePixelPairSnapshot\(/g)??[]).length,1);assert.match(panel,/measuredTrackingFailurePixels:fastReplay.failurePixelPairSnapshot\(\)/);assert.equal(PROPOSAL_LIMITS.maxGapSeconds,.5);assert.deepEqual(IMAGE_TRANSLATION_LIMITS,{radius:16,minimumSamples:150,minimumTexture:2,maximumResidual:14,residualClip:40});
});
