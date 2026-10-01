#!/usr/bin/env node
// Node-only fake DOM/canvas test of the real panel control flow. No browser, ROM,
// media device, pixels from a recording, WebGPU or network is required.
// node --experimental-vm-modules scripts/check-video-panel-capture.mjs [panel.mjs] [dependency-web-directory]
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const panel=resolve(process.argv[2]||resolve(here,'../web/video-panel.mjs'));
const dependencies=resolve(process.argv[3]||dirname(panel));
const source=await readFile(panel,'utf8');
const imported={};
for(const spec of [...source.matchAll(/^import .+ from '([^']+)';$/gm)].map(m=>m[1])){
 if(['./map-name-match.mjs','./map-name-roi.mjs','./party-marker-calibration.mjs'].includes(spec))continue;
 imported[spec]=await import(pathToFileURL(resolve(dependencies,spec)));
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const result={route:'glyph-akinator',sequence:'TEST MAP',candidates:[],characters:[],evaluated:1,textResolved:true,reason:'test'};
let checks=0;
function check(name,fn){try{fn();checks++;}catch(e){throw Error(name+': '+e.message);}}
async function fixture({auto=false,track=true,registration=true}={}){
 const elements=new Map(),windows=new Map(),events=[],workers=[],captures=[],names=[],markerPixels=[],matches=[];let nameDetection={resolved:true,roi:{x:0,y:0,w:1,h:.1}};
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.value='';this.checked=false;this.width=256;this.height=192;this.pixel=0;this.currentTime=1;this.videoWidth=256;this.videoHeight=192;this.readyState=2;this.paused=true;this.seeking=false;this.duration=100;}
  set innerHTML(html){for(const m of html.matchAll(/<([a-z0-9]+)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){const e=new Element(m[1]);e.id=m[3];e.value=m[2].match(/\bvalue="([^"]*)"/)?.[1]??'';e.checked=/\bchecked\b/.test(m[2]);elements.set(e.id,e);}}
  getContext(){if(this.ctx)return this.ctx;const canvas=this;this.ctx=new Proxy({drawImage(input){canvas.pixel=input.pixel;},getImageData(_x,_y,w,h){const data=new Uint8ClampedArray(w*h*4);data.fill(canvas.pixel);return {width:w,height:h,data};},putImageData(image){canvas.pixel=image.data[0];}}, {get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});return this.ctx;}
  addEventListener(n,fn){(this.listeners[n]??=[]).push(fn);}emit(n){for(const fn of this.listeners[n]||[])fn();}
  set textContent(value){this.text=String(value);this.children=[];}get textContent(){return (this.text||'')+this.children.map(child=>child.textContent).join('');}
  append(...items){this.children.push(...items);}replaceChildren(...items){(this.replacements??=[]).push([...items]);this.text='';this.children=[...items];}add(x){this.append(x);}
  pause(){this.paused=true;this.emit('pause');}play(){this.paused=false;this.emit('play');return Promise.resolve();}load(){}removeAttribute(n){delete this[n];}requestVideoFrameCallback(fn){this.frameCallback=fn;return 1;}cancelVideoFrameCallback(){this.frameCallback=null;}
 }
 class FakeWorker{constructor(url){this.url=String(url);this.messages=[];workers.push(this);}postMessage(m){this.messages.push(structuredClone(m));}terminate(){this.terminated=true;}reply(m){this.onmessage?.({data:m});}}
 class Coordinator extends imported['./player-capture.mjs'].PlayerCaptureCoordinator{
  capture(args){captures.push(args);return super.capture(args);}name(token,observation){if(observation)names.push(observation);return super.name(token,observation);}
 }
 const match={route:'glyph-akinator',match(image,options){const pending=deferred();matches.push({image,options, ...pending});return pending.promise;},cancel(){},destroy(){}};
 const document={createElement:tag=>new Element(tag),getElementById:id=>elements.get(id),querySelector:()=>new Element(),fonts:{add(){},delete(){}}};
 const window={addEventListener(n,fn){if(!windows.has(n))windows.set(n,[]);windows.get(n).push(fn);},dispatchEvent(e){events.push(e);for(const fn of windows.get(e.type)||[])fn(e);}};
 const sandbox={document,window,Worker:FakeWorker,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},localStorage:{getItem(){return null;},setItem(){}},navigator:{mediaDevices:{enumerateDevices:async()=>[]}},URL,Blob,Date,performance,structuredClone,Uint8ClampedArray,console,setTimeout,clearTimeout,AbortController,DOMException,queueMicrotask,testMatcher:match};
 const context=vm.createContext(sandbox);
 const module=new vm.SourceTextModule(source+`\nexport const captureTest={readFrame,invalidateSource,setup(){matcher=testMatcher;records=[{mapId:7402,name:'TEST MAP'}];positionReady=true;positionHasReference=true;},getFile:()=>fileInput,getCamera:()=>camera,resetGPU(){gpuUnavailable=false;},setupCPU(){runtimeGlyphs={'1x1':[{char:'T',assignedChar:'T',rows:['#']}]};},getState:()=>({generation,romEpoch,positionEpoch,frameSerial,busy,pendingRead,observations,positionSample,mapCandidatePending,gpuUnavailable,cpuHeld,screenApproved,layoutBinding,retainedMap,roi})};`,{context,identifier:pathToFileURL(panel).href,initializeImportMeta(meta){meta.url=pathToFileURL(panel).href;}});
 await module.link(spec=>{
  let exports=imported[spec];
  if(spec==='./font-akinator-cpu-client.mjs')exports={CPUTextClient:class extends imported[spec].CPUTextClient{constructor(){super({factory:()=>new FakeWorker('font-akinator-cpu-worker.mjs')});}}};
  if(spec==='./player-capture.mjs')exports={PlayerCaptureCoordinator:Coordinator};
  if(spec==='./map-name-match.mjs')exports={createTextMatcher:()=>match};
  if(spec==='./map-name-roi.mjs')exports={detectMapNameROI:()=>nameDetection};
  if(spec==='./party-marker-calibration.mjs')exports={calibratedPartyMarkerCandidates:image=>{markerPixels.push(image.rgba[0]);return {frame:{width:256,height:192},candidates:[],calibration:{profiles:[{slot:1,rgb:[66,66,66]}],status:'test'}};}};
  return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context});
 });
 await module.evaluate();
 const api=module.namespace.captureTest;api.setup();
 const $=id=>elements.get(id),video=$('camera-video');video.pixel=17;
 $('screen-mode').value=auto?'auto':'manual';$('name-roi-mode').value='manual';$('player-marker-mode').value='hud';$('player-enabled').checked=track;$('position-enabled').checked=registration;$('position-scales').value='.5';$('text-match-route').value='glyph-akinator';$('text-scales').value='1';$('text-char-count').value='16';$('text-budget').value='1500';$('player-tolerance').value='12';
 const emit=(type,detail)=>window.dispatchEvent({type,detail});
 const requests=()=>events.filter(e=>e.type==='dq9-map-candidates-request').map(e=>e.detail);
 const sample=()=>({sourceKind:'local-file',sourceId:'fixture-A',sourceEpoch:7,timelineSegment:2,videoTime:1,mediaTime:1,timestampBasis:'requestVideoFrameCallback.mediaTime',presentedFrames:60,absoluteFrameIndex:null,capturedAt:'2026-09-30T00:00:00.000Z'});
 const position=workers.find(w=>w.url.includes('position-worker')),layout=workers.find(w=>w.url.includes('ds-screen-worker'));
 const finishRegistration=()=>{const m=position.messages.findLast(m=>m.type==='frame');if(m)position.reply({type:'frame',epoch:m.epoch,frameSerial:m.frameSerial,ok:true,result:{kind:'video-map-registration',resolved:false,candidates:[],reason:'synthetic'}});};
 const finishLayout=(resolved=true)=>{const m=layout.messages.at(-1);layout.reply({id:m.id,result:{resolved,reason:resolved?'fixture':'map-not-visible',analysisSize:{width:256,height:192},candidates:[{x:0,y:0,w:256,h:192,score:1}]}});};
 return {api,$,video,events,captures,names,markerPixels,matches,workers,emit,requests,sample,position,layout,finishRegistration,finishLayout,setNameDetection:r=>{nameDetection=r;}};
}
const cases=[];
async function run(name,fn){try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:e.message});}}
await run('media advancement preserves frozen pixels and one immutable shared stamp',async()=>{
 const f=await fixture(),pending=f.api.readFrame(10,f.sample());
 f.video.currentTime=9;f.video.pixel=91;f.finishRegistration();f.matches[0].resolve(result);await pending;
 const request=f.requests()[0],capture=f.captures[0];
 check('map request exists',()=>assert(request));
 check('same stamp object',()=>assert.strictEqual(request.stamp,capture.stamp));
 check('text uses same stamp',()=>assert.strictEqual(f.names[0].stamp,capture.stamp));
 check('registration uses same stamp values',()=>assert.deepEqual(f.position.messages.find(m=>m.type==='frame').stamp,structuredClone(capture.stamp)));
 check('stamp metadata complete',()=>assert.deepEqual([capture.stamp.videoTime,capture.stamp.generation,capture.stamp.romEpoch,capture.stamp.referenceEpoch,capture.stamp.sourceId],[1,0,0,0,'fixture-A']));
 check('stamp is deeply frozen',()=>assert(Object.isFrozen(capture.stamp)&&Object.isFrozen(capture.stamp.roi)&&Object.isFrozen(capture.stamp.sourceFrame)&&Object.isFrozen(capture.stamp.markerCalibration.profiles)));
 check('stamp cannot mutate',()=>assert.throws(()=>{request.stamp.videoTime=20;},TypeError));
 for(const mutate of [()=>{request.stamp.roi.x=9;},()=>{request.stamp.sourceFrame.width=1;},()=>{request.stamp.markerProfiles[0].rgb[0]=0;},()=>{request.stamp.markerCalibration.profiles[0].rgb[0]=0;}])check('nested stamp cannot mutate',()=>assert.throws(mutate,TypeError));
 check('one original pixel source across analyses',()=>assert.deepEqual([f.markerPixels[0],f.matches[0].image.data[0],request.frame.rgba[0],f.position.messages.find(m=>m.type==='frame').frame.rgba[0]],[17,17,17,17]));
 check('wall clock/currentTime not reread after await',()=>assert.equal(request.stamp.videoTime,1));
});
await run('missing caller timing is fixed at pixel capture before layout await',async()=>{
 const f=await fixture({auto:true}),pending=f.api.readFrame(10,{sourceId:'fixture-A'});
 f.video.currentTime=8;f.video.pixel=81;f.finishLayout();await Promise.resolve();await Promise.resolve();
 check('OCR started after layout',()=>assert.equal(f.matches.length,1));f.finishRegistration();f.matches[0].resolve(result);await pending;
 check('fallback capture time remains original',()=>assert.equal(f.captures[0].stamp.videoTime,1));
 check('fallback stamp shared',()=>assert.strictEqual(f.requests()[0].stamp,f.captures[0].stamp));
 check('layout captured original pixels',()=>assert.equal(f.layout.messages[0].image.data[0],17));
});
for(const phase of ['layout','text'])for(const change of ['reference','seek','replacement','rom-release','resize'])await run(`${change} during ${phase} await drops stale work`,async()=>{
 const f=await fixture({auto:phase==='layout'}),file=f.api.getFile();file.url='blob:fixture';file.sourceId='fixture-A';file.generation=7;file.segment=2;
 const pending=f.api.readFrame(10,f.sample());
 if(change==='reference')f.emit('dq9-map-image',null);
 if(change==='seek'){f.video.seeking=true;f.video.emit('seeking');}
 if(change==='replacement')file.load(new Blob(['synthetic fixture']));
 if(change==='rom-release')f.emit('dq9-rom-release');
 if(change==='resize'){f.video.readyState=0;f.video.videoWidth=512;f.video.emit('resize');}
 if(phase==='layout'){f.finishLayout();for(let i=0;i<4;i++)await Promise.resolve();if(f.matches[0])f.matches[0].resolve(result);}else f.matches[0].resolve(result);
 await pending;
 check('no stale map request',()=>assert.equal(f.requests().length,0));
 check('no stale name observation',()=>assert.equal(f.names.length,0));
 if(phase==='layout')check('no downstream pixel analysis on stale layout',()=>assert.equal(f.captures.length,0));
 check('panel unlocked',()=>assert.equal(f.api.getState().busy,false));
});
await run('reference change also suppresses late OCR errors',async()=>{
 const f=await fixture(),pending=f.api.readFrame(10,f.sample());f.emit('dq9-map-image',null);f.matches[0].reject(Error('old OCR failure'));await pending;
 check('old error does not replace reference UI',()=>assert(!f.$('name-candidates').textContent?.includes('old OCR failure')));
 check('no request on error',()=>assert.equal(f.requests().length,0));
});
await run('tracking disabled still produces an immutable capture stamp',async()=>{
 const f=await fixture({track:false,registration:false}),pending=f.api.readFrame(10,f.sample());f.video.currentTime=10;f.video.pixel=22;f.matches[0].resolve(result);await pending;
 check('tracking stays disabled',()=>assert.equal(f.captures.length,0));check('map still processed',()=>assert.equal(f.requests().length,1));check('stamp frozen without player',()=>assert(Object.isFrozen(f.requests()[0].stamp)));check('same pixel',()=>assert.equal(f.requests()[0].frame.rgba[0],17));
});
await run('queued read captures the new frame only after the old work settles',async()=>{
 const f=await fixture(),file=f.api.getFile();Object.assign(file,{url:'blob:fixture',sourceId:'fixture-A',generation:7,segment:2});
 const first=f.api.readFrame(10,f.sample());f.video.currentTime=2;f.video.pixel=29;await f.api.readFrame(20,file.snapshot());
 check('busy read does not overwrite canvas',()=>assert.equal(f.matches.length,1));f.finishRegistration();f.matches[0].resolve(result);await first;await Promise.resolve();
 check('pending map acquisition suppresses repeated OCR',()=>assert.equal(f.matches.length,1));const oldMap=f.requests()[0];f.emit('dq9-map-candidates-result',{requestId:oldMap.requestId,result:{kind:'video-map-disambiguation',stamp:structuredClone(oldMap.stamp),candidateSource:oldMap.candidates,rankings:[],unknown:[],bestMapIds:[],reason:'synthetic',descriptorCandidate:false}});for(let i=0;i<4;i++)await Promise.resolve();
 check('queued new OCR starts',()=>assert.equal(f.matches.length,2));check('old completion leaves newer work busy',()=>assert.equal(f.api.getState().busy,true));check('new analysis captures the next current frame',()=>assert.equal(f.api.getState().frameSerial,2));f.finishRegistration();f.matches[1].resolve(result);for(let i=0;i<4;i++)await Promise.resolve();
 check('two request frames',()=>assert.deepEqual(f.requests().map(r=>r.frame.rgba[0]),[17,29]));check('two timestamps',()=>assert.deepEqual(f.requests().map(r=>r.stamp.videoTime),[1,2]));check('distinct stamps',()=>assert.notStrictEqual(f.requests()[0].stamp,f.requests()[1].stamp));check('newer completion unlocks panel',()=>assert.equal(f.api.getState().busy,false));
});
await run('late map results from an invalidated source cannot enter observations',async()=>{
 const f=await fixture(),pending=f.api.readFrame(10,f.sample());f.finishRegistration();f.matches[0].resolve(result);await pending;const request=f.requests()[0];f.api.invalidateSource('source-changed');const count=f.api.getState().observations.length;
 f.emit('dq9-map-candidates-result',{type:'map-candidates-error',requestId:request.requestId,stamp:request.stamp,message:'late map failure'});
 check('no stale map observation',()=>assert.equal(f.api.getState().observations.length,count));check('stale map error not shown',()=>assert(!f.$('map-disambiguation').textContent?.includes('late map failure')));
});
await run('source replacement queues a fresh frame while stale OCR settles',async()=>{
 const f=await fixture(),file=f.api.getFile();Object.assign(file,{url:'blob:fixture',sourceId:'fixture-A',generation:7,segment:2});
 const old=f.api.readFrame(10,f.sample());file.generation++;file.sourceId='fixture-B';f.api.invalidateSource('file-replacement',file.snapshot());f.video.currentTime=4;f.video.pixel=44;await f.api.readFrame(20,file.snapshot());
 check('new frame waits for previous OCR',()=>assert.equal(f.matches.length,1));f.matches[0].resolve(result);await old;for(let i=0;i<4;i++)await Promise.resolve();
 check('stale OCR publishes no request',()=>assert.equal(f.requests().length,0));check('fresh OCR starts once',()=>assert.equal(f.matches.length,2));check('fresh OCR retains busy lock',()=>assert.equal(f.api.getState().busy,true));
 f.finishRegistration();f.matches[1].resolve(result);for(let i=0;i<4;i++)await Promise.resolve();check('only new source published',()=>assert.deepEqual(f.requests().map(r=>[r.stamp.sourceId,r.stamp.sourceEpoch,r.stamp.videoTime,r.frame.rgba[0]]),[['fixture-B',8,4,44]]));check('fresh completion unlocks panel',()=>assert.equal(f.api.getState().busy,false));
});
await run('capture setup errors release the busy lock',async()=>{
 const f=await fixture(),bad=f.api.readFrame(10,{bad:()=>{}});if(f.matches[0])f.matches[0].resolve(result);await assert.rejects(bad);check('failed clone unlocks panel',()=>assert.equal(f.api.getState().busy,false));
 const pending=f.api.readFrame(11,f.sample());f.finishRegistration();f.matches.at(-1).resolve(result);await pending;check('later valid capture recovers',()=>assert.equal(f.requests().length,1));
});
await run('successful map response and player log preserve identical capture values',async()=>{
 const f=await fixture(),pending=f.api.readFrame(10,f.sample());f.finishRegistration();f.matches[0].resolve(result);await pending;const request=f.requests()[0];
 f.emit('dq9-map-candidates-result',{requestId:request.requestId,result:{kind:'video-map-disambiguation',stamp:structuredClone(request.stamp),candidateSource:request.candidates,rankings:[],unknown:[],bestMapIds:[],reason:'synthetic',descriptorCandidate:false}});
 const logs=f.api.getState().observations,player=logs.find(o=>o.playerPosition),map=logs.find(o=>o.mapDisambiguation),text=logs.find(o=>o.kind==='video-map-name-candidates');
 check('player and map logs use same stamp values',()=>assert.deepEqual(structuredClone(player.playerPosition.stamp),structuredClone(map.mapDisambiguation.stamp)));check('text and player logs use same stamp values',()=>assert.deepEqual(structuredClone(text.stamp),structuredClone(player.playerPosition.stamp)));check('party factors preserve stamp',()=>assert.deepEqual(structuredClone(map.mapDisambiguation.partyCoordinates.stamp),structuredClone(request.stamp)));check('registration log preserves stamp',()=>assert.deepEqual(structuredClone(logs.find(o=>o.reason==='synthetic').stamp),structuredClone(request.stamp)));check('all logs remain zero AT evidence',()=>assert(logs.every(o=>o.minimumProvenATCalls===0)));
});

async function prepareCPU(){
 const f=await fixture(),file=f.api.getFile();Object.assign(file,{url:'blob:fixture',sourceId:'fixture-A',generation:7,segment:2});f.api.setupCPU();
 const unsupported=f.api.readFrame(1,f.sample());f.finishRegistration();f.matches[0].reject(Error('WebGPUが利用できません。'));await unsupported;
 check('real unsupported path enables explicit CPU action',()=>assert.equal(f.$('cpu-text-once').disabled,false));
 return f;
}
function readyCPU(f){const w=f.workers.findLast(w=>w.url.includes('font-akinator-cpu-worker')),init=w.messages[0];w.reply({type:'ready',id:init.id,romEpoch:init.romEpoch});return {w,message:w.messages.at(-1)};}
await run('CPU fallback is an explicit single frozen frame and keeps shared provenance',async()=>{
 const f=await prepareCPU();const before=f.workers.length;await f.api.readFrame(2,f.sample());check('continuous loop never starts CPU work',()=>assert.equal(f.workers.length,before));
 const pending=f.$('cpu-text-once').onclick(),{w,message}=readyCPU(f);f.video.pixel=99;f.video.currentTime=20;await f.api.readFrame(3,f.sample());
 check('CPU holds automatic reads',()=>assert.equal(f.api.getState().pendingRead,false));check('CPU source pixels remain frozen',()=>assert.equal(message.image.data[0],17));check('CPU honors current 1500ms budget',()=>assert(message.options.maxMilliseconds<=1500));
 f.finishRegistration();w.reply({type:'result',id:message.id,romEpoch:message.romEpoch,stamp:structuredClone(message.stamp),result});await pending;
 const request=f.requests()[0];check('CPU maps receive the same immutable captured stamp',()=>assert.strictEqual(request.stamp,f.captures.at(-1).stamp));check('CPU worker echo matches capture',()=>assert.deepEqual(message.stamp,structuredClone(request.stamp)));check('CPU map pixels frozen',()=>assert.equal(request.frame.rgba[0],17));check('CPU capture time remains original',()=>assert.equal(request.stamp.videoTime,1));check('CPU map nominees retain unsearched text',()=>assert.equal(request.candidates.unsearchedTextPossible,true));check('finished CPU Worker released',()=>assert.equal(w.terminated,true));check('CPU result stays held',()=>assert.equal(f.api.getState().cpuHeld,true));
 f.$('cpu-text-release').onclick();check('explicit release resumes capture',()=>assert.equal(f.api.getState().cpuHeld,false));
});
for(const change of ['seek','rom-release','reference','cancel'])await run(`CPU ${change} terminates and discards stale frozen result`,async()=>{
 const f=await prepareCPU(),pending=f.$('cpu-text-once').onclick(),{w,message}=readyCPU(f);
 if(change==='seek'){f.video.seeking=true;f.video.emit('seeking');}
 if(change==='rom-release')f.emit('dq9-rom-release');if(change==='reference')f.emit('dq9-map-image',null);if(change==='cancel')f.$('text-cancel').onclick();
 await pending;w.reply({type:'result',id:message.id,romEpoch:message.romEpoch,stamp:message.stamp,result});
 check('CPU Worker terminated on discontinuity',()=>assert.equal(w.terminated,true));check('stale CPU does not nominate maps',()=>assert.equal(f.requests().length,0));check('CPU busy lock released',()=>assert.equal(f.api.getState().busy,false));check('CPU freeze released',()=>assert.equal(f.api.getState().cpuHeld,false));
});
await run('CPU mismatched nested stamp is rejected before map nomination',async()=>{
 const f=await prepareCPU(),pending=f.$('cpu-text-once').onclick(),{w,message}=readyCPU(f);const altered=structuredClone(message.stamp);altered.roi.x+=.01;
 w.reply({type:'result',id:message.id,romEpoch:message.romEpoch,stamp:altered,result});await pending;
 check('wrong CPU stamp creates no map request',()=>assert.equal(f.requests().length,0));check('wrong stamp error shown',()=>assert.match(f.$('name-candidates').textContent,/識別情報/));check('wrong stamp releases worker',()=>assert.equal(w.terminated,true));
});

await run('CPU one-frame time setting never increases the continuous GPU budget',async()=>{
 const f=await prepareCPU();f.$('cpu-text-budget').value='10000';f.$('cpu-text-budget').onchange();
 const pending=f.$('cpu-text-once').onclick(),{w,message}=readyCPU(f);check('CPU uses explicitly selected long limit',()=>assert(message.options.maxMilliseconds>9000&&message.options.maxMilliseconds<=10000));
 f.$('text-cancel').onclick();await pending;f.api.resetGPU();const gpu=f.api.readFrame(7,f.sample());check('continuous GPU remains at1500ms',()=>assert.equal(f.matches.at(-1).options.maxMilliseconds,1500));f.finishRegistration();f.matches.at(-1).resolve(result);await gpu;
});

await run('CPU cancellation during layout detaches immediately and drops the late reply',async()=>{
 const f=await prepareCPU();f.$('screen-mode').value='auto';const pending=f.$('cpu-text-once').onclick();check('CPU waits on layout before creating its scorer Worker',()=>assert(!f.workers.some(w=>w.url.includes('font-akinator-cpu-worker'))));
 f.$('text-cancel').onclick();await pending;check('layout cancellation immediately releases busy',()=>assert.equal(f.api.getState().busy,false));check('layout cancellation releases held capture',()=>assert.equal(f.api.getState().cpuHeld,false));f.finishLayout();await Promise.resolve();check('late layout has no map result',()=>assert.equal(f.requests().length,0));
 const next=f.api.readFrame(8,f.sample());f.finishLayout();await next;check('new layout can complete after canceled old request',()=>assert.equal(f.api.getState().busy,false));
});
await run('a new CPU capture rejects the prior pending map result',async()=>{
 const f=await prepareCPU();const first=f.$('cpu-text-once').onclick();let {w,message}=readyCPU(f);f.finishRegistration();w.reply({type:'result',id:message.id,romEpoch:message.romEpoch,stamp:message.stamp,result});await first;const old=f.requests()[0];
 const second=f.$('cpu-text-once').onclick();const before=f.api.getState().observations.length;f.emit('dq9-map-candidates-result',{type:'map-candidates-error',requestId:old.requestId,stamp:old.stamp,message:'old map error'});check('old map result cannot enter the new capture',()=>assert.equal(f.api.getState().observations.length,before));check('old map error cannot repaint new CPU UI',()=>assert(!f.$('map-disambiguation').textContent.includes('old map error')));f.$('text-cancel').onclick();await second;
});

await run('whole CPU deadline also bounds automatic-layout waiting',async()=>{
 const f=await prepareCPU();f.$('screen-mode').value='auto';f.$('cpu-text-budget').value='5';await f.$('cpu-text-once').onclick();
 check('layout timeout releases busy without a reply',()=>assert.equal(f.api.getState().busy,false));check('layout timeout creates no scoring Worker',()=>assert(!f.workers.some(w=>w.url.includes('font-akinator-cpu-worker'))));check('layout timeout keeps unsearched status',()=>assert.match(f.$('cpu-text-status').textContent,/未探索/));check('layout timeout cannot nominate maps',()=>assert.equal(f.requests().length,0));f.finishLayout();
});
await run('CPU error UI retains only bounded worker source locations',async()=>{
 const f=await prepareCPU(),pending=f.$('cpu-text-once').onclick(),{w,message}=readyCPU(f);
 w.reply({type:'error',id:message.id,romEpoch:message.romEpoch,message:'Illegal invocation',diagnostic:{revision:'cpu-text-diag-1',phase:'worker-match',frames:['font-akinator.mjs:146:19','private-input.mjs:1:2'],secret:'PRIVATE_INPUT_SENTINEL'}});await pending;
 check('CPU error source appears in the visible error area',()=>assert.match(f.$('name-candidates').textContent,/cpu-text-diag-1\/worker-match font-akinator\.mjs:146:19/));check('unapproved fields and source names stay absent',()=>assert(!/PRIVATE_INPUT_SENTINEL|private-input/.test(f.$('name-candidates').textContent)));check('failed CPU frame cannot nominate maps',()=>assert.equal(f.requests().length,0));check('diagnostic failure releases Worker',()=>assert.equal(w.terminated,true));
});

async function completeLayoutFrame(f,s=f.sample()){
 const before=f.layout.messages.length,matchCount=f.matches.length,pending=f.api.readFrame(11,s);
 if(f.layout.messages.length>before)f.finishLayout();
 for(let i=0;i<4;i++)await Promise.resolve();
 if(f.matches.length>matchCount){f.finishRegistration();f.matches.at(-1).resolve(result);}await pending;const request=f.requests().at(-1);if(f.api.getState().mapCandidatePending?.mode==='acquire')f.emit('dq9-map-candidates-result',{requestId:request.requestId,result:{kind:'video-map-disambiguation',stamp:structuredClone(request.stamp),candidateSource:request.candidates,rankings:[],unknown:[],bestMapIds:[],reason:'synthetic',descriptorCandidate:false}});
}
await run('automatic rectangle locks to source and dimensions across moving frames and seeks',async()=>{
 const f=await fixture({auto:true});await completeLayoutFrame(f);const roi=structuredClone(f.api.getState().roi.screen);
 const file=f.api.getFile();Object.assign(file,{url:'blob:fixture',sourceId:'fixture-A',generation:7,segment:2});
 for(const videoTime of [2,3,50]){f.video.currentTime=videoTime;f.video.pixel=20+videoTime;f.video.seeking=true;f.video.emit('seeking');f.video.seeking=false;await completeLayoutFrame(f,file.snapshot());}
 check('actual FileVideoInput seek increments observed epochs',()=>assert.deepEqual(f.requests().map(r=>r.stamp.sourceEpoch),[7,8,9,10]));check('only initial acquisition uses layout worker',()=>assert.equal(f.layout.messages.length,1));check('locked normalized rectangle remains unchanged',()=>assert.deepEqual(structuredClone(f.api.getState().roi.screen),roi));check('each captured frame still has its own timestamp',()=>assert.deepEqual(f.requests().map(r=>r.stamp.videoTime),[1,2,3,50]));check('moving pixels remain independently captured',()=>assert.deepEqual(f.requests().map(r=>r.frame.rgba[0]),[17,22,23,70]));check('reused geometry retains original acquisition timestamp',()=>assert(f.requests().every(r=>r.stamp.screenLayout.acquisition.videoTime===1)));check('acquisition metadata is immutable',()=>assert(Object.isFrozen(f.requests().at(-1).stamp.screenLayout.acquisition.sourceFrame)));check('status makes locking explicit',()=>assert.match(f.$('screen-status').textContent,/固定/));
});
await run('ROM and reference changes invalidate observations but preserve layout geometry',async()=>{
 const f=await fixture({auto:true});await completeLayoutFrame(f);f.emit('dq9-map-image',null);await completeLayoutFrame(f);f.emit('dq9-rom-release');f.api.setup();await completeLayoutFrame(f);
 check('reference and ROM changes do not redetect geometry',()=>assert.equal(f.layout.messages.length,1));check('new observations use changed epochs',()=>assert.deepEqual(f.requests().map(r=>[r.stamp.romEpoch,r.stamp.referenceEpoch]),[[0,0],[0,1],[1,1]]));
});
await run('source identity, source epoch and dimensions each require fresh acquisition',async()=>{
 const f=await fixture({auto:true});await completeLayoutFrame(f);let s=f.sample();
 for(const next of [{...s,sourceId:'fixture-B'},{...s,sourceId:'fixture-B',sourceEpoch:8},{...s,sourceKind:'camera',sourceId:'fixture-B',sourceEpoch:8}])await completeLayoutFrame(f,next);
 check('file epoch is timeline-only; identity and camera change reacquire',()=>assert.equal(f.layout.messages.length,3));f.video.videoWidth=512;await completeLayoutFrame(f,{...s,sourceKind:'camera',sourceId:'fixture-B',sourceEpoch:8});check('changed decoded dimensions cannot reuse old geometry',()=>assert.equal(f.layout.messages.length,4));
 f.video.readyState=0;f.video.emit('resize');f.video.readyState=2;await completeLayoutFrame(f,{...s,sourceKind:'camera',sourceId:'fixture-B',sourceEpoch:8});check('resize event explicitly clears binding',()=>assert.equal(f.layout.messages.length,5));await completeLayoutFrame(f,{...s,sourceKind:'camera',sourceId:'fixture-B',sourceEpoch:9});check('camera generation changes require acquisition',()=>assert.equal(f.layout.messages.length,6));
});
await run('explicit redetect and reset clear acquisition while manual range remains manual',async()=>{
 const f=await fixture({auto:true});await completeLayoutFrame(f);f.$('screen-detect').onclick();await completeLayoutFrame(f);check('redetect reacquires once',()=>assert.equal(f.layout.messages.length,2));f.$('video-roi-reset').onclick();await completeLayoutFrame(f);check('range reset reacquires once',()=>assert.equal(f.layout.messages.length,3));
 f.$('screen-mode').value='manual';f.$('screen-mode').onchange();const roi=structuredClone(f.api.getState().roi.screen);await completeLayoutFrame(f,{...f.sample(),sourceId:'manual-new-source'});check('manual path does not invoke automatic detector',()=>assert.equal(f.layout.messages.length,3));check('explicit manual normalized range retained',()=>assert.deepEqual(structuredClone(f.api.getState().roi.screen),roi));
});
await run('map disappears at fixed dimensions: retain layout and emit unknown without new marker or map work',async()=>{
 const f=await fixture({auto:true});f.$('name-roi-mode').value='auto';await completeLayoutFrame(f);const old=f.requests()[0],captures=f.captures.length;
 f.setNameDetection({resolved:false,reason:'name-frame-absent'});f.video.pixel=0;await completeLayoutFrame(f,{...f.sample(),videoTime:2});
 check('black scene does not hunt a new rectangle',()=>assert.equal(f.layout.messages.length,1));check('black scene does not start marker/registration analysis',()=>assert.equal(f.captures.length,captures));check('black scene does not invoke glyph matching',()=>assert.equal(f.matches.length,1));check('unknown scene clears candidate result ownership',()=>assert.equal(f.api.getState().mapCandidatePending,null));check('UI marks map visibility unknown',()=>assert.match(f.$('position-status').textContent,/地図表示は未確定/));
 const count=f.api.getState().observations.length;f.emit('dq9-map-candidates-result',{type:'map-candidates-error',requestId:old.requestId,stamp:old.stamp,message:'late former scene'});check('old scene reply cannot append after unknown frame',()=>assert.equal(f.api.getState().observations.length,count));check('unknown observation retained',()=>assert(f.api.getState().observations.some(o=>o.nameROIObservation?.kind==='video-name-roi-unknown')));
 f.setNameDetection({resolved:true,roi:{x:0,y:0,w:1,h:.1}});f.video.pixel=45;await completeLayoutFrame(f,{...f.sample(),videoTime:3});check('map return reuses locked geometry',()=>assert.equal(f.layout.messages.length,1));check('map return resumes current-frame observations',()=>assert.equal(f.requests().at(-1).frame.rgba[0],45));check('map return preserves height/AT uncertainty',()=>assert(f.api.getState().observations.every(o=>o.minimumProvenATCalls===0)));
});
await run('failed initial detection retries on later frame only and stop clears successful lock',async()=>{
 const f=await fixture({auto:true}),p=f.api.readFrame(1,f.sample());f.finishLayout(false);await p;check('initial failure does not claim a lock',()=>assert.equal(f.api.getState().screenApproved,false));check('initial failure does not start glyph work',()=>assert.equal(f.matches.length,0));await Promise.resolve();check('initial failure does not spin worker requests',()=>assert.equal(f.layout.messages.length,1));await completeLayoutFrame(f);check('later frame can acquire successfully',()=>assert.equal(f.layout.messages.length,2));
 f.$('camera-stop').onclick();await completeLayoutFrame(f);check('stop requires next source acquisition',()=>assert.equal(f.layout.messages.length,3));
});

function acquired(request,{descriptor='map-one',mapIds=[7402,7403]}={}){
 return {kind:'video-map-disambiguation',stamp:structuredClone(request.stamp),candidateSource:{provenance:[{mapIds,text:'TEST MAP',source:'synthetic-font'}]},requestedMapIds:[7402,7403,7404],rankings:[{descriptor,mapIds,registration:{resolved:true,best:{dx:0,dy:0,scale:.5,score:.9},candidates:[{dx:0,dy:0,scale:.5,score:.9}],search:{planComplete:true}},bestScore:.9,imageWidth:256,imageHeight:192,originPixel:[0,0],worldToMapScale:2}],unknown:[{mapId:7404,reason:'unsearched-font-hypotheses'}],descriptorCandidate:true,bestDescriptor:descriptor,bestMapIds:mapIds,mapIdentityResolved:false,allCandidatesEvaluated:false,minimumProvenATCalls:0,reason:'synthetic-acquisition'};
}
function replyMap(f,request,r){f.emit('dq9-map-candidates-result',{requestId:request.requestId,result:r});}
async function acquireRetained(f){const pending=f.api.readFrame(1,f.sample());f.finishRegistration();f.matches.at(-1).resolve(result);await pending;const request=f.requests().at(-1),r=acquired(request);replyMap(f,request,r);return r;}
function trackedResult(request,prior,matched=true){return {...structuredClone(prior),stamp:structuredClone(request.stamp),rankings:matched?structuredClone(prior.rankings):[],descriptorCandidate:false,reason:matched?'retained-image-hypothesis':'retained-image-mismatch-or-uncertain',coordinatesSuspended:!matched,mapIdentityResolved:false,allCandidatesEvaluated:false,tracking:{mode:'single-reference',matched,referenceCount:1,fontCalls:0,acquisitionStamp:structuredClone(prior.stamp)}};}
await run('retained map skips repeated font and multi-map work while timestamps remain fresh',async()=>{
 const f=await fixture(),prior=await acquireRetained(f);const registrationCount=f.position.messages.filter(m=>m.type==='frame').length;
 for(const t of [2,3,4]){f.video.pixel=20+t;const pending=f.api.readFrame(t,{...f.sample(),videoTime:t,mediaTime:t,presentedFrames:t*60});const request=f.requests().at(-1);
  check('only retained descriptor requested',()=>assert.equal(request.mode,'track-current'));check('fresh pixels supplied',()=>assert.equal(request.frame.rgba[0],20+t));check('acquisition is old separate provenance',()=>assert.equal(request.acquisitionStamp.videoTime,1));check('request timestamp is current',()=>assert.equal(request.stamp.videoTime,t));replyMap(f,request,trackedResult(request,prior));await pending;}
 check('font runs once over four frames',()=>assert.equal(f.matches.length,1));check('one acquisition plus three one-image requests',()=>assert.deepEqual(f.requests().map(r=>r.mode||'acquire'),['acquire','track-current','track-current','track-current']));check('manual reference registration not duplicated on tracked frames',()=>assert.equal(f.position.messages.filter(m=>m.type==='frame').length,registrationCount));
 const maps=f.api.getState().observations.filter(o=>o.mapDisambiguation).map(o=>o.mapDisambiguation);check('logged tracking timestamps current',()=>assert.deepEqual(structuredClone(maps.map(o=>o.stamp.videoTime)),[1,2,3,4]));check('aliases survive',()=>assert(maps.every(o=>JSON.stringify(o.bestMapIds)==='[7402,7403]')));check('no unique identity or AT promotion',()=>assert(maps.every(o=>o.mapIdentityResolved===false&&o.minimumProvenATCalls===0)));check('UI distinguishes acquisition time',()=>assert.match(f.$('map-disambiguation').children[0].textContent,/取得 t=1.000秒.*t=4.000秒/));
});
await run('pending retained matching preserves the last completed frame until one atomic replacement',async()=>{
 const f=await fixture(),prior=await acquireRetained(f),host=f.$('map-disambiguation');
 for(const t of [2,3,4]){
  const previous=[...host.children],text=host.textContent,count=host.replacements.length;
  const pending=f.api.readFrame(t,{...f.sample(),videoTime:t}),request=f.requests().at(-1);
  check('pending work leaves every completed result node in place',()=>assert.deepEqual(host.children,previous));
  check('pending work does not rewrite historical result text',()=>assert.equal(host.textContent,text));
  check('completed frame label and prior timestamp remain visible',()=>assert.match(host.children[0].textContent,new RegExp('完了フレームの結果.*t='+String(t-1)+'\\.000秒')));
  check('current position is explicitly unconfirmed during the wait',()=>assert.match(f.$('position-status').textContent,/現在フレーム.*未確定.*前回の完了フレーム/));
  check('current coordinates are not carried forward as fresh evidence',()=>assert.equal(f.api.getState().positionSample,null));
  check('no empty or pending replacement occurs',()=>assert.equal(host.replacements.length,count));
  replyMap(f,request,trackedResult(request,prior));await pending;
  check('successful result performs exactly one complete replacement',()=>assert.equal(host.replacements.length,count+1));
  check('replacement is never an empty result tree',()=>assert(host.replacements.at(-1).length>=4));
  check('replacement has the newly completed frame time',()=>assert.match(host.children[0].textContent,new RegExp('t='+String(t)+'\\.000秒')));
  check('unknown alternatives stay visible after the swap',()=>assert.match(host.textContent,/7404.*unsearched-font-hypotheses/));
 }
 check('only acquisition invoked the font matcher',()=>assert.equal(f.matches.length,1));
});
for(const failure of ['error','timeout'])await run(`retained matching ${failure} clears the historical result before reacquisition`,async()=>{
 const f=await fixture(),prior=await acquireRetained(f),pending=f.api.readFrame(2,{...f.sample(),videoTime:2}),request=f.requests().at(-1),host=f.$('map-disambiguation');
 check('previous complete result stays present during the wait',()=>assert(host.children.length>=4));
 if(failure==='error')f.emit('dq9-map-candidates-result',{type:'map-candidates-error',requestId:request.requestId,stamp:request.stamp,message:'synthetic-worker-error'});
 else await new Promise(resolve=>setTimeout(resolve,2050));
 for(let i=0;i<4;i++)await Promise.resolve();
 check('failed match removes the completed result tree',()=>assert.equal(host.children.length,0));
 check('failed match explicitly suspends result coordinates',()=>assert.match(host.textContent,/保留/));
 check('failed retained image is no longer usable',()=>assert.equal(f.api.getState().retainedMap,null));
 check('same-frame reacquisition starts after failure',()=>assert.equal(f.matches.length,2));
 f.matches.at(-1).resolve(result);await pending;f.api.invalidateSource('test-cleanup');
});
await run('same-name image mismatch reacquires on the current frame without a multi-frame delay',async()=>{
 const f=await fixture(),prior=await acquireRetained(f);f.video.pixel=80;const pending=f.api.readFrame(80,{...f.sample(),videoTime:80});const tracking=f.requests().at(-1);replyMap(f,tracking,trackedResult(tracking,prior,false));for(let i=0;i<4;i++)await Promise.resolve();
 check('mismatch removes the old completed result tree',()=>assert.equal(f.$('map-disambiguation').children.length,0));check('mismatch clears current coordinates immediately',()=>assert.match(f.$('player-coordinates').textContent,/保留/));check('font starts again on that same frame',()=>assert.equal(f.matches.length,2));check('same current pixels enter reacquisition',()=>assert.equal(f.matches[1].image.data[0],80));f.matches[1].resolve(result);await pending;const reacquisition=f.requests().at(-1);check('same frame used for new map candidates',()=>assert.equal(reacquisition.stamp.frameSerial,tracking.stamp.frameSerial));check('fresh all-nominated request follows mismatch',()=>assert.equal(reacquisition.mode,undefined));check('same displayed name can nominate a new image',()=>assert.equal(reacquisition.candidates.names[0],'TESTMAP'));replyMap(f,reacquisition,acquired(reacquisition,{descriptor:'map-two',mapIds:[7404]}));check('new leading image retained',()=>assert.equal(f.api.getState().retainedMap.descriptor,'map-two'));
});
for(const scene of ['black','battle','menu'])await run(`${scene} without a name frame suspends current coordinates without expensive OCR`,async()=>{
 const f=await fixture();await acquireRetained(f);f.setNameDetection({resolved:false,reason:scene+'-name-frame-absent'});await f.api.readFrame(2,{...f.sample(),videoTime:2});
 check('name gate applies even with manual text ROI',()=>assert.equal(f.$('name-roi-mode').value,'manual'));check('no additional font work',()=>assert.equal(f.matches.length,1));check('no additional map work',()=>assert.equal(f.requests().length,1));check('retained hypothesis dropped',()=>assert.equal(f.api.getState().retainedMap,null));check('coordinates suspended',()=>assert.match(f.$('player-coordinates').textContent,/保留|空白/));check('non-map frame clears completed result rows',()=>assert.equal(f.$('map-disambiguation').children.length,0));
});
for(const discontinuity of ['seek','reference','rom-release','cancel','scale','pagehide'])await run(`retained matching ${discontinuity} releases wait and rejects late result`,async()=>{
 const f=await fixture(),prior=await acquireRetained(f),pending=f.api.readFrame(2,{...f.sample(),videoTime:2}),request=f.requests().at(-1);
 if(discontinuity==='pagehide')f.emit('pagehide');if(discontinuity==='seek')f.api.invalidateSource('seek');if(discontinuity==='reference')f.emit('dq9-map-image',null);if(discontinuity==='rom-release')f.emit('dq9-rom-release');if(discontinuity==='cancel')f.$('text-cancel').onclick();if(discontinuity==='scale')f.$('position-scales').onchange();
 await pending;const before=f.api.getState().observations.length;replyMap(f,request,trackedResult(request,prior));check('late tracked result not logged',()=>assert.equal(f.api.getState().observations.length,before));check('current image cleared',()=>assert.equal(f.api.getState().retainedMap,null));check('discontinuity clears completed result rows',()=>assert.equal(f.$('map-disambiguation').children.length,0));check('busy released',()=>assert.equal(f.api.getState().busy,false));check('no unrequested text re-run after cancel',()=>assert.equal(f.matches.length,1));
});
await run('retained reply requires full immutable capture identity',async()=>{
 const f=await fixture(),prior=await acquireRetained(f),pending=f.api.readFrame(2,{...f.sample(),videoTime:2}),request=f.requests().at(-1),bad=trackedResult(request,prior);bad.stamp.mediaTime+=1;replyMap(f,request,bad);check('altered nested provenance does not finish request',()=>assert.equal(f.api.getState().busy,true));replyMap(f,request,trackedResult(request,prior));await pending;check('correct stamp finishes',()=>assert.equal(f.api.getState().busy,false));
});
await run('malformed map reply without stamp is safely ignored',async()=>{const f=await fixture(),prior=await acquireRetained(f),pending=f.api.readFrame(2,{...f.sample(),videoTime:2}),request=f.requests().at(-1);f.emit('dq9-map-candidates-result',{requestId:request.requestId,result:{}});check('malformed reply leaves current request pending',()=>assert.equal(f.api.getState().busy,true));replyMap(f,request,trackedResult(request,prior));await pending;check('valid retry completes current frame',()=>assert.equal(f.api.getState().busy,false));});
await run('released CPU acquisition can track its image without GPU or repeated CPU font work',async()=>{const f=await prepareCPU(),pending=f.$('cpu-text-once').onclick(),{w,message}=readyCPU(f);f.finishRegistration();w.reply({type:'result',id:message.id,romEpoch:message.romEpoch,stamp:structuredClone(message.stamp),result});await pending;const acquisitionRequest=f.requests().at(-1),prior=acquired(acquisitionRequest);replyMap(f,acquisitionRequest,prior);const epoch=f.api.getState().generation,workerCount=f.workers.length;f.video.currentTime=2;f.video.pixel=42;f.$('cpu-text-release').onclick();const request=f.requests().at(-1);check('CPU release preserves acquired reference epoch',()=>assert.equal(f.api.getState().generation,epoch));check('CPU release starts only current-image tracking',()=>assert.equal(request.mode,'track-current'));replyMap(f,request,trackedResult(request,prior));for(let i=0;i<4;i++)await Promise.resolve();check('no second font Worker needed for tracking',()=>assert.equal(f.workers.length,workerCount));check('GPU remains explicitly unavailable',()=>assert.equal(f.api.getState().gpuUnavailable,true));check('tracking captured fresh media time',()=>assert.equal(request.stamp.videoTime,2));check('CPU hold released',()=>assert.equal(f.api.getState().cpuHeld,false));});

function clockFixture(){
 const callbacks=new Map(),frames=[],gaps=[];let next=0;const handlers={};
 const video={currentTime:400,readyState:2,seeking:false,paused:true,addEventListener(n,f){handlers[n]=f},emit(n){handlers[n]?.()},requestVideoFrameCallback(f){const id=++next;callbacks.set(id,f);return id},cancelVideoFrameCallback(id){callbacks.delete(id)},pause(){this.paused=true;this.emit('pause')},removeAttribute(){},load(){}};
 const input=new imported['./file-video-input.mjs'].FileVideoInput(video,(_t,frame)=>frames.push(frame),e=>{throw e},(reason,frame)=>gaps.push({reason,frame}));Object.assign(input,{url:'blob:clock-fixture',sourceId:'clock-source',generation:7,segment:2});
 return {video,input,frames,gaps,callbacks};
}
await run('fallback currentTime400 and decoded PTS399.996 keep one source epoch',async()=>{
 const f=clockFixture();f.video.emit('seeked');f.video.currentTime=400.02;f.input.capture({mediaTime:399.996,presentedFrames:12});
 check('clock switch does not create a discontinuity',()=>assert.equal(f.gaps.length,0));check('both clocks preserve source epoch',()=>assert.deepEqual(f.frames.map(x=>x.sourceEpoch),[7,7]));check('both clocks preserve segment',()=>assert.deepEqual(f.frames.map(x=>x.timelineSegment),[2,2]));check('timestamps remain true to each source',()=>assert.deepEqual(f.frames.map(x=>x.videoTime),[400,399.996]));check('clock provenance stays explicit',()=>assert.deepEqual(f.frames.map(x=>x.timestampBasis),['HTMLMediaElement.currentTime','requestVideoFrameCallback.mediaTime']));check('presentation counter preserved',()=>assert.equal(f.frames.at(-1).presentedFrames,12));
 f.input.capture({mediaTime:399.996,presentedFrames:13});f.input.capture({mediaTime:400.2,presentedFrames:14});check('duplicate and subinterval precise frames remain throttled',()=>assert.equal(f.frames.length,2));f.input.capture({mediaTime:400.496,presentedFrames:15});check('next interval can capture without a new epoch',()=>assert.deepEqual(f.frames.at(-1).sourceEpoch,7));
});
await run('same-basis regressions still invalidate across an intervening other clock',async()=>{
 const precise=clockFixture();precise.input.capture({mediaTime:400});precise.video.currentTime=400.1;precise.input.capture();precise.input.capture({mediaTime:399.5});check('decoded clock regression creates backward gap',()=>assert.equal(precise.gaps.at(-1).reason,'backward-time'));check('decoded regression advances epoch and segment',()=>assert.deepEqual([precise.input.generation,precise.input.segment],[8,3]));check('new sample uses updated provenance',()=>assert.deepEqual([precise.frames.at(-1).sourceEpoch,precise.frames.at(-1).timelineSegment],[8,3]));
 const fallback=clockFixture();fallback.input.capture();fallback.input.capture({mediaTime:399.996});fallback.video.currentTime=399.9;fallback.input.capture();check('fallback clock regression also creates a gap',()=>assert.equal(fallback.gaps.at(-1).reason,'backward-time'));check('fallback regression advances epoch',()=>assert.equal(fallback.input.generation,8));
});
await run('actual seek resets both clock histories and still invalidates',async()=>{
 const f=clockFixture();f.input.capture();f.input.capture({mediaTime:399.996});f.video.seeking=true;f.video.emit('seeking');check('seek advances source epoch',()=>assert.equal(f.input.generation,8));check('seek is an explicit discontinuity',()=>assert.equal(f.gaps.at(-1).reason,'seek'));f.video.currentTime=10;f.video.seeking=false;f.video.emit('seeked');f.input.capture({mediaTime:9.996});check('seeked clock histories do not invent a second gap',()=>assert.equal(f.gaps.length,1));check('new clock values use the new segment',()=>assert.deepEqual(f.frames.slice(-2).map(x=>x.timelineSegment),[3,3]));f.input.stop();check('stop clears clock histories',()=>assert.deepEqual(f.input.clockTimes,{currentTime:null,mediaTime:null}));check('stop clears last clock',()=>assert.equal(f.input.lastClock,null));
});
await run('invalid precise metadata consistently falls back and nonfinite clocks are skipped',async()=>{
 const f=clockFixture();f.input.capture({mediaTime:NaN,presentedFrames:1});check('invalid metadata uses fallback timestamp',()=>assert.deepEqual([f.frames[0].videoTime,f.frames[0].timestampBasis],[400,'HTMLMediaElement.currentTime']));f.video.currentTime=NaN;f.input.capture({mediaTime:NaN});check('nonfinite fallback cannot corrupt history',()=>assert.equal(f.frames.length,1));check('invalid clocks do not invent a gap',()=>assert.equal(f.gaps.length,0));
});
await run('CPU acquisition survives real FileVideoInput play callbacks with an earlier decoded PTS',async()=>{
 const f=await prepareCPU(),file=f.api.getFile();f.video.currentTime=400;file.capture();const pending=f.$('cpu-text-once').onclick(),{w,message}=readyCPU(f);f.finishRegistration();w.reply({type:'result',id:message.id,romEpoch:message.romEpoch,stamp:structuredClone(message.stamp),result});await pending;const acquisition=f.requests().at(-1),prior=acquired(acquisition);replyMap(f,acquisition,prior);const epoch=f.api.getState().generation,sourceEpoch=file.generation;
 f.$('cpu-text-release').onclick();let request=f.requests().at(-1);replyMap(f,request,trackedResult(request,prior));for(let i=0;i<4;i++)await Promise.resolve();
 await f.$('file-play').onclick();f.video.currentTime=400.02;f.video.pixel=63;const before=f.requests().length;f.video.frameCallback(1,{mediaTime:399.996,presentedFrames:150});request=f.requests().at(-1);
 check('real playback callback requests a fresh retained match',()=>assert.equal(f.requests().length,before+1));check('playback still uses only the retained map',()=>assert.equal(request.mode,'track-current'));check('clock switch preserves panel generation',()=>assert.equal(f.api.getState().generation,epoch));check('clock switch preserves source epoch',()=>assert.equal(file.generation,sourceEpoch));check('decoded PTS is not rounded to acquisition time',()=>assert.equal(request.stamp.videoTime,399.996));check('decoded clock provenance survives the shared stamp',()=>assert.equal(request.stamp.timestampBasis,'requestVideoFrameCallback.mediaTime'));check('paused acquisition time stays historical',()=>assert.equal(request.acquisitionStamp.videoTime,400));check('playback reads fresh pixels',()=>assert.equal(request.frame.rgba[0],63));replyMap(f,request,trackedResult(request,prior));for(let i=0;i<4;i++)await Promise.resolve();
 f.video.currentTime=400.6;f.video.frameCallback(2,{mediaTime:400.596,presentedFrames:168});request=f.requests().at(-1);check('later playback remains retained-image tracking',()=>assert.equal(request.mode,'track-current'));replyMap(f,request,trackedResult(request,prior));for(let i=0;i<4;i++)await Promise.resolve();f.$('file-pause').onclick();check('pause preserves retained image',()=>assert.equal(f.api.getState().retainedMap.descriptor,prior.bestDescriptor));check('continuous path adds no font call',()=>assert.equal(f.matches.length,1));
 file.capture({mediaTime:399,presentedFrames:169});check('true same-basis regression still drops retained image',()=>assert.equal(f.api.getState().retainedMap,null));check('true regression increments source epoch',()=>assert.equal(file.generation,sourceEpoch+1));check('true regression remains an explicit observation gap',()=>assert(f.api.getState().observations.some(o=>o.reason==='backward-time')));
});
const summary={passed:cases.every(c=>c.passed),checks,cases,scope:'Node fake DOM/canvas/Worker control-flow test; real capture coordinator and input adapters; synthetic pixels and deferred OCR/layout; no browser/WebGPU/video-decoder accuracy claim'};
console.log(JSON.stringify(summary,null,2));if(!summary.passed)process.exitCode=1;
