import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {VideoPipelineTiming} from '../web/map-browser-preview/video-pipeline-timing.mjs';
import {resolveVideoMinimapCandidates} from '../web/map-browser-preview/video-minimap-candidates.mjs';
import {VideoMapContinuity} from '../web/map-browser-preview/video-map-continuity.mjs';
const stamp={sourceId:'synthetic',sourceEpoch:2,timelineSegment:1,frameSerial:7,mediaTime:12,fullRGBA_SHA256:'a'.repeat(64)};
const fixture=()=>{
 const sourceImage={width:512,height:192,rgba:new Uint8Array(512*192*4)};
 for(let i=0;i<512*192;i++)sourceImage.rgba[i*4+3]=255;
 for(let y=80;y<83;y++)for(let x=120;x<123;x++)sourceImage.rgba.set([66,66,66,255],(y*512+x)*4);
 const record={key:'test-map',mapId:1,minimapCandidates:[{path:'a.bmmp'},{path:'b.bmmp'}]},catalog={minimap:{}},events=[];
 const renderer={compose(_c,path){events.push('decode:'+path);return{width:256,height:192,rgba:new Uint8Array(256*192*4),originPixel:[0,0],descriptor:{path,worldToMapScale:2,groupOrder:'source-order-prepended',groups:[{kind:'map-id-list',mapIds:[1],callOffset:0}]}};}};
 const matcher={setReference(image){events.push('reference:'+image.descriptor);},match(){events.push('match');return {resolved:true,candidates:[{dx:0,dy:0,scale:.5,score:1}],search:{budgetExhausted:false}};}};
 return {record,catalog,renderer,matcher,floors:{instances:[],unsupported:[]},sourceImage,layout:'ds-horizontal',frameEvidence:stamp,events};
};
test('targeted timing preserves exact values, Promise identity, throw, and scalar binding',()=>{
 let at=1;const timing=new VideoPipelineTiming({Observer:null,now:()=>at++}),object={},promise=Promise.resolve(object),error=Error('source');
 assert.strictEqual(timing.mapInputSync(stamp,'prologue',{recordKey:'map',descriptor:'a'},()=>object),object);
 assert.strictEqual(timing.mapInputSync(stamp,'promise',null,()=>promise),promise);
 assert.throws(()=>timing.mapInputSync(stamp,'throws',null,()=>{throw error;}),e=>e===error);
 const rows=timing.snapshot().recent;assert.deepEqual(rows.map(r=>r.kind),Array(3).fill('synchronous-span'));assert.deepEqual(rows.map(r=>r.threw),[false,false,true]);assert.equal(rows[0].sourcePTS,12);assert.equal(rows[0].sourceEpoch,2);assert.equal(rows[0].timelineSegment,1);assert.equal(rows[0].descriptor,'a');assert.equal(rows[0].recordKey,'map');
});
test('optional diagnostic clock/record failures preserve source results and errors',()=>{
 const timing=new VideoPipelineTiming({Observer:null,now:()=>0}),value={};timing.now=()=>{throw Error('clock');};assert.strictEqual(timing.mapInputSync(stamp,'clock',null,()=>value),value);
 timing.now=()=>0;timing.record=()=>{throw Error('record');};assert.strictEqual(timing.mapInputSync(stamp,'record',null,()=>value),value);const original=Error('source');assert.throws(()=>timing.mapInputSync(stamp,'record',null,()=>{throw original;}),e=>e===original);
});
test('reset ignores an old in-flight synchronous span, storage bounds remain unchanged',()=>{
 const timing=new VideoPipelineTiming({Observer:null,now:()=>0});timing.mapInputSync(stamp,'reset',null,()=>timing.reset('new'));assert.equal(timing.snapshot().totalRecords,0);
 for(let i=0;i<1000;i++)timing.mapInputSync(stamp,'phase-'+i,{descriptor:'path-'+i},()=>{});
 const s=timing.snapshot();assert.equal(s.stages.length,1);assert.equal(s.recent.length,64);assert.equal(s.longest['synchronous-span'].length,16);assert.equal(s.retention.maximumStages,32);
});
test('descriptor decode, marker, registration and floor segments preserve full source results and order',async()=>{
 const plain=fixture(),timed=fixture(),timing=new VideoPipelineTiming({Observer:null});
 const a=await resolveVideoMinimapCandidates(plain),b=await resolveVideoMinimapCandidates({...timed,measureMapInput:(phase,run,detail)=>timing.mapInputSync(stamp,phase,detail,run)});
 assert.deepEqual(a,b);assert.deepEqual(plain.events,timed.events);assert.equal(b.diagnostics.candidates[0].evidence.candidates.length,1);
 const rows=timing.snapshot().recent;assert.deepEqual(rows.map(r=>r.phase),Array(2).fill(['descriptor-decode','upper-marker-preparation','minimap-registration','marker-world-floor-queries']).flat());assert.deepEqual(rows.map(r=>r.descriptor),[...Array(4).fill('a.bmmp'),...Array(4).fill('b.bmmp')]);assert(rows.every(r=>r.recordKey==='test-map'));assert.doesNotThrow(()=>structuredClone(b));assert.doesNotMatch(JSON.stringify(b),/measureMapInput|map-input-synchronous|startedAtMs/);
});
test('descriptor source errors and cancellation keep original negative outcomes',async()=>{
 const f=fixture(),timing=new VideoPipelineTiming({Observer:null});f.renderer.compose=()=>{throw Error('missing source');};const r=await resolveVideoMinimapCandidates({...f,measureMapInput:(p,run,d)=>timing.mapInputSync(stamp,p,d,run)});assert.equal(r.accepted.length,0);assert.deepEqual(r.diagnostics.candidates.map(c=>c.unsupported),['missing source','missing source']);assert(timing.snapshot().recent.every(r=>r.threw));
 await assert.rejects(resolveVideoMinimapCandidates({...fixture(),isCurrent:()=>false}),{name:'AbortError'});
});
test('continuity hooks add neither yields nor different processing/cancel order',async()=>{
 async function run(timed){const f=fixture(),timing=new VideoPipelineTiming({Observer:null}),continuity=new VideoMapContinuity(),input={sourceImage:f.sourceImage,layout:f.layout,frameEvidence:stamp,frameId:7,automaticRecognition:true,...(timed?{measureMapInput:(p,run,d)=>timing.mapInputSync(stamp,p,d,run)}:{})},alignment={romSHA256:'rom',records:[f.record],catalog:f.catalog,matcher:f.matcher,imageHits:0,imageMisses:0,referenceCache:{cache:new Map(),image:path=>f.renderer.compose(null,path)},monsterWorkflowEligibility:()=>({skipBackground:false}),scene:()=>({floors:f.floors})};continuity.entry={key:continuity.key(input,'rom'),evidence:{maps:[{key:f.record.key}]},originFrame:stamp};
 const trace=[];const p=continuity.probe({input,alignment});trace.push([...f.events]);await Promise.resolve();trace.push([...f.events]);const value=await p;trace.push([...f.events]);return {value,trace,stats:continuity.stats,rows:timing.snapshot().recent};}
 const a=await run(false),b=await run(true);assert.deepEqual(a.value,b.value);assert.deepEqual(a.trace,b.trace);assert.deepEqual(a.stats,b.stats);assert(b.rows.some(r=>r.phase==='continuity-eligibility'));assert(b.rows.some(r=>r.phase==='continuity-scene'));
});
test('both entry points use transient hooks, preserve their own clearView behavior, and add no task scheduling',()=>{
 for(const file of ['preview.mjs','gpu-file-preview.mjs']){const source=readFileSync(new URL('../web/map-browser-preview/'+file,import.meta.url),'utf8'),part=source.split('async function renderFromName(input){')[1].split('async function runAutomaticSearch')[0];for(const phase of ['render-from-name-prologue','continuity-call-prologue','map-name-display'])assert(part.includes(phase));assert.doesNotMatch(part,/setTimeout|queueMicrotask|scheduler\.yield/);if(file==='preview.mjs')assert(part.includes('clearView({comparisonAlreadyCleared:input.automaticRecognition===true})'));else assert(part.includes('clearView()'));}
 const panel=readFileSync(new URL('../web/map-browser-preview/map-video-comparison.mjs?v=capture-catchup-20261008-e9f42247',import.meta.url),'utf8');assert(panel.includes('timingGeneration===timing.observerGeneration?timing.mapInputSync'));assert(panel.includes('frameId:frozen.id,getInferencePixels,measureMapInput'));
});
