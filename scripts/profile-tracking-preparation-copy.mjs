import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {VideoObservationTimeline} from '../web/map-browser-preview/video-observation-timeline.mjs';
import {createVideoTrackingAT} from '../web/map-browser-preview/video-tracking-at.mjs?v=route-poses-20261008-d98f497f';
import {residualObservationBundle} from '../web/map-browser-preview/residual-recognition-input.mjs';
import {prepareTrackingJob as afterPrepare} from '../web/tracking-at-session.mjs?v=route-poses-20261008-d98f497f';
const [baselinePath,timelinePath,comparisonPath,outputPath,mode]=process.argv.slice(2);
if(!baselinePath||!timelinePath||!comparisonPath||!outputPath)throw Error('Usage: node --expose-gc scripts/profile-tracking-preparation-copy.mjs BASELINE_SOURCE TIMELINE_JSON COMPARISON_JSON OUTPUT_JSON [baseline-only]');
const {prepareTrackingJob:beforePrepare}=await import(pathToFileURL(resolve(baselinePath,'web/tracking-at-session.mjs')).href);
const rawTimeline=fs.readFileSync(resolve(timelinePath)),rawComparison=fs.readFileSync(resolve(comparisonPath)),timeline=JSON.parse(rawTimeline),comparison=JSON.parse(rawComparison),frame=timeline.frames.at(-1);delete timeline.videoPipelineTiming;
const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const tables=JSON.parse(fs.readFileSync(new URL('../web/data/enc.json',import.meta.url))).main;
const value=residualObservationBundle({videoEvidence:frame.stamp,backgroundEvidence:comparison.background,backgroundRGBA_SHA256:frame.sightings[0].id.match(/^rom-background:([a-f0-9]{64}):/)[1],plan:frame.modelPlan,regions:frame.rawRegions,classifications:[],tracking:frame.tracking,videoTimeline:{placeholder:true}});
value.sightings=structuredClone(frame.sightings);
const t=new VideoObservationTimeline({immutableObservationBundles:true});Object.assign(t,{source:timeline.source,reason:timeline.resetReason,resetCount:timeline.resetCount,totalFrames:timeline.totalAnalyzedFrames,frames:timeline.frames,events:timeline.entryCandidates,gaps:timeline.unobservedIntervals,evicted:timeline.retention.evicted});
let captured;const states=[];const controller=createVideoTrackingAT({engineRevision:'preparation-copy-profile',getTables:()=>tables,getOptions:()=>{throw Error('Unexpected explicit-chain path');},onState:s=>states.push(s),prepare:async(snapshot,options,context)=>{captured={snapshot,options,context};return{gate:[],missingEvidence:[]};}});
await controller.observe(t.snapshotBundle(value,{unaliasedResidualEnvelope:true}));assert(captured,'Actual event producer must reach preparation');
const {snapshot,options,context}=captured,initialSnapshotHash=hash(snapshot),initialOptionsHash=hash(options),rows=[],nativeClone=globalThis.structuredClone;
let referenceJob;const kinds=mode==='baseline-only'?['before']:['before','after'];
for(let iteration=0;iteration<(mode==='baseline-only'?3:7);iteration++)for(const kind of iteration%2?[...kinds].reverse():kinds){
 const prepare=kind==='before'?beforePrepare:afterPrepare;let wholeBundleCopies=0,wholeBundleCopyMs=0;
 global.gc?.();globalThis.structuredClone=function(value,...rest){if(value!==snapshot)return nativeClone(value,...rest);const start=performance.now();try{return nativeClone(value,...rest);}finally{wholeBundleCopies++;wholeBundleCopyMs+=performance.now()-start;}};
 let job,synchronousMs,elapsedMs;try{const start=performance.now(),promise=prepare(snapshot,options,context);synchronousMs=performance.now()-start;job=await promise;elapsedMs=performance.now()-start;}finally{globalThis.structuredClone=nativeClone;}
 if(!referenceJob)referenceJob=job;else assert.deepEqual(job,referenceJob);
 assert.equal(hash(snapshot),initialSnapshotHash);assert.equal(hash(options),initialOptionsHash);
 rows.push({iteration,kind,synchronousMs,elapsedMs,wholeBundleCopies,wholeBundleCopyMs,jobSHA256:hash(job)});
}
const stats=a=>({minimum:Math.min(...a),median:a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)],maximum:Math.max(...a)}),statistics={};
for(const kind of kinds)statistics[kind]=Object.fromEntries(['synchronousMs','elapsedMs','wholeBundleCopyMs'].map(key=>[key,stats(rows.filter(r=>r.kind===kind&&r.iteration>=1).map(r=>r[key]))]));
const output={taskId:'a28dee18-eeca-460a-b254-3b76e896eca5',baselineCommit:'8d01161af62d770c9c6edb43c6230929cf7b6364',node:process.version,scope:'Direct real prepareTrackingJob profiling. Current production controller produced the snapshot/options from a reconstructed envelope containing actual warm sightings/history. No browser measurement, no AT search worker execution, no initial callback-gap causation claim.',input:{timeline:resolve(timelinePath),timelineSHA256:hash(rawTimeline),comparison:resolve(comparisonPath),comparisonSHA256:hash(rawComparison)},snapshotCompactBytes:Buffer.byteLength(JSON.stringify(snapshot)),snapshotSHA256:initialSnapshotHash,optionsSHA256:initialOptionsHash,coverage:{legacySingletons:snapshot.automaticATEventEvidence.singleEvents.length,cameraSingletons:snapshot.cameraBodyATAlternatives?.singleEvents.length??0,includeReplayInputHypotheses:context.includeReplayInputHypotheses,includeCompilerBundleSnapshot:context.includeCompilerBundleSnapshot},job:{sha256:hash(referenceJob),identity:referenceJob.identity,checkpointKey:referenceJob.checkpointKey,requestSHA256:hash(referenceJob.request),gate:referenceJob.gate},checks:{completeJobDeepEqual:true,snapshotUnchanged:true,optionsUnchanged:true},rows,statistics};
fs.writeFileSync(resolve(outputPath),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({...output,rows:undefined,job:{...output.job,gate:undefined}},null,2));
