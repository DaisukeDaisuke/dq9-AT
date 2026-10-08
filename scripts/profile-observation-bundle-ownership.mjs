import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const [baselinePath,inputPath,comparisonPath,outputPath]=process.argv.slice(2);
if(!baselinePath||!inputPath||!comparisonPath||!outputPath)throw Error('Usage: node --expose-gc scripts/profile-observation-bundle-ownership.mjs BASELINE_SOURCE TIMELINE_JSON COMPARISON_JSON OUTPUT_JSON');
const baseline=file=>pathToFileURL(resolve(baselinePath,file)).href;
const {VideoObservationTimeline:BeforeTimeline}=await import(baseline('web/map-browser-preview/video-observation-timeline.mjs'));
import {VideoObservationTimeline as AfterTimeline} from '../web/map-browser-preview/video-observation-timeline.mjs?v=own-endpoints-20261008-e58b244e';
const {createVideoTrackingAT:beforeController}=await import(baseline('web/map-browser-preview/video-tracking-at.mjs'));
const {prepareTrackingJob:beforePrepare}=await import(baseline('web/tracking-at-session.mjs'));
import {prepareTrackingJob as afterPrepare} from '../web/tracking-at-session.mjs?v=own-endpoints-20261008-e58b244e';
import {createVideoTrackingAT as afterController} from '../web/map-browser-preview/video-tracking-at.mjs?v=own-endpoints-20261008-e58b244e';
import {assertProductionATInput} from '../web/production-at-input-policy.mjs';
// Private WeakSet ownership is scoped to the exact module URL. Resolve the
// producer's real import, including its cache query, rather than duplicating it.
const timelineModuleURL=new URL('../web/map-browser-preview/video-observation-timeline.mjs?v=own-endpoints-20261008-e58b244e',import.meta.url);
const ownershipImport=fs.readFileSync(timelineModuleURL,'utf8').match(/import\s*\{\s*cloneImmutableObservationBundle\s*\}\s*from\s*['"]([^'"]+)['"]/);
assert(ownershipImport,'Production timeline ownership-helper import is required');
const {copyObservationBundleForAT}=await import(new URL(ownershipImport[1],timelineModuleURL).href);
const baselineTimelineURL=new URL(baseline('web/map-browser-preview/video-observation-timeline.mjs'));
const baselineOwnershipImport=fs.readFileSync(baselineTimelineURL,'utf8').match(/import\s*\{\s*cloneImmutableObservationBundle\s*\}\s*from\s*['"]([^'"]+)['"]/);
// Historical sources before ownership sharing use native cloning. Later
// baselines must resolve their own producer's exact private-brand module.
const beforeCopy=baselineOwnershipImport?(await import(new URL(baselineOwnershipImport[1],baselineTimelineURL).href)).copyObservationBundleForAT:structuredClone;
import {residualObservationBundle} from '../web/map-browser-preview/residual-recognition-input.mjs?v=own-endpoints-20261008-e58b244e';
const input=resolve(inputPath),comparisonInput=resolve(comparisonPath),output=resolve(outputPath);
const raw=fs.readFileSync(input),timeline=JSON.parse(raw),comparison=JSON.parse(fs.readFileSync(comparisonInput)),frame=timeline.frames.at(-1);delete timeline.videoPipelineTiming;
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const value=residualObservationBundle({videoEvidence:frame.stamp,backgroundEvidence:comparison.background,backgroundRGBA_SHA256:frame.sightings[0].id.match(/^rom-background:([a-f0-9]{64}):/)[1],plan:frame.modelPlan,regions:frame.rawRegions,classifications:[],tracking:frame.tracking,videoTimeline:{placeholder:true}});
// Full retained current-frame sightings come from the actual download. The
// original callback envelope was not saved; this uses the production producer
// plus those observations, with detached current/history sightings as at runtime.
value.sightings=structuredClone(frame.sightings);
const before=new BeforeTimeline({immutableObservationBundles:true}),after=new AfterTimeline({immutableObservationBundles:true});
const beforeDefault=new BeforeTimeline(),afterDefault=new AfterTimeline();
for(const t of [before,after,beforeDefault,afterDefault])Object.assign(t,{source:timeline.source,reason:timeline.resetReason,resetCount:timeline.resetCount,totalFrames:timeline.totalAnalyzedFrames,frames:timeline.frames,events:timeline.entryCandidates,gaps:timeline.unobservedIntervals,evicted:timeline.retention.evicted});
const rows=[];
function timed(fn){const s=performance.now(),value=fn();return {value,ms:performance.now()-s};}
for(let i=0;i<12;i++)for(const kind of (i%2?['after','before']:['before','after'])){
 global.gc?.();const t=kind==='before'?before:after;
 const producer=timed(()=>t.snapshotBundle(value,{unaliasedResidualEnvelope:true}));
 const guard=timed(()=>assertProductionATInput(producer.value));
 const consumer=timed(()=>kind==='before'?beforeCopy(producer.value):copyObservationBundleForAT(producer.value));
 assert.equal(sha(consumer.value),sha(producer.value));
 rows.push({iteration:i,kind,producerMs:producer.ms,guardMs:guard.ms,consumerCopyMs:consumer.ms,combinedMs:producer.ms+guard.ms+consumer.ms});
}
// A non-AT consumer has no second copy to remove. Measure only its producer
// span, preserving that distinct cost model rather than charging an AT clone.
const defaultProducerRows=[];
for(let iteration=0;iteration<8;iteration++)for(const kind of iteration%2?['after','before']:['before','after']){
 global.gc?.();const produced=timed(()=>(kind==='before'?beforeDefault:afterDefault).snapshotBundle(value,{unaliasedResidualEnvelope:true}));
 defaultProducerRows.push({iteration,kind,producerMs:produced.ms,frozen:Object.isFrozen(produced.value),bundleSHA256:sha(produced.value)});
 if(kind==='after')assert.equal(Object.isFrozen(produced.value),false,'Default non-AT consumer must retain a mutable native snapshot');
}
assert.equal(new Set(defaultProducerRows.map(r=>r.bundleSHA256)).size,1,'Default producer evidence must remain equal');
const results=[],tables=JSON.parse(fs.readFileSync(new URL('../web/data/enc.json',import.meta.url))).main;

for(let iteration=0;iteration<6;iteration++)for(const kind of (iteration%2?['after','before']:['before','after'])){
 const [t,create,prepare]=kind==='before'?[before,beforeController,beforePrepare]:[after,afterController,afterPrepare];
 const states=[],prepared=[];const at=create({engineRevision:'profile-only',getTables:()=>tables,getOptions:()=>({tables,domain:{kind:'all-output-classes'}}),onState:s=>states.push(s),prepare:async(snapshot,options,context)=>{const job=await prepare(snapshot,options,context);prepared.push({coverage:{legacySingletons:snapshot.automaticATEventEvidence?.singleEvents.length??0,cameraSingletons:snapshot.cameraBodyATAlternatives?.singleEvents.length??0,cameraDeferrals:snapshot.cameraBodyATValidationDeferrals?.length??0},snapshotHash:sha(snapshot),optionsHash:sha(options),requestHash:sha(job.request),identity:job.identity,checkpointKey:job.checkpointKey,gate:job.gate});return {...job,gate:[]};}});
 global.gc?.();const started=performance.now();const produced=t.snapshotBundle(value,{unaliasedResidualEnvelope:true});const producerMs=performance.now()-started;const prologueStart=performance.now();const promise=at.observe(produced);const prologueMs=performance.now()-prologueStart,synchronousProducerConsumerMs=performance.now()-started;await promise;
 results.push({iteration,kind,producerMs,prologueMs,synchronousProducerConsumerMs,elapsedMs:performance.now()-started,output:{states,prepared,replayInputHypotheses:at.replayInputHypotheses,nativeBodySupportEvidence:at.nativeBodySupportEvidence,nativeMotionAssociationInputs:at.nativeMotionAssociationInputs}});
}
for(const result of results){assert.equal(result.output.prepared.length,1,'Full preparation must finish instead of being caught as a waiting error');assert.deepEqual(results[0].output,result.output);}

const summary={taskId:'274baea8-e2e9-4943-bb4a-b2eb1a8af933',node:process.version,input:{path:input,sha256:createHash('sha256').update(raw).digest('hex'),comparison:comparisonInput,comparisonSHA256:createHash('sha256').update(fs.readFileSync(comparisonInput)).digest('hex')},scope:'Node reproduction with production timeline/controller modules and a reconstructed current-frame observation envelope. Real prepareTrackingJob runs with checked-in encounter tables, but no AT search worker runs; prepared request/checkpoint/identity/gate parity is checked. No browser rerun; no attribution of initial 0.516 second callback gap; not a whole continuous-tracking performance claim.',reconstructedBundleCompactBytes:Buffer.byteLength(JSON.stringify(before.snapshotBundle(value,{unaliasedResidualEnvelope:true}))),rows,controller:results.map(({output,...r})=>({...r,outputSHA256:sha(output),prepared:output.prepared.map(p=>({...p,gateHash:sha(p.gate),gate:undefined})),statuses:output.states.map(s=>s.status)})),checks:{equalBundleJSON:true,equalControllerOutputs:true,defaultProducerEvidenceEqual:true,defaultAfterMutable:true},configuration:{atConsumer:{immutableObservationBundles:true},defaultConsumer:{immutableObservationBundles:false,atConsumerInvoked:false}},defaultProducerRows,statistics:{}};
const stats=a=>({minimum:Math.min(...a),median:a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)],maximum:Math.max(...a)});
for(const kind of ['before','after'])summary.statistics[kind]=Object.fromEntries(['producerMs','guardMs','consumerCopyMs','combinedMs'].map(k=>[k,stats(rows.filter(r=>r.kind===kind&&r.iteration>=2).map(r=>r[k]))]));
summary.synchronousSpanStatistics=Object.fromEntries(['before','after'].map(kind=>[kind,stats(results.filter(r=>r.kind===kind&&r.iteration>=1).map(r=>r.synchronousProducerConsumerMs))]));
summary.defaultProducerStatistics=Object.fromEntries(['before','after'].map(kind=>[kind,stats(defaultProducerRows.filter(r=>r.kind===kind&&r.iteration>=1).map(r=>r.producerMs))]));
fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,rows:undefined},null,2));
