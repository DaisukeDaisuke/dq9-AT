// Reuse saved video observation evidence; do not render, classify or create a
// native-state origin. The arguments are private evidence directories/ROM files.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {openMapRom} from '../web/map-browser-preview/static-scene.mjs';
import {buildRomMapCatalog} from '../web/map-browser-preview/rom-map-catalog.mjs';
import {createVideoTrackingAT} from '../web/map-browser-preview/video-tracking-at.mjs?v=symbolic-clock-20261009-e604633f';
import {prepareTrackingJob} from '../web/tracking-at-session.mjs?v=ordinary-turn-20261009-e76d366f';
import {searchAutomaticReplayInputs} from '../web/video-replay-factor-search.mjs';
const [romPath,evidenceRoot]=process.argv.slice(2);assert(romPath&&evidenceRoot,'ROM and saved evidence root required');
const hashes=[],hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>{const b=fs.readFileSync(p);hashes.push({name:path.basename(p),bytes:b.length,sha256:hash(b)});return b;},json=p=>JSON.parse(read(path.join(evidenceRoot,p)));
const original=json('conditional-at-tables-ca525123-896c-4da7-a8cc-b3cc6d42f2ef/PRIVATE_REBUILT_62_BUNDLE.json'),entry=json('offline-entry-b92ef7b0-58cb-48b1-b13e-5d7093966134/SOURCE_ENTRY_TIMELINE.json'),located=json('offline-location-reuse-3fb33878-04d1-4fcb-b23d-b8733028b1bd/LOCATED_TIMELINE_SCALAR.json'),expected=json('offline-location-reuse-3fb33878-04d1-4fcb-b23d-b8733028b1bd/LOCATED_REPLAY_INPUTS.json');
const frameAt=(list,frame)=>list.find(f=>f.sourcePTS===frame.sourcePTS&&f.stamp.fullRGBA_SHA256===frame.stamp.fullRGBA_SHA256),bodyFrames=original.videoObservations[0].timeline.frames;
const timeline={...structuredClone(entry),...Object.fromEntries(['source','entryCandidates','unobservedIntervals','retention','coverage'].map(k=>[k,structuredClone(located[k])])),frames:located.frames.map(s=>{
 const old=frameAt(entry.frames,s),body=frameAt(bodyFrames,s);assert(old||body,'No original source frame');for(const f of [old,body])if(f)assert.deepEqual(f.stamp,s.stamp);
 return {...structuredClone(old??{}),...structuredClone(body??{}),frameSerial:s.frameSerial,sourcePTS:s.sourcePTS,stamp:structuredClone(s.stamp),romSHA256:s.romSHA256,mapNameCandidates:structuredClone(s.mapNameCandidates??[]),positionCandidates:structuredClone(s.positionCandidates??[]),mapSearchDiagnostics:structuredClone(s.mapSearchStatuses??[])};
})};
const bundle={...structuredClone(original),videoObservations:[{kind:'partial-video-observation-timeline',timeline,absenceCertified:false,minimumProvenATCalls:0}]},before=structuredClone(bundle);
const replay=await searchAutomaticReplayInputs(bundle);assert.deepEqual(replay,expected,'Current source must reproduce all saved 142 joins/24 compatible inputs');
const rom=read(romPath),romSHA256=hash(rom);assert.equal(romSHA256,'3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7');const project=openMapRom(rom),catalog=buildRomMapCatalog(project),tables=JSON.parse(fs.readFileSync(new URL('../web/data/enc.json',import.meta.url))).main;
const jobs=[],states=[];let withContext=null;
for(const enabled of [false,true]){
 let job=null;const controller=createVideoTrackingAT({engineRevision:'same-current-engine-source',getTables:()=>tables,...(enabled?{getReplaySourceContext:()=>({project,catalog,romSHA256})}:{}),onState:s=>states.push({enabled,...s}),prepare:async(snapshot,options,context)=>{job=await prepareTrackingJob(snapshot,options,context);return{...job,gate:[]};}});
 await controller.observe(bundle);assert(job,'Three supported historical conditional predicates must still prepare');jobs.push(job);assert.deepEqual(controller.replayInputHypotheses,expected);if(enabled)withContext=controller.replaySourcePreparation;else assert.equal(controller.replaySourcePreparation,null);
 const exported=controller.replaySourcePreparation;if(exported){exported.bindings.length=0;assert.equal(controller.replaySourcePreparation.bindings.length,24);}controller.cancel();assert.equal(controller.replaySourcePreparation,null);
}
// Cancellation inside a real source read cannot resume old AT preparation.
let cancelledController,sourceRead=false,latePrepare=false;
const interruptedProject={nfs:{readFile:p=>{if(!sourceRead){sourceRead=true;cancelledController.cancel('interrupted-ROM-source');}return project.nfs.readFile(p);}}};
cancelledController=createVideoTrackingAT({engineRevision:'cancelled-source',getReplaySourceContext:()=>({project:interruptedProject,catalog,romSHA256}),prepare:()=>{latePrepare=true;throw Error('stale AT preparation');}});
await cancelledController.observe(bundle);assert.equal(sourceRead,true);assert.equal(latePrepare,false);assert.equal(cancelledController.replaySourcePreparation,null);
// A source companion setup failure is separate from supported AT predicates.
let fallbackJob=null;const failedContext=createVideoTrackingAT({engineRevision:'same-current-engine-source',getTables:()=>tables,getReplaySourceContext:()=>{throw Error('controlled source context unavailable');},prepare:async(snapshot,options,context)=>{fallbackJob=await prepareTrackingJob(snapshot,options,context);return{...fallbackJob,gate:[]};}});
await failedContext.observe(bundle);assert.deepEqual(fallbackJob,jobs[0]);assert.equal(failedContext.replaySourcePreparation.status,'source-preparation-unresolved');
assert.deepEqual(jobs[0],jobs[1],'Source companion must not modify any AT request, identity, gate, checkpoint or motion input');assert.deepEqual(bundle,before);assert.equal(withContext.bindings.length,24);assert.equal(withContext.sources.length,1);assert.equal(withContext.sources[0].sourceReady,true);assert.equal(jobs[1].request.experiment.sightings.length,62);assert.equal(jobs[1].request.experiment.branches.length,4);assert.equal(jobs[1].request.experiment.branches[0].events.length,0);
console.log(JSON.stringify({passed:true,currentFactorSearchExactlyMatchesSaved:true,candidatePairs:replay.stats.candidatePairs,conditionalInputBranchesPrepared:24,sourceRecords:1,all62SightingsAndThreeConditionalSingletonsUnchanged:true,ATJobsDeepStrictEqual:true,checkpointKey:jobs[1].checkpointKey,ownedExportMutationIsolated:true,cancelledSourceCannotPrepareAT:true,sourceFailureKeepsOriginalATJob:true,originalEvidenceUnchanged:true,inputIdentities:hashes,nativeReplayExecuted:false,currentVideoStateRecovered:false,minimumProvenATCalls:0},null,2));
