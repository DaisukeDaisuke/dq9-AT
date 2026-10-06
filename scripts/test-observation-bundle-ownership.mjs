import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {cloneImmutableObservationBundle,copyObservationBundleForAT} from '../web/map-browser-preview/observation-bundle-ownership.mjs?v=gap-owned-observation-20261006-1340';
import {VideoObservationTimeline} from '../web/map-browser-preview/video-observation-timeline.mjs';
import {createVideoTrackingAT} from '../web/map-browser-preview/video-tracking-at.mjs';
const bundle=extra=>({schema:'headless-monster-observation-bundle-v1',producer:'browser-ROM-background-residual',sightings:[],videoObservations:[{kind:'partial-video-observation-timeline',timeline:{old:true}}],...extra});
const stamp={sourceId:'ownership-test',sourceEpoch:0,timelineSegment:0,mediaTime:1};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('certified plain graph preserves all data/aliases and detaches before freezing',()=>{
 const shared={unknownAlternativeRetained:true,value:NaN,negativeZero:-0,missing:undefined,big:7n};shared.self=shared;
 const list=[shared,undefined,Infinity,-Infinity];list.length=6;
 const input=bundle({left:shared,right:shared,list}),owned=cloneImmutableObservationBundle(input),snapshot=copyObservationBundleForAT(owned);
 assert.deepEqual(snapshot,structuredClone(input));assert.notStrictEqual(owned,input);assert.notStrictEqual(snapshot,owned);
 assert.strictEqual(snapshot.left,owned.left);assert.strictEqual(snapshot.left,snapshot.right);assert.strictEqual(snapshot.left,snapshot.list[0]);assert.strictEqual(snapshot.left.self,snapshot.left);assert.equal(4 in snapshot.list,false);
 assert(Object.isFrozen(owned));assert(Object.isFrozen(snapshot.left));assert(Object.isFrozen(snapshot.list));
 shared.unknownAlternativeRetained=false;input.sightings.push({id:'later'});assert.equal(snapshot.left.unknownAlternativeRetained,true);assert.equal(snapshot.sightings.length,0);
 assert.throws(()=>{owned.left.value=9;},TypeError);snapshot.automaticATEventEvidence={minimumProvenATCalls:0};assert.equal(owned.automaticATEventEvidence,undefined);
});

test('unfreezable built-ins, root cycles and generic frozen inputs retain native independent copies',()=>{
 const bytes=new Uint8Array([1,2,3]),map=new Map(),data={bytes,buffer:bytes.buffer,date:new Date(1234),map,set:new Set(),regexp:/unknown/gi};map.set('data',data);data.set.add(data);const input=bundle({data,alias:data});
 const owned=cloneImmutableObservationBundle(input),snapshot=copyObservationBundleForAT(owned);
 assert.deepEqual(snapshot,structuredClone(input));assert(!Object.isFrozen(owned));assert.notStrictEqual(snapshot.data,owned.data);assert.strictEqual(snapshot.data.bytes.buffer,snapshot.data.buffer);assert.strictEqual(snapshot.data,snapshot.alias);assert.strictEqual(snapshot.data.map.get('data'),snapshot.data);
 owned.data.bytes[0]=99;owned.data.date.setTime(55);assert.equal(snapshot.data.bytes[0],1);assert.equal(snapshot.data.date.getTime(),1234);
 const cyclic=bundle();cyclic.self=cyclic;const cycleOwned=cloneImmutableObservationBundle(cyclic),cycleSnapshot=copyObservationBundleForAT(cycleOwned);assert.strictEqual(cycleSnapshot.self,cycleSnapshot);assert.notStrictEqual(cycleSnapshot,cycleOwned);assert(!Object.isFrozen(cycleOwned));
 const generic=Object.freeze(bundle({nested:Object.freeze({unknown:true})})),genericSnapshot=copyObservationBundleForAT(generic);assert.notStrictEqual(genericSnapshot.nested,generic.nested);genericSnapshot.nested.unknown=false;assert.equal(generic.nested.unknown,true);
});

test('producer native cloning still rejects unsupported values and retains accessor semantics',()=>{
 for(const input of [bundle({unsupported:()=>{}}),bundle({unsupported:Symbol('unknown')}),new Proxy(bundle(),{})])assert.throws(()=>cloneImmutableObservationBundle(input),{name:'DataCloneError'});
 let reads=0;const input=bundle();Object.defineProperty(input,'readOnce',{enumerable:true,get(){reads++;return {unknown:true};}});const owned=cloneImmutableObservationBundle(input);assert.equal(reads,1);assert.deepEqual(owned.readOnce,{unknown:true});assert.equal(Object.getOwnPropertyDescriptor(owned,'readOnce').get,undefined);
});

test('only the explicit unaliased residual timeline path receives immutable ownership',()=>{
 const timeline=new VideoObservationTimeline();timeline.begin(stamp,{frameSerial:1});const patch={sightings:[{id:'one',unknown:true}]};timeline.update(1,patch);
 const value=bundle({extra:{unknown:true}}),owned=timeline.snapshotBundle(value,{unaliasedResidualEnvelope:true});assert(Object.isFrozen(owned));assert(Object.isFrozen(owned.videoObservations[0].timeline.frames[0]));
 const generic=timeline.snapshotBundle(value);assert(!Object.isFrozen(generic));assert.notStrictEqual(copyObservationBundleForAT(generic).extra,generic.extra);
 const oldHash=hash(owned);value.extra.unknown=false;patch.sightings[0].unknown=false;timeline.update(1,{sightings:[{id:'replacement'}]});assert.equal(hash(owned),oldHash);
 const aliased=bundle();aliased.other=aliased.videoObservations[0];const legacy=timeline.snapshotBundle(aliased);assert.strictEqual(legacy.other,legacy.videoObservations[0]);
 const binary=timeline.snapshotBundle(bundle({data:new Uint8Array([5])}),{unaliasedResidualEnvelope:true});assert(!Object.isFrozen(binary));assert.notStrictEqual(copyObservationBundleForAT(binary).data,binary.data);
});

test('AT still rejects prohibited provenance on both certified and generic observations',async()=>{
 for(const debug of [{nested:{dstSHA256:'forbidden'}},{nested:{debugOnly:true}},{nested:{schema:'native-entry-execution-v1'}}])for(const certify of [x=>x,cloneImmutableObservationBundle]){
  const states=[];let prepared=false;const at=createVideoTrackingAT({engineRevision:'test',getOptions:()=>({}),onState:s=>states.push(s),prepare:async()=>{prepared=true;throw Error('must not prepare');}});
  await at.observe(certify(bundle(debug)));assert.equal(prepared,false);assert.equal(states.length,1);assert.match(states[0].reason,/本番/);assert.equal(at.replayInputHypotheses,null);
 }
});

test('AT cancellation and replacement discard stale immutable observations',async()=>{
 const states=[];let at;at=createVideoTrackingAT({engineRevision:'test',getOptions:()=>({}),onState:s=>{states.push(s);if(s.reason.startsWith('同じ観測'))at.cancel('cancelled at notification');}});
 await at.observe(cloneImmutableObservationBundle(bundle()));assert.equal(at.replayInputHypotheses,null);assert.equal(states.at(-1).reason,'cancelled at notification');assert.equal(states.length,2);
 const nextStates=[];const next=createVideoTrackingAT({engineRevision:'test',getOptions:()=>({}),onState:s=>nextStates.push(s)}),a=cloneImmutableObservationBundle(bundle()),b=cloneImmutableObservationBundle(bundle({label:'replacement'}));
 await Promise.all([next.observe(a),next.observe(b)]);assert.equal(nextStates.filter(s=>s.reason.startsWith('映像観測を接続済み')).length,1);assert.equal(next.replayInputHypotheses.minimumProvenATCalls,0);assert.equal(next.replayInputHypotheses.unknownBranch.retained,true);
 await next.retry();assert.equal(nextStates.at(-1).status,'waiting');assert.equal(a.automaticATEventEvidence,undefined);assert.equal(b.automaticATEventEvidence,undefined);
});

test('AT pending sessions and retry keep a writable companion root with immutable source evidence',async()=>{
 const input=bundle({source:{background:{romSHA256:'a'.repeat(64)},modelPlan:{models:[]}},sightings:[{id:'first'},{id:'second'}],conditionalATEventEvidence:{chains:[{id:'explicit',status:'conditional-source-model-evidence',provenance:'Synthetic ownership-flow fixture',sightingIds:['first','second'],gaps:[{callsBetweenPostStates:{min:'1',max:'1'}}]}]}});
 const owned=cloneImmutableObservationBundle(input),states=[],prepared=[],sessions=[];
 const at=createVideoTrackingAT({engineRevision:'ownership-flow-test',getOptions:()=>({tables:{},domain:{kind:'all-output-classes'}}),onState:s=>states.push(s),prepare:async(snapshot,options)=>{prepared.push({snapshot,options});return {gate:[{status:'pending'}],checkpointKey:'test-only'};},openStore:async()=>({load:async()=>null}),loadWasm:async()=>new Uint8Array(),startSession:()=>{let resolve;const session={done:new Promise(r=>{resolve=r;}),cancelled:false,cancel(){this.cancelled=true;resolve({status:'cancelled'});},finish(){resolve({status:'complete',summary:{minimumProvenATCalls:0,unknownAlternativeRetained:true}});}};sessions.push(session);return session;}});
 const first=at.observe(owned);while(sessions.length<1)await new Promise(resolve=>setImmediate(resolve));
 assert.strictEqual(prepared[0].snapshot.source,owned.source);assert(prepared[0].snapshot.automaticATEventEvidence);assert.equal(owned.automaticATEventEvidence,undefined);assert.notStrictEqual(prepared[0].options.chains,owned.conditionalATEventEvidence.chains);
 const retry=at.retry();while(sessions.length<2)await new Promise(resolve=>setImmediate(resolve));assert.equal(sessions[0].cancelled,true);sessions[1].finish();await Promise.all([first,retry]);
 assert.equal(states.at(-1).status,'complete');assert.equal(states.filter(s=>s.status==='complete').length,1);assert.equal(states.at(-1).summary.unknownAlternativeRetained,true);assert.equal(hash(owned),hash(input));
 const motion=at.nativeMotionAssociationInputs;motion.unknownAlternativeRetained=false;assert.equal(at.nativeMotionAssociationInputs.unknownAlternativeRetained,true);at.cancel('clear');assert.equal(at.replayInputHypotheses,null);
});

test('camera alternative validation and singleton append accept frozen nested evidence',async()=>{
 const {compareCameraBodyAlternative}=await import('../web/monster-camera-body-alternative.mjs');
 const {mapHypothesisProvenance}=await import('../web/map-browser-preview/map-hypothesis-provenance.mjs');
 const frame={romSHA256:'a'.repeat(64),sourceId:'camera-ownership',sourceEpoch:0,timelineSegment:0,mediaTime:1,fullRGBA_SHA256:'b'.repeat(64)},stamp={...frame,frameSerial:1};
 const retained={frameSerial:1,sourcePTS:1,stamp,romSHA256:frame.romSHA256,backgroundAlternatives:[{recordKey:'map:1',mapId:1,accepted:true,state:'conditional-residual-hypotheses'}]},map=mapHypothesisProvenance(retained),branchId='background-row-0',recordKey='map:1',modelId='synthetic';
 const best={proposalId:'fixture',fit:{pixelErrorReduction:10,backgroundSSE:20,bodySSE:10,raster:'source-integer-original-GX-body-subset'},nativeBodyExtent:{frame:{...frame,recordKey},bodyColorOwnership:{ready:true,empty:false,completeWithinAdmittedRendererSubset:true,allVisibleContributionsCapturedWithinComposition:true,knownPixels:3,unavailablePixels:0,knownSpatialSupportRank:2,knownBodySpatiallyDegenerate:false}}};
 const support={branchId,recordKey,testedProposals:1,best,candidateSource:{matchesBranchEncounterPlan:true}},rankings=[{modelId,similarity:1,speciesCandidates:[{monsterId:1}],sourceNativeSupport:{kind:'conditional-source-native-own-support',modelId,branches:[support]}}];
 const alternative=compareCameraBodyAlternative({appearanceFrame:frame,rankings,legacyPrediction:null,backgroundBranchSupport:{kind:'same-frame-background-branch-support-v1',ready:true,frame,passingBranchCount:1,branches:[{branchId,recordKey,romSHA256:frame.romSHA256,fullRGBA_SHA256:frame.fullRGBA_SHA256}]},sourceBranches:[{branchId,frame:{...frame,recordKey},renderer:'source-integer-original-GX-body-subset',candidates:[{modelId,testedProposals:1,best,candidateSource:support.candidateSource}]}],expectedModelIds:[modelId]});
 assert.equal(alternative.supportedModelId,modelId);for(const b of alternative.branches)for(const c of b.candidates)c.sourceEvidenceReference={kind:'same-sighting-source-native-support-reference',classificationEvidenceIndex:0,modelId:c.modelId,branchId:b.branchId,recordKey:b.recordKey,field:'sourceNativeSupport'};
 const sighting={id:'camera-owned',frameKey:map.frame.frameKey,sourcePTS:1,classificationEvidence:[{rankings}],modelAliases:[{modelId,speciesCandidates:[{monsterId:1}]}],cameraBodyAlternative:alternative,conditionalBodyPrediction:null};
 const plan={mapIds:[1],models:[{modelId,variant:'_f',speciesCandidates:[{monsterId:1}],origins:[{mapId:1,tableId:1,monsterId:1}]}]};retained.sightings=[sighting];retained.modelPlan=plan;
 const owned=cloneImmutableObservationBundle(bundle({source:{video:stamp,background:{romSHA256:frame.romSHA256},modelPlan:plan},sightings:[sighting],videoObservations:[{timeline:{schema:'video-map-observation-timeline-v1',frames:[retained]}}]}));
 const states=[],prepared=[];const at=createVideoTrackingAT({engineRevision:'camera-ownership-test',getTables:()=>({}),getOptions:()=>({}),onState:s=>states.push(s),prepare:async(snapshot,options)=>{prepared.push({snapshot,options});return {gate:[],missingEvidence:[]};}});
 await at.observe(owned);assert.equal(prepared.length,1);assert.equal(prepared[0].snapshot.cameraBodyATAlternatives.singleEvents.length,1);assert.equal(prepared[0].options.singleEvents.length,1);assert.equal(prepared[0].snapshot.cameraBodyATValidationDeferrals,undefined);assert.equal(owned.cameraBodyATAlternatives,undefined);assert.equal(prepared[0].snapshot.cameraBodyATAlternatives.unknownAlternativeRetained,true);
});
