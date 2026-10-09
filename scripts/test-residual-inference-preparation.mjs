import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {classificationNow,classificationDuration,classificationClock} from '../web/monster-classification-timing.mjs';
import {createHash,webcrypto} from 'node:crypto';
import {mountResidualInferencePreparation} from '../web/map-browser-preview/residual-inference-preparation.mjs';
import {INFERENCE_ASSETS,INFERENCE_CACHE_NAME,inferenceProfile,createInferenceAssetCache} from '../web/monster-inference-assets.mjs';
import {createDinoFeatureBackend} from '../web/monster-dinov2.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=a=>{assert(a);checks++;},matches=(s,p)=>{assert.match(s,p);checks++;};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
class Node {
 constructor(tag='span'){this.tag=tag;this.listeners=new Map();this.attributes=new Map();this.children=[];this.disabled=false;this.hidden=false;this.value='';}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 fire(type){for(const fn of this.listeners.get(type)??[])fn({target:this});}
 setAttribute(k,v){this.attributes.set(k,v);}
 removeAttribute(k){this.attributes.delete(k);}
 append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;}
 closest(){return this.label??null;}
 after(node){this.parent.append(node);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
function mount(deps={},{label=true,missing=false}={}){
 const body=new Node(),window=new Node(),inputs={};
 for(const id of ['residual-inference-backend','rom','comparison-file','comparison-layout']){const n=new Node();n.id=id;inputs[id]=n;body.append(n);}
 if(label){const n=new Node('label');body.append(n);inputs['residual-inference-backend'].label=n;}
 inputs['residual-inference-backend'].value='wasm';
 const all=()=>{const out=[];const visit=n=>{out.push(n);n.children.forEach(visit);};visit(body);return out;};
 const document={createElement:tag=>new Node(tag),getElementById:id=>missing&&id==='residual-inference-backend'?null:all().find(n=>n.id===id)??null};
 const calls=[],probes=[];
 const options={ensure:async o=>{calls.push(o);},probe:async o=>{probes.push(o);},...deps};
 const api=mountResidualInferencePreparation(document,window,options),find=id=>document.getElementById(id);
 return{document,window,body,inputs,api,options,calls,probes,find,cpu:find('prepare-residual-cpu-assets'),gpu:find('prepare-residual-gpu-assets'),cancel:find('cancel-residual-gpu-assets'),progress:find('residual-gpu-assets-progress'),status:find('residual-gpu-assets-status')};
}
// Mount and ordinary backend/input events never acquire either profile.
const initial=mount();eq(initial.calls.length,0);eq(initial.probes.length,0);eq(initial.progress.hidden,true);eq(initial.cancel.disabled,true);
matches(initial.cpu.textContent,/34\.7 MiB/);matches(initial.gpu.textContent,/66\.8 MiB/);matches(initial.status.textContent,/Hugging Face/);matches(initial.status.textContent,/jsDelivr/);matches(initial.status.textContent,/SHA-256/);matches(initial.status.textContent,/4ファイル/);
eq(mountResidualInferencePreparation(initial.document,initial.window,initial.options),initial.api);eq(initial.body.children.filter(n=>n.id==='residual-gpu-preparation').length,1);
for(const n of Object.values(initial.inputs))n.fire('change');initial.window.fire('pagehide');eq(initial.calls.length,0);eq(initial.probes.length,0);
eq(mount({}, {missing:true}).api,null);ok(mount({}, {label:false}).cpu);
// Both explicit buttons choose only their own profile; neither changes selection.
for(const backend of ['wasm','webgpu']){
 const f=mount();f.inputs['residual-inference-backend'].value='cached-webgpu';
 f[backend==='wasm'?'cpu':'gpu'].fire('click');await settle();eq(f.calls.map(c=>c.backend),[backend]);eq(f.probes.length,backend==='webgpu'?1:0);eq(f.inputs['residual-inference-backend'].value,'cached-webgpu');
 eq(f.progress.max,inferenceProfile(backend).totalBytes);eq(f.progress.value,inferenceProfile(backend).totalBytes);eq(f.progress.attributes.get('aria-label'),`${backend==='wasm'?'CPU':'GPU'}用ファイルの準備進捗`);eq(f.cpu.disabled,false);eq(f.gpu.disabled,false);eq(f.cancel.disabled,true);
 matches(f.status.textContent,/検証して保存/);matches(f.status.textContent,/自動変更していません/);
}
// GPU retains the mandatory feature probe. CPU never probes even on unsupported GPUs.
const noGPU=mount({probe:async()=>{throw Error('shader-f16 unavailable');}});eq(await noGPU.api.prepare(),false);eq(noGPU.calls.length,0);matches(noGPU.status.textContent,/shader-f16 unavailable/);eq(await noGPU.api.prepareCPU(),true);eq(noGPU.calls.map(c=>c.backend),['wasm']);
const probeWait=deferred();let probeSignal;const probing=mount({probe:({signal})=>{probeSignal=signal;return probeWait.promise;}});const oldProbe=probing.api.prepare();probing.cancel.fire('click');ok(probeSignal.aborted);eq(await probing.api.prepareCPU(),true);const cpuDone=probing.status.textContent;probeWait.resolve();eq(await oldProbe,false);eq(probing.status.textContent,cpuDone);eq(probing.calls.map(c=>c.backend),['wasm']);
// Double clicks and API calls do not overlap CPU/GPU downloads.
for(const backend of ['wasm','webgpu']){
 const wait=deferred();let active;const f=mount({ensure:o=>{active=o;return wait.promise;}}),pending=f.api.prepare(backend);await settle();
 ok(f.cpu.disabled);ok(f.gpu.disabled);eq(f.cancel.disabled,false);f.cpu.fire('click');f.gpu.fire('click');eq(await f.api.prepareCPU(),false);eq(await f.api.prepare(),false);
 active.onProgress({message:'fixture progress',loadedBytes:1024*1024,totalBytes:2*1024*1024});eq(f.progress.max,2*1024*1024);eq(f.progress.value,1024*1024);matches(f.status.textContent,/1\.0 \/ 2\.0 MiB/);
 active.onProgress({phase:'service-worker'});eq(f.progress.max,inferenceProfile(backend).totalBytes);eq(f.progress.value,0);
 active.onProgress({loadedBytes:100,totalBytes:10});eq(f.progress.value,10);active.onProgress({loadedBytes:-1,totalBytes:10});eq(f.progress.value,0);
 wait.resolve();eq(await pending,true);eq(f.cpu.disabled,false);eq(f.gpu.disabled,false);
}
// Every existing input/backend/page lifecycle cancellation protects a newer run
// against late progress, success and rejection from the old request.
const reasons=['button','rom','comparison-file','comparison-layout','residual-inference-backend','pagehide','api'];
for(const backend of ['wasm','webgpu'])for(const reason of reasons)for(const failure of [false,true]){
 const first=deferred(),second=deferred(),calls=[];
 const f=mount({ensure:o=>{calls.push(o);return calls.length===1?first.promise:second.promise;}});
 const pending=f.api.prepare(backend);await settle();eq(calls.length,1);eq(calls[0].backend,backend);
 if(reason==='button')f.cancel.fire('click');else if(reason==='pagehide')f.window.fire('pagehide');else if(reason==='api')f.api.cancel();else f.inputs[reason].fire('change');
 ok(calls[0].signal.aborted);eq(f.progress.hidden,true);eq(f.cpu.disabled,false);eq(f.gpu.disabled,false);eq(f.cancel.disabled,true);const cancelled=f.status.textContent;
 calls[0].onProgress({message:'stale-before-retry',loadedBytes:1,totalBytes:2});eq(f.status.textContent,cancelled);
 const retry=f.api.prepareCPU();await settle();eq(calls.length,2);eq(calls[1].backend,'wasm');calls[1].onProgress({message:'new CPU request',loadedBytes:1,totalBytes:2});const retryStatus=f.status.textContent;
 calls[0].onProgress({message:'stale-after-retry',loadedBytes:2,totalBytes:2});failure?first.reject(Error('stale rejection')):first.resolve();eq(await pending,false);eq(f.status.textContent,retryStatus);ok(f.cpu.disabled);ok(f.gpu.disabled);eq(f.cancel.disabled,false);
 second.resolve();eq(await retry,true);eq(f.progress.value,inferenceProfile('wasm').totalBytes);eq(f.cpu.disabled,false);eq(f.gpu.disabled,false);
}
// Current failures remain visible and retryable, with no automatic backend change.
for(const backend of ['wasm','webgpu']){
 let attempts=0;const f=mount({ensure:async()=>{if(++attempts===1)throw Error('推論用ファイルの準備が必要です');}});
 eq(await f.api.prepare(backend),false);matches(f.status.textContent,new RegExp(`${backend==='wasm'?'CPU':'GPU'}用ファイルを準備できません`));matches(f.status.textContent,/再試行/);eq(f.cpu.disabled,false);eq(f.gpu.disabled,false);eq(await f.api.prepare(backend),true);eq(attempts,2);eq(f.inputs['residual-inference-backend'].value,'wasm');
}
// Dispose cancels, removes all controls/listeners, suppresses late publication,
// and permits a fresh mount without duplicate handlers.
const disposalWait=deferred();let disposalSignal;const disposal=mount({ensure:({signal})=>{disposalSignal=signal;return disposalWait.promise;}});const disposalRun=disposal.api.prepareCPU();disposal.api.dispose();disposal.api.dispose();ok(disposalSignal.aborted);eq(disposal.find('prepare-residual-cpu-assets'),null);eq(await disposal.api.prepareCPU(),false);for(const node of [...Object.values(disposal.inputs),disposal.window,disposal.cpu,disposal.gpu,disposal.cancel])eq([...node.listeners.values()].reduce((n,s)=>n+s.size,0),0);disposalWait.resolve();eq(await disposalRun,false);ok(mountResidualInferencePreparation(disposal.document,disposal.window,{ensure:async()=>{},probe:async()=>{}})!==disposal.api);
// Exercise the real cache, actual DINO initialization and actual worker getDino
// state machine with synthetic bytes/session output. This is a retry-control
// test, not a browser/real-model or classification-accuracy claim.
const fixtureBytes=new Map(INFERENCE_ASSETS.map(a=>[a.id,new TextEncoder().encode(`fixture ${a.id}`)]));
const assets=INFERENCE_ASSETS.map(a=>({...a,bytes:fixtureBytes.get(a.id).length,sha256:createHash('sha256').update(fixtureBytes.get(a.id)).digest('hex')}));
const key=r=>typeof r==='string'?r:r.url;
class MemoryCache {constructor(){this.items=new Map();}async match(r){return this.items.get(key(r))?.clone();}async put(r,v){this.items.set(key(r),v.clone());}async delete(r){return this.items.delete(key(r));}async keys(){return [...this.items.keys()].map(u=>new Request(u));}}
const cache=new MemoryCache(),downloads=[];const cacheStorage={open:async()=>cache,keys:async()=>[INFERENCE_CACHE_NAME]};
const store=createInferenceAssetCache({assets,cacheStorage,cryptoImpl:webcrypto,fetcher:async url=>{downloads.push(url);return new Response(fixtureBytes.get(assets.find(a=>a.url===url).id));}});
let inits=0,runs=0,disposed=0;
const ort={env:{versions:{web:'1.23.2'},wasm:{}},Tensor:class{dispose(){}},InferenceSession:{create:async()=>({run:async()=>{runs++;const data=new Float32Array(257*384);data[0]=1;return{last_hidden_state:{dims:[1,257,384],data,dispose(){}}};},release:async()=>{disposed++;}})}};
const createBackend=options=>{inits++;return createDinoFeatureBackend({...options,loadRuntime:async(signal,backend)=>{eq(backend,'wasm');for(const id of ['runtime-entry','runtime-mjs','runtime-wasm'])await store.read(id,{signal});return{ort,mjsURL:'synthetic:',wasmBinary:new Uint8Array(1),dispose(){}};},readModel:()=>store.read('model',{signal:options.signal})});};
const posts=[],fixtureState={romEpoch:1,renderedReferenceCache:{clear(){}}};
const workerURL=new URL('../web/monster-recognition-worker.mjs?v=ordinary-turn-20261009-e76d366f',import.meta.url);
const workerSource=(await readFile(workerURL,'utf8')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(workerURL.href));
const context=vm.createContext({classificationNow,classificationDuration,classificationClock,self:{postMessage:m=>posts.push(m)},AbortController,DOMException,performance,createDinoFeatureBackend:createBackend,fixtureState,recognizeROI:async(m,{getDino})=>{const dino=await getDino({backend:m.inferenceBackend});const vector=await dino.encode({width:1,height:1,rgba:new Uint8ClampedArray([20,30,40,255])});return{syntheticOnly:true,vectorLength:vector.length,backend:dino.spec.backend};}});
vm.runInContext(workerSource+'\nstate=fixtureState;',context,{filename:workerURL.pathname});
await context.self.onmessage({data:{type:'recognize',id:'cold',romEpoch:1,inferenceBackend:'wasm'}});eq(posts.at(-1).type,'error');eq(posts.at(-1).error.stage,'wasm-init');matches(posts.at(-1).message,/推論用ファイルの準備が必要です/);eq(inits,1);eq(runs,0);eq(downloads.length,0);eq(fixtureState.dino,null);
const prepared=mount({ensure:store.ensure,probe:()=>{throw Error('CPU must not probe GPU');}});eq(await prepared.api.prepareCPU(),true);eq(downloads,assets.slice(0,4).map(a=>a.url));
await context.self.onmessage({data:{type:'recognize',id:'retry',romEpoch:1,inferenceBackend:'wasm'}});eq(posts.at(-1).type,'result');eq(posts.at(-1).id,'retry');eq(posts.at(-1).result.vectorLength,384);eq(inits,2);eq(runs,1);eq(downloads.length,4);ok(fixtureState.dino);
await context.self.onmessage({data:{type:'recognize',id:'cached-session',romEpoch:1,inferenceBackend:'wasm'}});eq(posts.at(-1).type,'result');eq(inits,2);eq(runs,2);eq(await prepared.api.prepareCPU(),true);eq(downloads.length,4);await fixtureState.dino.dispose();eq(disposed,1);
console.log(JSON.stringify({passed:true,checks,syntheticOnly:true,mountedDOM:true,actualWorkerRetry:true,actualCacheVerification:true,remoteDownloads:0,realModelInference:false,browserVerified:false},null,2));
