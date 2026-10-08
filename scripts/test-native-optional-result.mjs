import {waitForOptionalNativeResult} from '../web/map-browser-preview/native-optional-result.mjs?v=native-async-20261008-43d9a67a';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import {ResidualRecognitionClient} from '../web/map-browser-preview/residual-recognition-client.mjs';
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

// Optional presentation wait is independent of job settlement and consumes errors.
assert.equal((await waitForOptionalNativeResult(Promise.resolve(7),10)).result,7);
const fail=Error('synthetic failure');assert.equal((await waitForOptionalNativeResult(Promise.reject(fail),10)).error,fail);
let finish;const p=new Promise(r=>finish=r),early=await waitForOptionalNativeResult(p,1);assert.equal(early.status,'pending');finish(8);assert.equal((await early.settled).result,8);
async function lateCase(kind){
 let resolve,reject,nativeArgs=null,scheduled=null,lane=true,current=true;
 const seen=[],pending=new Promise((a,b)=>{resolve=a;reject=b;});
 const client={epoch:1,sequence:1,cancellationVersion:0,classify:async()=>({inference:dinoSpec('wasm'),rankings}),nativeBodySupport:(req,progress,args)=>{nativeArgs=args;return pending;},scheduleNativeContinuation:args=>{scheduled=args;return true;}};
 const local={...input,isNativeCurrent:()=>current,onNativePartial:value=>seen.push(value)};
 const first=await runResidualRecognitionJob({input:local,plan:appearance.source.modelPlan,variant:'_f',client,assertCurrent:()=>{if(!lane)throw new DOMException('primary lane finished','AbortError');},choose:async()=>({backend:'wasm',reason:'synthetic'}),makeRequest:()=>({captureStamp:{enemyROI:{x:0,y:0,w:1,h:1}},crop:{rgba:new Uint8Array(4)}}),makeBundle:()=>clone(appearance)});
 assert.equal(first.nativeBodyWork.status,'pending');assert.equal(first.minimumProvenATCalls,0);assert.equal(nativeArgs.retainNativeJob,true);assert.equal(seen.length,0);assert.equal(scheduled,null);
 lane=false; // ordinary primary completion must not kill its retained native work.
 assert.doesNotThrow(nativeArgs.assertCurrent);
 if(kind==='source-changed')current=false;
 if(kind==='epoch-changed')client.epoch++;
 if(kind==='cancelled')client.cancellationVersion++;
 if(kind==='late-error')reject(Error('late native failure'));else resolve(clone(result));
 await new Promise(r=>setTimeout(r,20));
 if(['source-changed','epoch-changed','cancelled'].includes(kind)){assert.equal(seen.length,0);assert.equal(scheduled,null);}
 else if(kind==='late-error'){assert.equal(seen.length,1);assert.equal(scheduled,null);assert.equal(seen[0].sightings[0].cameraBodyAlternative.supportedModelId,null);}
 else{assert.equal(seen.length,1);assert(scheduled);assert.equal(seen[0].sightings[0].cameraBodyAlternative.supportedModelId,'first');assert.equal(seen[0].nativeBodyWork,undefined);assert.equal(seen[0].minimumProvenATCalls,0);scheduled.onResult(result);assert.equal(seen.length,2);}
 return kind;
}
const cases=await Promise.all(['late-success','late-error','source-changed','epoch-changed','cancelled'].map(lateCase));
console.log(JSON.stringify({passed:true,cases,initialDisplayWaitPreserved:true,lateResultAcceptedOnlyForOriginalFrame:true,mainLaneCompletionDoesNotCancelOwnedJob:true,sourceOrEpochOrUserCancellationDropsLateResults:true,syntheticOnly:true,ATCallsAdded:0}));


// Force native settlement in the same timer callback as optional expiry. The
// initial caller must commit pending before a late update can replace it.
{
 const originalTimer=globalThis.setTimeout;let resolve,firstPublished=false,lateCount=0;
 const pending=new Promise(r=>resolve=r),client={epoch:1,sequence:1,cancellationVersion:0,classify:async()=>({inference:dinoSpec('wasm'),rankings}),nativeBodySupport:()=>pending,scheduleNativeContinuation:()=>true};
 globalThis.setTimeout=(callback,ms,...args)=>ms===2000?originalTimer(()=>{callback(...args);resolve(clone(result));},0):originalTimer(callback,ms,...args);
 try{
  const first=await runResidualRecognitionJob({input:{...input,onNativePartial:()=>{assert.equal(firstPublished,true);lateCount++;}},plan:appearance.source.modelPlan,variant:'_f',client,choose:async()=>({backend:'wasm',reason:'same-task-boundary'}),makeRequest:()=>({captureStamp:{enemyROI:{x:0,y:0,w:1,h:1}},crop:{rgba:new Uint8Array(4)}}),makeBundle:()=>clone(appearance)});
  assert.equal(first.nativeBodyWork.status,'pending');firstPublished=true;assert.equal(lateCount,0);await new Promise(r=>originalTimer(r,20));assert.equal(lateCount,1);
 }finally{globalThis.setTimeout=originalTimer;}
 console.log(JSON.stringify({sameTaskExpiryCompletionRace:true,pendingPublishedBeforeLateSupport:true}));
}

// Actual Node message transport through the production client, with a synthetic
// delayed source result. This is not a ROM renderer/performance measurement.
const oldWorker=globalThis.Worker;
class FixtureWorker {
 constructor(){
  this.inner=new NodeWorker(`const {parentPort,workerData}=require('node:worker_threads');const cancelled=new Set();parentPort.on('message',m=>{if(m.type==='cancel'){cancelled.add(m.id);return;}if(m.type==='load')parentPort.postMessage({type:'loaded',id:m.id,romEpoch:m.romEpoch,catalog:[]});if(m.type==='recognize')parentPort.postMessage({type:'result',id:m.id,romEpoch:m.romEpoch,result:workerData.classified});if(m.type==='native-body-support')setTimeout(()=>{if(!cancelled.has(m.id))parentPort.postMessage({type:'result',id:m.id,romEpoch:m.romEpoch,result:workerData.result});},2300);});`,{eval:true,workerData:{result,classified:{inference:dinoSpec('wasm'),rankings}}});
  this.inner.on('message',data=>this.onmessage?.({data}));this.inner.on('error',error=>this.onerror?.(error));
 }
 postMessage(m,transfer){this.inner.postMessage(m,transfer);}
 terminate(){return this.inner.terminate();}
}
globalThis.Worker=FixtureWorker;
const real=new ResidualRecognitionClient();let late=null;
try{
 await real.load(new Uint8Array(16),romSHA256);
 const first=await runResidualRecognitionJob({input:{...input,onNativePartial:value=>late=value},plan:appearance.source.modelPlan,variant:'_f',client:real,choose:async()=>({backend:'wasm',reason:'synthetic-node-transport'}),makeRequest:()=>({captureStamp:{enemyROI:{x:0,y:0,w:1,h:1}},crop:{rgba:new Uint8Array(4)}}),makeBundle:()=>clone(appearance)});
 assert.equal(first.nativeBodyWork.status,'pending');assert(real.pending);assert.equal(real.nativeDeadlines.size,0);
 const deadline=Date.now()+5000;while(!late&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
 assert(late);assert.equal(late.sightings[0].cameraBodyAlternative.supportedModelId,'first');assert.equal(real.pending,null);assert.equal(real.nativeDeadlines.size,0);
 console.log(JSON.stringify({actualNodeMessageTransport:true,productionClient:true,delayedInitialResultRetained:true,initialWaitReturnsPending:true,sourceFixtureSynthetic:true}));
}finally{real.release();globalThis.Worker=oldWorker;}
