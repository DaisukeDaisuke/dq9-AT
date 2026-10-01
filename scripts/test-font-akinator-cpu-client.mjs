import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {CPUTextClient} from '../web/font-akinator-cpu-client.mjs';
import {cpuTextDiagnostic,formatCpuTextDiagnostic} from '../web/font-akinator-diagnostic.mjs';
import {createCpuAkinatorWorkerHandler} from '../web/font-akinator-cpu-worker.mjs';
import {mapCandidatesFromAkinator,planCandidateReferences,CandidateMapMatcher} from '../web/map-disambiguation.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},ok=v=>{assert(v);checks++};
const glyphs={'1x1':[{char:'家',assignedChar:'家',rows:['#']}]},stamp={sourceId:'local-A',sourceEpoch:1,timelineSegment:0,generation:3,romEpoch:7,referenceEpoch:2,frameSerial:4,videoTime:1.25,roi:{x:0,y:0,w:1,h:1},markerProfiles:[{rgb:[66,66,66]}]},image={width:1,height:1,data:new Uint8ClampedArray([255,255,255,255])};
const request=()=>({glyphsBySize:structuredClone(glyphs),romEpoch:7,stamp:structuredClone(stamp),options:{maxMilliseconds:1000,autoThreshold:false,threshold:220,scales:[1],shiftX:0,shiftY:0,shiftStep:1,charCount:1}});
const workers=[];class FakeWorker{constructor(){this.messages=[];this.terminated=false;workers.push(this)}postMessage(m){this.messages.push(structuredClone(m))}terminate(){this.terminated=true}reply(m){this.onmessage?.({data:m})}}
const timers=[];const client=new CPUTextClient({factory:()=>new FakeWorker(),setTimer:fn=>(timers.push(fn),timers.length),clearTimer:()=>{},now:()=>0});
const ready=w=>{const m=w.messages[0];w.reply({type:'ready',id:m.id,romEpoch:m.romEpoch});return w.messages.at(-1)};
const answer=(w,m,alter={})=>w.reply({type:'result',id:m.id,romEpoch:m.romEpoch,stamp:m.stamp,result:{route:'glyph-akinator',sequence:'家',characters:[],candidates:[],complete:true,hypothesisSearchComplete:true,textResolved:true},...alter});
let r=request(),im={...image,data:image.data.slice()},p=client.match(im,r),w=workers.at(-1);r.stamp.markerProfiles[0].rgb[0]=0;r.glyphsBySize['1x1'][0].rows[0]='.';im.data[0]=1;let m=ready(w);eq(m.image.data[0],255);eq(m.stamp,stamp);eq(w.messages[0].glyphsBySize['1x1'][0].rows[0],'#');eq(m.options.maxMilliseconds,1000);answer(w,m);let result=await p;eq(w.terminated,true);eq(result.textResolved,false);eq(result.unknownTextPossible,true);eq(result.unsearchedTextPossible,true);eq(result.backend,'cpu-reference');eq(client.active,null);
p=client.match(image,request());w=workers.at(-1);m=ready(w);answer(w,m,{stamp:{...m.stamp,roi:{...m.stamp.roi,x:1}}});await assert.rejects(p,/識別情報/);checks++;eq(w.terminated,true);
p=client.match(image,request());w=workers.at(-1);m=ready(w);const rejected=assert.rejects(p,e=>e.name==='AbortError');client.cancel();await rejected;checks++;eq(w.terminated,true);const q=client.match(image,request()),newW=workers.at(-1),newM=ready(newW);answer(w,m);ok(client.active?.worker===newW);answer(newW,newM);await q;eq(client.active,null);
p=client.match(image,request());w=workers.at(-1);timers.at(-1)();result=await p;eq(w.terminated,true);eq(result.reason,'time-budget');eq(result.complete,false);eq(result.sequence,'');eq(result.hypothesisSearchComplete,false);eq(result.unsearchedTextPossible,true);eq(result.evaluationCountKnown,false);
for(const mutate of [x=>x.romEpoch++,x=>x.options.maxMilliseconds=10001,x=>x.options.charCount=33,x=>x.options.scales=new Array(1)]){r=request();mutate(r);assert.throws(()=>client.match(image,r));checks++;}
const shared=new Uint8Array(new SharedArrayBuffer(4));assert.throws(()=>client.match({...image,data:shared},request()),/共有/);checks++;
const records=[{mapId:101,name:'家',candidates:[{path:'house.bmmp'}]},{mapId:102,name:'家',candidates:[{path:'house.bmmp'}]},{mapId:103,name:'家',candidates:[]}];
const candidates=mapCandidatesFromAkinator({...result,sequence:'家'},records),plan=planCandidateReferences({records},candidates.mapIds);eq(candidates.mapIds,[101,102,103]);eq(plan.references[0].mapIds,[101,102]);eq(plan.unknown[0].mapId,103);eq(candidates.unsearchedTextPossible,true);
// No raster is needed to verify the map result's unknown gate: use one stubbed nominated reference.
const fake={project:{records:[records[0]]},image:()=>({width:2,height:2,originPixel:[0,0],descriptor:{worldToMapScale:1}}),matcher:{setReference(){},match(){return{resolved:true,best:{score:1},candidates:[{score:1}],search:{planComplete:true}}}}};
const mapped=CandidateMapMatcher.prototype.match.call(fake,{width:128,height:96,rgba:new Uint8Array(128*96*4)},{mapIds:[101],unsearchedTextPossible:true});eq(mapped.mapIdentityResolved,false);eq(mapped.resolvedMapId,null);ok(mapped.unknown.some(x=>x.reason==='unsearched-font-hypotheses'));eq(mapped.minimumProvenATCalls,0);eq(mapped.automaticATConsumption,false);
// Message delivery after the deadline cannot bypass a delayed timer task.
let clock=0;const late=new CPUTextClient({factory:()=>new FakeWorker(),now:()=>clock,setTimer:()=>1,clearTimer:()=>{}});const latePending=late.match(image,request()),lateWorker=workers.at(-1),lateMessage=ready(lateWorker);clock=5000;answer(lateWorker,lateMessage);const lateResult=await latePending;eq(lateResult.reason,'time-budget');eq(lateResult.sequence,'');eq(lateResult.complete,false);eq(lateWorker.terminated,true);
// Window timers enforce their receiver in browsers; Node timers do not. Exercise
// the production defaults with strict browser-style receiver checks.
const originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;
const browserTimers=new Map(),browserCleared=[];let browserTimerID=0;
try{
 globalThis.setTimeout=function(callback,delay){if(this!==globalThis)throw new TypeError('Illegal invocation: setTimeout');eq(delay,1000);const id=++browserTimerID;browserTimers.set(id,callback);return id;};
 globalThis.clearTimeout=function(id){if(this!==globalThis)throw new TypeError('Illegal invocation: clearTimeout');browserCleared.push(id);browserTimers.delete(id);};
 class ImmediateBrowserWorker extends FakeWorker{postMessage(m){super.postMessage(m);if(m.type==='init')this.reply({type:'ready',id:m.id,romEpoch:m.romEpoch});else if(m.type==='match')answer(this,m);}}
 const browserClient=new CPUTextClient({factory:()=>new ImmediateBrowserWorker(),now:()=>0});
 const browserResult=await browserClient.match(image,request());eq(browserResult.sequence,'家');eq(browserClient.active,null);eq(workers.at(-1).terminated,true);eq(browserCleared,[1]);eq(browserTimers.size,0);
 const browserCancel=new CPUTextClient({factory:()=>new FakeWorker(),now:()=>0});
 const browserPending=browserCancel.match(image,request()),browserRejected=assert.rejects(browserPending,e=>e.name==='AbortError');browserCancel.cancel();await browserRejected;checks++;eq(workers.at(-1).terminated,true);eq(browserCleared,[1,2]);eq(browserTimers.size,0);
 const browserTimeout=new CPUTextClient({factory:()=>new FakeWorker(),now:()=>0});
 const browserTimed=browserTimeout.match(image,request());browserTimers.get(3)();const browserUnknown=await browserTimed;eq(browserUnknown.reason,'time-budget');eq(browserTimeout.active,null);eq(workers.at(-1).terminated,true);eq(browserCleared,[1,2,3]);eq(browserTimers.size,0);
}finally{globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;}
// Diagnostics retain bounded known source locations without input data or URLs.
const hidden='PRIVATE_INPUT_SENTINEL',sourceError={stack:`TypeError: ${hidden}\n at f (https://example.invalid/${hidden}/font-akinator.mjs:146:19)\n at f (file:///tmp/${hidden}.mjs:1:2)\n at f (https://example.invalid/video-panel.mjs:102:84)`};
const diagnostic=cpuTextDiagnostic(sourceError,'worker-match');eq(diagnostic,{revision:'cpu-text-diag-1',phase:'worker-match',frames:['font-akinator.mjs:146:19','video-panel.mjs:102:84']});ok(!JSON.stringify(diagnostic).includes(hidden));ok(!JSON.stringify(diagnostic).includes('https:'));
eq(cpuTextDiagnostic({cpuDiagnostic:{...diagnostic,pixels:[1,2,3],frames:[...diagnostic.frames,'private.mjs:1:2','font-akinator.mjs:0:0']}},'client'),diagnostic);
eq(cpuTextDiagnostic({stack:Array(20).fill(' at f (font-akinator.mjs:146:19)').join('\n')}).frames.length,1);
eq(cpuTextDiagnostic({stack:Array.from({length:20},(_,i)=>` at f (font-akinator.mjs:${i+1}:1)`).join('\n')}).frames.length,6);
eq(formatCpuTextDiagnostic({cpuDiagnostic:diagnostic}),'[cpu-text-diag-1/worker-match font-akinator.mjs:146:19 ← video-panel.mjs:102:84]');
const diagnosticClient=new CPUTextClient({factory:()=>new FakeWorker(),now:()=>0,setTimer:()=>1,clearTimer:()=>{}}),diagnosticPending=diagnosticClient.match(image,request()),diagnosticWorker=workers.at(-1),diagnosticMessage=diagnosticWorker.messages[0];
diagnosticWorker.reply({type:'error',id:diagnosticMessage.id,romEpoch:diagnosticMessage.romEpoch,message:'Illegal invocation',diagnostic:{...diagnostic,pixels:[1,2,3]}});await assert.rejects(diagnosticPending,error=>{eq(error.cpuDiagnostic,diagnostic);return error.message==='Illegal invocation';});checks++;eq(diagnosticWorker.terminated,true);
const diagnosticReplies=[],diagnosticHandler=createCpuAkinatorWorkerHandler(m=>diagnosticReplies.push(m));await diagnosticHandler({type:'init',id:'diagnostic-init',romEpoch:0,glyphsBySize:null});eq(diagnosticReplies[0].diagnostic.phase,'worker-init');ok(diagnosticReplies[0].diagnostic.frames.some(f=>f.startsWith('font-akinator.mjs:')));eq(Object.keys(diagnosticReplies[0].diagnostic),['revision','phase','frames']);
// An actual CPU Worker completes the same one-glyph request with no navigator/GPU shim.
const workerURL=new URL('../web/font-akinator-cpu-worker.mjs',import.meta.url).href;
class NodeAdapter{constructor(){this.w=new Worker(`import {parentPort} from 'node:worker_threads';import {createCpuAkinatorWorkerHandler} from ${JSON.stringify(workerURL)};const handle=createCpuAkinatorWorkerHandler(m=>parentPort.postMessage(m));parentPort.on('message',m=>handle(m));`,{eval:true,type:'module'});this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>this.onerror?.({message:e.message}));}postMessage(m,t){this.w.postMessage(m,t)}terminate(){this.w.terminate()}}
const real=new CPUTextClient({factory:()=>new NodeAdapter()});result=await real.match(image,request());eq(result.sequence,'家');eq(result.characters[0].winner.difference,0);eq(result.backend,'cpu-reference');eq(result.unsearchedTextPossible,true);eq(real.active,null);
// Host termination remains immediate even while the disposable CPU Worker is
// scoring between its less-frequent task yields.
let cancelAdapter,cancelClient;
class CancelAdapter extends NodeAdapter{constructor(){super();this.exited=new Promise(resolve=>this.w.once('exit',resolve));this.terminationCount=0;}postMessage(m,t){super.postMessage(m,t);if(m.type==='match')setTimeout(()=>cancelClient.cancel(),5);}terminate(){this.terminationCount++;super.terminate();}}
cancelClient=new CPUTextClient({factory:()=>(cancelAdapter=new CancelAdapter())});
const large=request();large.glyphsBySize={'8x8':Array.from({length:4096},()=>({char:'A',rows:Array(8).fill('########')}))};large.options={...large.options,maxMilliseconds:10000,scales:[.95,1,1.05],shiftX:1,shiftY:1};
await assert.rejects(cancelClient.match(image,large),e=>e.name==='AbortError');checks++;await cancelAdapter.exited;eq(cancelAdapter.terminationCount,1);eq(cancelClient.active,null);
console.log(JSON.stringify({passed:true,checks,actualCpuWorker:true,noGpuShim:true,scope:'frozen input snapshot, request identity, cancellation/stale replies, hard timeout, unknown/alias gate, one-glyph real Worker'}));
