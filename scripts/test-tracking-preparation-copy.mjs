import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compileTrackingObservations} from '../web/tracking-at-observation-adapter.mjs?v=ordinary-turn-20261009-e76d366f';
import {prepareTrackingJob} from '../web/tracking-at-session.mjs?v=ordinary-turn-20261009-e76d366f';
import {createVideoTrackingAT as createProductionVideoTrackingAT} from '../web/map-browser-preview/video-tracking-at.mjs?v=symbolic-clock-20261009-e604633f';
// Route persistence uses the existing store DI in Node-only fixtures.
const createVideoTrackingAT=options=>{
 const records=new Map(),store={load:async key=>structuredClone(records.get(key)??null),save:async(key,value)=>{records.set(key,structuredClone(value));}};
 return createProductionVideoTrackingAT({openStore:async()=>store,...options});
};
const bundle=extra=>({schema:'headless-monster-observation-bundle-v1',source:{background:{romSHA256:'a'.repeat(64)},modelPlan:{models:[]}},sightings:[],videoObservations:[],...extra});
const options=()=>({tables:{},domain:{kind:'all-output-classes'},budget:{maxInspectedStates:0,maxWallTimeMs:2000,chunkStates:4096}});
const context=extra=>({engineRevision:'preparation-copy-test',...extra});

test('default compiler retains independent native snapshot semantics and internal opt-out changes only that return field',()=>{
 const bytes=new Uint8Array([1,2,3]),shared={unknown:true},input=bundle({shared,alias:shared,bytes,buffer:bytes.buffer});shared.self=shared;
 const legacy=compileTrackingObservations(input,options()),explicit=compileTrackingObservations(input,options(),{includeBundleSnapshot:true}),without=compileTrackingObservations(input,options(),{includeBundleSnapshot:false});
 assert.deepEqual(legacy,explicit);const {bundleSnapshot,...expected}=legacy;assert.deepEqual(without,expected);assert.equal(Object.hasOwn(without,'bundleSnapshot'),false);
 assert.notStrictEqual(bundleSnapshot.shared,input.shared);assert.strictEqual(bundleSnapshot.shared,bundleSnapshot.alias);assert.strictEqual(bundleSnapshot.shared.self,bundleSnapshot.shared);assert.strictEqual(bundleSnapshot.bytes.buffer,bundleSnapshot.buffer);input.shared.unknown=false;bytes[0]=99;assert.equal(bundleSnapshot.shared.unknown,true);assert.equal(bundleSnapshot.bytes[0],1);
});

test('real preparation defaults keep the copy and internal opt-out preserves every job field and fingerprint',async()=>{
 const input=bundle({extra:{undefinedValue:undefined,nonfinite:NaN,unknownAlternativeRetained:true}}),opts=options(),nativeClone=globalThis.structuredClone;let wholeBundleCopies=0;
 globalThis.structuredClone=(value,...rest)=>{if(value===input)wholeBundleCopies++;return nativeClone(value,...rest);};
 try{const defaultJob=await prepareTrackingJob(input,opts,context());assert.equal(wholeBundleCopies,1);wholeBundleCopies=0;const internalJob=await prepareTrackingJob(input,opts,context({includeCompilerBundleSnapshot:false}));assert.equal(wholeBundleCopies,0);assert.deepEqual(internalJob,defaultJob);assert.equal(internalJob.replayInputHypotheses.unknownBranch.retained,true);assert(internalJob.identity.bundleSHA256);assert(internalJob.checkpointKey);}finally{globalThis.structuredClone=nativeClone;}
});

test('generic compiler and preparation still reject unsupported unused fields by default',async()=>{
 for(const unsupported of [()=>{},Symbol('unsupported'),new Proxy({},{})]){const input=bundle({unused:unsupported});assert.throws(()=>compileTrackingObservations(input,options()),{name:'DataCloneError'});await assert.rejects(prepareTrackingJob(input,options(),context()),{name:'DataCloneError'});}
});

test('production guards and pre-preparation cancellation remain active with opt-out',async()=>{
 for(const includeCompilerBundleSnapshot of [true,false]){
  await assert.rejects(prepareTrackingJob(bundle({nested:{dstSHA256:'prohibited'}}),options(),context({includeCompilerBundleSnapshot})),{name:'ProductionATInputPolicyError'});
  await assert.rejects(prepareTrackingJob(bundle(),{...options(),nested:{debugOnly:true}},context({includeCompilerBundleSnapshot})),{name:'ProductionATInputPolicyError'});
  await assert.rejects(prepareTrackingJob(bundle(),options(),context({includeCompilerBundleSnapshot,isCurrent:()=>false})),{name:'AbortError'});
 }
});

test('controller alone requests internal copy elision after native input cloning, with real preparation parity',async()=>{
 const input=bundle({sightings:[{id:'one'},{id:'two'}],conditionalATEventEvidence:{chains:[{id:'explicit',status:'conditional-source-model-evidence',provenance:'Synthetic preparation ownership contract',sightingIds:['one','two'],gaps:[{callsBetweenPostStates:{min:'1',max:'1'}}]}]}}),prepared=[],states=[];
 const at=createVideoTrackingAT({getOptions:options,engineRevision:'controller-copy-test',onState:s=>states.push(s),prepare:async(snapshot,opts,ctx)=>{assert.equal(ctx.includeCompilerBundleSnapshot,false);assert.equal(ctx.includeReplayInputHypotheses,false);const job=await prepareTrackingJob(snapshot,opts,ctx),full=await prepareTrackingJob(snapshot,opts,{...ctx,includeCompilerBundleSnapshot:true});assert.deepEqual(job,full);prepared.push(job);return{...job,gate:[]};}});
 await at.observe(input);assert.equal(prepared.length,1);assert.equal(Object.hasOwn(prepared[0].request,'includeCompilerBundleSnapshot'),false);assert.equal(input.automaticATEventEvidence,undefined);assert.equal(states.at(-1).status,'waiting');assert.equal(prepared[0].request.experiment.branches.some(b=>b.id==='tracking-observation-unknown'),true);
 await assert.rejects(at.observe(bundle({unused:()=>{}})),{name:'DataCloneError'});assert.equal(prepared.length,1);
});
