import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {VideoPipelineTiming} from '../web/map-browser-preview/video-pipeline-timing.mjs';
import {VideoObservationTimeline} from '../web/map-browser-preview/video-observation-timeline.mjs';
import {VideoTrackingReplay} from '../web/map-browser-preview/video-tracking-replay.mjs';
import {createVideoTrackingCapture} from '../web/map-browser-preview/video-tracking-capture.mjs';
import {createAutomaticBackgroundRenderer} from '../web/map-browser-preview/automatic-background-renderer.mjs';
const stamp=(pts=1)=>({sourceId:'synthetic-video',sourceEpoch:0,timelineSegment:0,frameSerial:1,mediaTime:pts,videoTime:pts,layout:'single',timestampBasis:'requestVideoFrameCallback.mediaTime',presentedFrames:Math.round(pts*60),gameplayRGBA_SHA256:'a'.repeat(64)});
function clock(){let at=0;const timing=new VideoPipelineTiming({now:()=>at,timeOrigin:1000,Observer:null});return {timing,set:value=>at=value,add:value=>at+=value};}
test('synchronous measurement preserves exact return, thrown value, and Promise identity',()=>{
 const f=clock(),value={test:true},error=Error('original');assert.strictEqual(f.timing.sync('test',stamp(),()=>{f.add(12);return value;}),value);
 assert.throws(()=>f.timing.sync('throw',stamp(),()=>{f.add(3);throw error;}),e=>e===error);const p=Promise.resolve(7);assert.strictEqual(f.timing.sync('promise-prologue',stamp(),()=>p),p);
 assert.deepEqual(f.timing.snapshot().recent.map(x=>[x.stage,x.durationMs,x.threw]),[['test',12,false],['throw',3,true],['promise-prologue',0,false]]);
});
test('elapsed markers add no scheduling and stale completion cannot enter a reset run',()=>{
 const f=clock(),finish=f.timing.beginElapsed('background',stamp());f.add(22);finish();assert.equal(f.timing.snapshot().recent[0].kind,'async-elapsed-not-CPU-time');
 const stale=f.timing.beginElapsed('old',stamp());f.timing.reset('replacement');f.add(20);stale();assert.equal(f.timing.snapshot().totalRecords,0);
 f.timing.sync('reset-inside',stamp(),()=>f.timing.reset('reset'));assert.equal(f.timing.snapshot().totalRecords,0);
});
test('recent, longest per kind, and stage storage stay bounded independently',()=>{
 const f=clock();for(let i=0;i<1000;i++)f.timing.record('stage-'+i,0,i,stamp());for(let i=0;i<1000;i++)f.timing.record('interval',0,10000+i,stamp(),{},'callback-interval-not-CPU-time');
 const s=f.timing.snapshot();assert.equal(s.recent.length,64);assert.equal(s.longest['synchronous-span'].length,16);assert.equal(s.longest['callback-interval-not-CPU-time'].length,16);assert.equal(s.stages.length,32);assert.equal(s.evicted,undefined);assert.equal(s.retention.evictedRecent,1936);assert.equal(s.longest['synchronous-span'][0].durationMs,999);
 s.recent[0].stage='mutated';assert.notEqual(f.timing.snapshot().recent[0].stage,'mutated');
});
test('callback gaps retain original PTS; pause, clock and source changes do not invent intervals',()=>{
 const f=clock();f.timing.callback(stamp(1));f.add(650);f.timing.callback(stamp(1.65));let s=f.timing.snapshot(),r=s.recent[0];assert.equal(r.previousSourcePTS,1);assert.equal(r.sourcePTS,1.65);assert.equal(r.presentedFramesDelta,39);assert.equal(r.kind,'callback-interval-not-CPU-time');
 f.timing.callbackBoundary('pause');f.add(5000);f.timing.callback(stamp(2));assert.equal(f.timing.snapshot().totalRecords,1);f.timing.callback({...stamp(3),sourceEpoch:1});assert.equal(f.timing.snapshot().totalRecords,1);f.timing.callback({...stamp(4),sourceEpoch:1,timestampBasis:'HTMLMediaElement.currentTime'});assert.equal(f.timing.snapshot().totalRecords,1);
});
test('browser observer is optional, bounded, flushable, and stale-safe after reset',()=>{
 const instances=[];class Observer{static supportedEntryTypes=['longtask'];constructor(callback){this.callback=callback;this.entries=[];instances.push(this);}observe(options){this.options=options;}takeRecords(){const a=this.entries;this.entries=[];return a;}disconnect(){this.disconnected=true;}}
 const timing=new VideoPipelineTiming({Observer,now:()=>100});timing.start();timing.start();assert.equal(instances.length,1);const old=instances[0];old.callback({getEntries:()=>[{startTime:10,duration:75,name:'self'}]});old.entries.push({startTime:90,duration:90,name:'self'});timing.disconnect();assert.equal(timing.snapshot().totalRecords,2);assert(old.disconnected);
 timing.reset('new');old.callback({getEntries:()=>[{startTime:10,duration:999}]});assert.equal(timing.snapshot().totalRecords,0);timing.start();assert.equal(instances.length,2);
 const unsupported=new VideoPipelineTiming({Observer:null});unsupported.start();assert.equal(unsupported.snapshot().observerStatus,'unsupported');
 class Failing{constructor(){throw Error('unsupported');}}const failing=new VideoPipelineTiming({Observer:Failing});assert.doesNotThrow(()=>failing.start());assert.equal(failing.snapshot().observerStatus,'failed');
 class BrokenDisposal{observe(){}takeRecords(){throw Error('optional read failed');}disconnect(){throw Error('optional disposal failed');}}const broken=new VideoPipelineTiming({Observer:BrokenDisposal});broken.start();assert.doesNotThrow(()=>broken.disconnect());assert.equal(broken.snapshot().observerStatus,'disconnected');
});
test('timeline observations and ownership copies are identical; only explicit download gains timings',()=>{
 const f=clock(),plain=new VideoObservationTimeline(),timed=new VideoObservationTimeline({timing:f.timing});
 for(const t of [plain,timed]){t.begin(stamp(),{frameSerial:1});t.update(1,{sightings:[{id:'one',fullEvidence:new Uint8Array([1,2,3])}]});t.gap(stamp(2),'existing-gap');}
 assert.deepEqual(timed.snapshot(),plain.snapshot());const value={schema:'headless-monster-observation-bundle-v1',producer:'browser-ROM-background-residual',videoObservations:[{kind:'partial-video-observation-timeline',timeline:{old:true}}],sightings:[{id:'one'}]};assert.deepEqual(timed.snapshotBundle(value,{unaliasedResidualEnvelope:true}),plain.snapshotBundle(value,{unaliasedResidualEnvelope:true}));assert.deepEqual(timed.snapshotBundle(value),plain.snapshotBundle(value));
 const exported=JSON.parse(timed.stringifySnapshot()),diagnostics=exported.videoPipelineTiming;delete exported.videoPipelineTiming;assert.deepEqual(exported,JSON.parse(plain.stringifySnapshot()));assert(diagnostics.stages.some(s=>s.stage==='timeline-update-clone'));assert(diagnostics.stages.some(s=>s.stage==='observation-bundle-clone'));
});
const image=()=>{const rgba=new Uint8ClampedArray(256*192*4);for(let i=0;i<256*192;i++){const v=(i*73+(i%256)**2*19)%251;rgba.set([v,v,v,255],i*4);}return{width:256,height:192,rgba};};
test('measured replay preserves results and still rejects the unchanged half-second gap',async()=>{
 const f=clock(),results=[];for(const timing of [null,f.timing]){const replay=new VideoTrackingReplay({timing,maximumWorkSliceMs:100000,yieldTask:()=>Promise.resolve()}),pixels=image();replay.retain({image:pixels,stamp:stamp()});replay.seed({stamp:stamp(),backgroundEvidence:{mapId:1,recordKey:'map',romSHA256:'rom'},tracking:{observed:[{id:'track',originalResidualId:7,roi:{x:20,y:20,w:24,h:24},firstSeen:1,lastSeen:1,sightings:1}]}});replay.retain({image:pixels,stamp:stamp(1.1)});await replay.settled();replay.retain({image:pixels,stamp:stamp(2)});results.push(await replay.settled());}
 assert.deepEqual(results[0],results[1]);assert.equal(results[1].stopped,'unobserved-or-conflicted-frame-gap');assert.equal(results[1].tracks.length,0);assert(f.timing.snapshot().stages.some(s=>s.stage==='replay-patch-correspondence'));
});
test('fast-capture pixels and evidence are unchanged and canceled hashes remain discarded',async()=>{
 const f=clock(),outputs=[];for(const timing of [null,f.timing]){let resolve;const held=new Promise(r=>resolve=r),frames=[],gaps=[],pixels=image().rgba,video={videoWidth:256,videoHeight:192};const replay={reset(){},retain:frame=>frames.push(frame),noteGap:(s,r)=>gaps.push(r)},document={createElement:()=>({getContext:()=>({getImageData:()=>({data:pixels})})})},makeCapture=()=>({draw(){},stamp:s=>({...s,captureTiming:{pixelTimestampBound:true}}),close(){}});
  const capture=createVideoTrackingCapture({video,replay,document,makeCapture,hash:()=>held,timing});assert(capture.offer(stamp(),{layout:'single'}));resolve('a'.repeat(64));await held;await Promise.resolve();await Promise.resolve();outputs.push({frames,gaps,snapshot:capture.snapshot()});
 }
 assert.deepEqual(outputs[0],outputs[1]);assert(f.timing.snapshot().stages.some(s=>s.stage==='fast-full-readback'));assert(f.timing.snapshot().stages.some(s=>s.stage==='fast-pixel-hash-elapsed'));
 let resolve;const held=new Promise(r=>resolve=r),frames=[];const capture=createVideoTrackingCapture({video:{videoWidth:256,videoHeight:192},replay:{reset(){},retain:f=>frames.push(f),noteGap(){}},document:{createElement:()=>({getContext:()=>({getImageData:()=>({data:image().rgba})})})},makeCapture:()=>({draw(){},stamp:s=>({...s,captureTiming:{pixelTimestampBound:true}}),close(){}}),hash:()=>held,timing:f.timing});capture.offer(stamp(),{layout:'single'});capture.reset('cancel');const count=f.timing.snapshot().totalRecords;resolve('a'.repeat(64));await held;await Promise.resolve();await Promise.resolve();assert.equal(frames.length,0);assert.equal(f.timing.snapshot().totalRecords,count);
});
test('background phase spans label elapsed time while retaining backend outputs',async()=>{
 let at=0;const renderer=createAutomaticBackgroundRenderer({now:()=>++at,initialize:async()=>({ready:true}),createCache:project=>({project,stats:{},dispose(){}}),prepare:async()=>({evidence:{}}),renderGpu:async()=>({ready:true,marker:'unchanged',diagnostics:{counts:{covered:1,known:1,unknownTranslucentDestinationFragments:0}}})});
 const value=await renderer.render({project:{archive(){}},rom:new Uint8Array(1),record:{},active:{environment:{mode:1},environmentApplied:true},camera:{}});assert.equal(value.marker,'unchanged');const p=value.diagnostics.automaticBackgroundPipeline;assert.equal(p.backend,'webgpu-source-integer-pixels');assert.deepEqual(p.performanceSpans.map(s=>s.phase),['adapter-wait','source-preparation','gpu-render-and-decode']);assert(p.performanceSpans.every(s=>s.kind==='async-elapsed-not-CPU-time'&&s.durationMs===s.endedAtMs-s.startedAtMs));renderer.destroy();
});
test('instrumentation introduces no timer or new await scheduling boundary',()=>{
 const collector=readFileSync(new URL('../web/map-browser-preview/video-pipeline-timing.mjs',import.meta.url),'utf8');assert.doesNotMatch(collector,/\b(?:setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\s*\(/);assert.doesNotMatch(collector,/\bawait\b|new Promise/);
 const panel=readFileSync(new URL('../web/map-browser-preview/map-video-comparison.mjs?v=camera-at-20261008-f1a85661',import.meta.url),'utf8');assert.match(panel,/videoPipelineTiming:timing.snapshot\(\)/);assert.match(panel,/new Blob\(\[timeline.stringifySnapshot\(\)\]/);assert.match(panel,/timing.callbackBoundary\('video-pause'\)/);
});
