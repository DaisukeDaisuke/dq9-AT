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
 const elements=new Map(),windows=new Map(),events=[],workers=[],captures=[],names=[],markerPixels=[],matches=[];
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.value='';this.checked=false;this.width=256;this.height=192;this.pixel=0;this.currentTime=1;this.videoWidth=256;this.videoHeight=192;this.readyState=2;this.paused=true;this.seeking=false;this.duration=100;}
  set innerHTML(html){for(const m of html.matchAll(/<([a-z0-9]+)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){const e=new Element(m[1]);e.id=m[3];e.value=m[2].match(/\bvalue="([^"]*)"/)?.[1]??'';e.checked=/\bchecked\b/.test(m[2]);elements.set(e.id,e);}}
  getContext(){if(this.ctx)return this.ctx;const canvas=this;this.ctx=new Proxy({drawImage(input){canvas.pixel=input.pixel;},getImageData(_x,_y,w,h){const data=new Uint8ClampedArray(w*h*4);data.fill(canvas.pixel);return {width:w,height:h,data};},putImageData(image){canvas.pixel=image.data[0];}}, {get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});return this.ctx;}
  addEventListener(n,fn){(this.listeners[n]??=[]).push(fn);}emit(n){for(const fn of this.listeners[n]||[])fn();}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}add(x){this.append(x);}
  pause(){this.paused=true;this.emit('pause');}load(){}removeAttribute(n){delete this[n];}requestVideoFrameCallback(){return 1;}cancelVideoFrameCallback(){}
 }
 class FakeWorker{constructor(url){this.url=String(url);this.messages=[];workers.push(this);}postMessage(m){this.messages.push(structuredClone(m));}terminate(){}reply(m){this.onmessage?.({data:m});}}
 class Coordinator extends imported['./player-capture.mjs'].PlayerCaptureCoordinator{
  capture(args){captures.push(args);return super.capture(args);}name(token,observation){if(observation)names.push(observation);return super.name(token,observation);}
 }
 const match={route:'glyph-akinator',match(image){const pending=deferred();matches.push({image, ...pending});return pending.promise;},cancel(){},destroy(){}};
 const document={createElement:tag=>new Element(tag),getElementById:id=>elements.get(id),querySelector:()=>new Element(),fonts:{add(){},delete(){}}};
 const window={addEventListener(n,fn){if(!windows.has(n))windows.set(n,[]);windows.get(n).push(fn);},dispatchEvent(e){events.push(e);for(const fn of windows.get(e.type)||[])fn(e);}};
 const sandbox={document,window,Worker:FakeWorker,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},localStorage:{getItem(){return null;},setItem(){}},navigator:{mediaDevices:{enumerateDevices:async()=>[]}},URL,Blob,Date,performance,structuredClone,Uint8ClampedArray,console,setTimeout,queueMicrotask,testMatcher:match};
 const context=vm.createContext(sandbox);
 const module=new vm.SourceTextModule(source+`\nexport const captureTest={readFrame,invalidateSource,setup(){matcher=testMatcher;records=[{mapId:7402,name:'TEST MAP'}];positionReady=true;positionHasReference=true;},getFile:()=>fileInput,getCamera:()=>camera,getState:()=>({generation,romEpoch,positionEpoch,frameSerial,busy,pendingRead,observations,positionSample,mapCandidatePending})};`,{context,identifier:pathToFileURL(panel).href,initializeImportMeta(meta){meta.url=pathToFileURL(panel).href;}});
 await module.link(spec=>{
  let exports=imported[spec];
  if(spec==='./player-capture.mjs')exports={PlayerCaptureCoordinator:Coordinator};
  if(spec==='./map-name-match.mjs')exports={createTextMatcher:()=>match};
  if(spec==='./map-name-roi.mjs')exports={detectMapNameROI:()=>({resolved:true,roi:{x:0,y:0,w:1,h:.1}})};
  if(spec==='./party-marker-calibration.mjs')exports={calibratedPartyMarkerCandidates:image=>{markerPixels.push(image.rgba[0]);return {frame:{width:256,height:192},candidates:[],calibration:{profiles:[{slot:1,rgb:[66,66,66]}],status:'test'}};}};
  return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context});
 });
 await module.evaluate();
 const api=module.namespace.captureTest;api.setup();
 const $=id=>elements.get(id),video=$('camera-video');video.pixel=17;
 $('screen-mode').value=auto?'auto':'manual';$('name-roi-mode').value='manual';$('player-marker-mode').value='hud';$('player-enabled').checked=track;$('position-enabled').checked=registration;$('position-scales').value='.5';$('text-scales').value='1';$('text-char-count').value='16';$('text-budget').value='1500';$('player-tolerance').value='12';
 const emit=(type,detail)=>window.dispatchEvent({type,detail});
 const requests=()=>events.filter(e=>e.type==='dq9-map-candidates-request').map(e=>e.detail);
 const sample=()=>({sourceKind:'local-file',sourceId:'fixture-A',sourceEpoch:7,timelineSegment:2,videoTime:1,mediaTime:1,timestampBasis:'requestVideoFrameCallback.mediaTime',presentedFrames:60,absoluteFrameIndex:null,capturedAt:'2026-09-30T00:00:00.000Z'});
 const position=workers.find(w=>w.url.includes('position-worker')),layout=workers.find(w=>w.url.includes('ds-screen-worker'));
 const finishRegistration=()=>{const m=position.messages.findLast(m=>m.type==='frame');if(m)position.reply({type:'frame',epoch:m.epoch,frameSerial:m.frameSerial,ok:true,result:{kind:'video-map-registration',resolved:false,candidates:[],reason:'synthetic'}});};
 const finishLayout=()=>{const m=layout.messages.at(-1);layout.reply({id:m.id,result:{resolved:true,analysisSize:{width:256,height:192},candidates:[{x:0,y:0,w:256,h:192,score:1}]}});};
 return {api,$,video,events,captures,names,markerPixels,matches,emit,requests,sample,position,layout,finishRegistration,finishLayout};
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
 check('queued new OCR starts',()=>assert.equal(f.matches.length,2));check('old completion leaves newer work busy',()=>assert.equal(f.api.getState().busy,true));check('old completion leaves current frame identity',()=>assert.equal(f.api.getState().frameSerial,2));f.finishRegistration();f.matches[1].resolve(result);for(let i=0;i<4;i++)await Promise.resolve();
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
const summary={passed:cases.every(c=>c.passed),checks,cases,scope:'Node fake DOM/canvas/Worker control-flow test; real capture coordinator and input adapters; synthetic pixels and deferred OCR/layout; no browser/WebGPU/video-decoder accuracy claim'};
console.log(JSON.stringify(summary,null,2));if(!summary.passed)process.exitCode=1;
