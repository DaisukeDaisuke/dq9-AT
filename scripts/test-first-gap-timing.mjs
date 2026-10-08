import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {VideoPipelineTiming} from '../web/map-browser-preview/video-pipeline-timing.mjs';
import {VideoTrackingReplay} from '../web/map-browser-preview/video-tracking-replay.mjs';
const stamp=(time,sourceEpoch=0)=>({sourceId:'synthetic-gap',sourceEpoch,timelineSegment:0,mediaTime:time,videoTime:time,timestampBasis:'retained-VideoFrame.timestamp',layout:'single',gameplayRGBA_SHA256:'a'.repeat(64)});
const image={width:256,height:192,rgba:new Uint8ClampedArray(196608)};
function fixture({supported=true}={}){
 let clock=100;const instances=[];class Observer{static supportedEntryTypes=['longtask'];constructor(callback){this.callback=callback;this.entries=[];instances.push(this);}observe(){}takeRecords(){const rows=this.entries;this.entries=[];return rows;}disconnect(){this.disconnected=true;}}
 const timing=new VideoPipelineTiming({now:()=>clock,timeOrigin:1000,Observer:supported?Observer:null});timing.start();const replay=new VideoTrackingReplay({timing,yieldTask:()=>Promise.resolve()});
 return {timing,replay,instances,setClock:value=>clock=value,retain(time,epoch=0){return replay.retain({image,stamp:stamp(time,epoch)});},seed(time=1){return replay.seed({stamp:stamp(time),backgroundEvidence:{romSHA256:'rom',recordKey:'map',mapId:1},tracking:{observed:[{id:'track',originalResidualId:1,roi:{x:20,y:20,w:24,h:24},firstSeen:time,lastSeen:time,sightings:1}]}});}};
}
test('first actual frame gap pins the existing bounded ledger with exact frame identities',()=>{
 const f=fixture();f.retain(1);f.timing.callback(stamp(1));f.setClock(630);f.timing.callback(stamp(1.516));f.timing.sync('example-sync',stamp(1.516),()=>{});f.retain(1.516);
 const p=f.replay.firstFrameGapTimingSnapshot();assert.equal(p.from.sourcePTS,1);assert.equal(p.to.sourcePTS,1.516);assert.equal(p.from.stamp.sourceId,'synthetic-gap');assert.equal(p.to.stamp.sourceEpoch,0);assert.equal(p.to.stamp.timelineSegment,0);assert.equal(p.to.stamp.gameplayRGBA_SHA256,'a'.repeat(64));assert.equal(p.performanceWindow.startedAtMs,100);assert.equal(p.performanceWindow.endedAtMs,630);assert.match(p.performanceWindow.basis,/not decoded callback/);assert.equal(p.timingSnapshotStatus,'captured');assert.equal(p.maximumSavedSnapshots,1);assert.equal(p.additionalPixelBytes,0);
 assert(p.timing.recent.some(r=>r.stage==='decoded-callback-interval'));assert.equal(p.matchingReplayLossCount,0);
});
test('pending completed long tasks are drained into the pinned gap snapshot',()=>{
 const f=fixture();f.retain(1);f.setClock(630);f.instances[0].entries.push({startTime:150,duration:400,name:'self'});f.retain(1.516);const p=f.replay.firstFrameGapTimingSnapshot();assert.equal(f.instances[0].entries.length,0);assert.equal(p.overlappingLongTasks.length,1);assert.equal(p.overlappingLongTasks[0].startedAtMs,150);assert.equal(p.longTaskAttribution.status,'overlap-observed-function-unattributed');assert.equal(p.longTaskAttribution.functionAttributionAvailable,false);
});
test('late delivery joins only the original time window; duplicates and drop counts stay bounded',()=>{
 const f=fixture();f.retain(1);f.setClock(630);f.retain(1.516);const observer=f.instances[0];
 observer.callback({getEntries:()=>[{startTime:200,duration:150,name:'self'},{startTime:700,duration:300,name:'outside-window'}]});assert.equal(f.replay.firstFrameGapTimingSnapshot().overlappingLongTasks.length,1);
 const already=f.replay.firstFrameGapTimingSnapshot().overlappingLongTasks[0];f.replay.acceptFirstFrameGapLongTask(already);assert.equal(f.replay.firstFrameGapTimingSnapshot().overlappingLongTasks.length,1);
 for(let i=0;i<24;i++)observer.callback({getEntries:()=>[{startTime:250+i,duration:60,name:'self'}]});let p=f.replay.firstFrameGapTimingSnapshot();assert.equal(p.overlappingLongTasks.length,16);assert.equal(p.droppedOverlappingLongTasks,9);
 const last={sequence:p.highestLongTaskSequenceSeen,kind:'browser-main-thread-long-task',startedAtMs:300,endedAtMs:360};f.replay.acceptFirstFrameGapLongTask(last);p=f.replay.firstFrameGapTimingSnapshot();assert.equal(p.droppedOverlappingLongTasks,9);
});
test('later work cannot evict or mutate the first-gap ledger and no extra pixels are retained',()=>{
 const f=fixture();f.retain(1);f.setClock(630);f.timing.record('early',100,620,stamp(1.516));f.retain(1.516);const before=f.replay.firstFrameGapTimingSnapshot();
 for(let i=0;i<1000;i++)f.timing.record('late',1000+i,2000+i,stamp(5));f.setClock(5000);f.retain(5);const after=f.replay.firstFrameGapTimingSnapshot();assert.deepEqual(after.timing,before.timing);assert.equal(after.from.sourcePTS,1);assert(!JSON.stringify(after).includes('"gray":'));after.timing.recent[0].stage='mutated';assert.notEqual(f.replay.firstFrameGapTimingSnapshot().timing.recent[0].stage,'mutated');
 assert.equal(f.replay.snapshot().diagnosticPixelBytes,0);assert(!JSON.stringify(f.replay.snapshot()).includes('first-retained-frame-gap-timing'));
});
test('exact gap pair links to actual replay loss without changing the rejection',async()=>{
 const f=fixture();f.retain(1);f.seed(1);f.setClock(630);f.retain(1.516);const state=await f.replay.settled(),p=f.replay.firstFrameGapTimingSnapshot();assert.equal(state.stopped,'unobserved-or-conflicted-frame-gap');assert.equal(state.tracks.length,0);assert.equal(p.matchingReplayLossCount,1);assert.equal(p.firstMatchingReplayLoss.fromFrameKey,p.from.key);assert.equal(p.firstMatchingReplayLoss.toFrameKey,p.to.key);assert.equal(p.firstMatchingReplayLoss.lostTrackCount,1);
});
test('a later real frame may fill a provisional gap without inventing a replay loss',async()=>{
 const f=fixture();f.retain(1);f.setClock(630);f.retain(1.516);f.setClock(700);f.retain(1.25);f.seed(1);await f.replay.settled();const p=f.replay.firstFrameGapTimingSnapshot();assert.equal(p.matchingReplayLossCount,0);assert.equal(p.firstMatchingReplayLoss,null);assert.notEqual(f.replay.snapshot().stopped,'unobserved-or-conflicted-frame-gap');
});
test('source reset removes pinned data and its delayed observer receiver',()=>{
 const f=fixture();f.retain(1);f.setClock(630);f.retain(1.516);f.replay.reset('replacement');assert.equal(f.replay.firstFrameGapTimingSnapshot(),null);assert.equal(f.timing.firstGapLongTaskWatcher,null);f.instances[0].callback({getEntries:()=>[{startTime:200,duration:300}]});assert.equal(f.replay.firstFrameGapTimingSnapshot(),null);
 f.setClock(800);f.retain(1,1);f.setClock(1400);f.retain(1.6,1);assert.equal(f.replay.firstFrameGapTimingSnapshot().from.stamp.sourceEpoch,1);
});
test('unsupported observer is explicitly unavailable; empty supported records are not proof of absence',()=>{
 for(const supported of [false,true]){const f=fixture({supported});f.retain(1);f.setClock(630);f.retain(1.516);const a=f.replay.firstFrameGapTimingSnapshot().longTaskAttribution;assert.equal(a.status,supported?'no-overlap-recorded-not-proof-of-absence':'observer-or-snapshot-unavailable');assert.equal(a.absenceEstablished,false);}
});
test('failing clock/snapshot/watch/flush/dispose fake diagnostics cannot change retain or gap behavior',async()=>{
 for(const failure of ['clock','snapshot','watch','flush','dispose','oversized-snapshot']){
  let clock=100;const good=new VideoPipelineTiming({now:()=>clock,Observer:null}),timing={sync:(_stage,_stamp,run)=>run(),now:()=>{if(failure==='clock')throw Error('clock');return clock;},snapshot:options=>{if(failure==='snapshot')throw Error('snapshot');const r=good.snapshot(options);if(failure==='oversized-snapshot')r.recent=Array(65).fill({});return r;},watchFirstFrameGapLongTasks(){if(failure==='watch')throw Error('watch');return()=>{if(failure==='dispose')throw Error('dispose');};},flushCompletedLongTasks(){if(failure==='flush')throw Error('flush');}},replay=new VideoTrackingReplay({timing,yieldTask:()=>Promise.resolve()});
  assert(replay.retain({image,stamp:stamp(1)}));replay.seed({stamp:stamp(1),backgroundEvidence:{},tracking:{observed:[{id:'track',originalResidualId:1,roi:{x:20,y:20,w:24,h:24},firstSeen:1,lastSeen:1,sightings:1}]}});clock=630;assert.doesNotThrow(()=>replay.retain({image,stamp:stamp(1.516)}));assert.equal((await replay.settled()).stopped,'unobserved-or-conflicted-frame-gap');assert.doesNotThrow(()=>replay.firstFrameGapTimingSnapshot());assert.doesNotThrow(()=>replay.reset('reset'));
 }
});
test('only explicit comparison download exposes the saved ledger',()=>{
 const panel=readFileSync(new URL('../web/map-browser-preview/map-video-comparison.mjs?v=frame-heading-20261008-b8f5df4e',import.meta.url),'utf8');assert.equal((panel.match(/firstFrameGapTimingSnapshot\(/g)??[]).length,1);assert.match(panel,/firstRetainedFrameGapTiming:fastReplay.firstFrameGapTimingSnapshot\(\)/);
});
