import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {INFERENCE_ASSETS,INFERENCE_CACHE_NAME,INFERENCE_CACHE_PREFIX,INFERENCE_CACHE_LIMIT,INFERENCE_RUNTIME,createInferenceAssetCache,inferenceAssetForRequest,inferenceProfile,ensureInferenceAssets} from '../web/monster-inference-assets.mjs';

let checks=0;const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const rejects=async(work,matcher)=>{await assert.rejects(work,matcher);checks++;};
const fixtures=new Map(INFERENCE_ASSETS.map(asset=>[asset.id,new TextEncoder().encode(('synthetic verified inference fixture: '+asset.id).padEnd(96,'.'))]));
const assets=INFERENCE_ASSETS.map(asset=>({...asset,bytes:fixtures.get(asset.id).length,sha256:createHash('sha256').update(fixtures.get(asset.id)).digest('hex')}));
const cpuAssets=assets.slice(0,4),gpuAssets=assets.slice(4);
const keyFor=request=>typeof request==='string'?request:request.url;
class MemoryCache {
 constructor(){this.items=new Map();this.puts=0;}
 async match(request){return this.items.get(keyFor(request))?.clone();}
 async put(request,response){this.puts++;this.items.set(keyFor(request),response.clone());}
 async delete(request){return this.items.delete(keyFor(request));}
 async keys(){return [...this.items.keys()].map(url=>new Request(url));}
}
class MemoryCacheStorage {
 constructor(){this.items=new Map();}
 async open(name){if(!this.items.has(name))this.items.set(name,new MemoryCache());return this.items.get(name);}
 async keys(){return [...this.items.keys()];}
 async delete(name){return this.items.delete(name);}
}
function setup(fetchOverride){
 const cacheStorage=new MemoryCacheStorage(),calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return fetchOverride?fetchOverride(url,options):new Response(fixtures.get(assets.find(a=>a.url===url).id));};
 const store=createInferenceAssetCache({assets,cacheStorage,fetcher,cryptoImpl:webcrypto});return {store,cacheStorage,calls};
}
eq(INFERENCE_ASSETS.length,8);eq(INFERENCE_ASSETS.every(a=>Object.isFrozen(a)&&a.sha256.length===64),true);
eq(INFERENCE_ASSETS.reduce((sum,a)=>sum+a.bytes,0)<INFERENCE_CACHE_LIMIT,true);
eq(INFERENCE_ASSETS.reduce((sum,a)=>sum+a.bytes,0),106472759);eq(INFERENCE_CACHE_LIMIT,128*1024*1024);
eq(INFERENCE_CACHE_NAME.includes('v2-'),true);
eq(INFERENCE_RUNTIME.entry.endsWith('/onnxruntime-web@1.23.2/dist/ort.wasm.min.mjs'),true);
eq(INFERENCE_ASSETS[0].url.includes('/resolve/c2bb04a51fab207c420665f1946016107bffc701/'),true);
eq(inferenceProfile(),inferenceProfile('wasm'));
eq(inferenceProfile('wasm').assetIds,cpuAssets.map(a=>a.id));eq(inferenceProfile('wasm').totalBytes,36427661);
eq(inferenceProfile('webgpu').assetIds,gpuAssets.map(a=>a.id));eq(inferenceProfile('webgpu').totalBytes,70045098);
eq(INFERENCE_ASSETS[6].url.endsWith('/ort-wasm-simd-threaded.asyncify.mjs'),true);eq(INFERENCE_ASSETS[7].url.endsWith('/ort-wasm-simd-threaded.asyncify.wasm'),true);
eq(INFERENCE_ASSETS.some(a=>a.url.includes('.jsep.')),false);
eq(inferenceProfile('webgpu').modelId,'model-fp16');eq(inferenceProfile('webgpu').runtimeIds,{entry:'gpu-runtime-entry',mjs:'gpu-runtime-mjs',wasm:'gpu-runtime-wasm'});
eq(Object.isFrozen(inferenceProfile('webgpu'))&&Object.isFrozen(inferenceProfile('webgpu').assetIds)&&Object.isFrozen(inferenceProfile('webgpu').runtimeIds),true);
for(const backend of ['auto','WebGPU','__proto__',null,{},1]){assert.throws(()=>inferenceProfile(backend),/バックエンド/);checks++;}
const invalid=setup();await rejects(()=>invalid.store.ensure({backend:'auto'}),/バックエンド/);eq(invalid.calls.length,0);eq(invalid.cacheStorage.items.size,0);

// First setup downloads only the pinned manifest; later setup/read is offline.
const happy=setup(),progress=[];const info=await happy.store.ensure({onProgress:p=>progress.push(p)});
eq(info.cacheName,INFERENCE_CACHE_NAME);eq(happy.calls.map(c=>c.url),cpuAssets.map(a=>a.url));eq(info.backend,'wasm');eq(info.modelId,'model');
eq(happy.calls.every(c=>c.options.method==='GET'&&c.options.mode==='cors'&&c.options.credentials==='omit'&&c.options.cache==='no-store'),true);
eq(progress.at(-1).loadedBytes,info.totalBytes);eq(await happy.store.read('model'),fixtures.get('model'));
await happy.store.ensure();eq(happy.calls.length,4);eq((await happy.cacheStorage.open(INFERENCE_CACHE_NAME)).puts,4);
await rejects(()=>happy.store.read('https://example.com/private'),/許可/);

// Selecting GPU first downloads only its four assets. Switching profiles fills
// the missing profile, retains the first, then both work without a download.
const gpuFirst=setup(),gpuProgress=[];const gpuInfo=await gpuFirst.store.ensure({backend:'webgpu',onProgress:p=>gpuProgress.push(p)});
eq(gpuFirst.calls.map(c=>c.url),gpuAssets.map(a=>a.url));eq(gpuInfo.totalBytes,4*96);eq(gpuInfo.modelId,'model-fp16');eq(gpuInfo.runtimeIds,inferenceProfile('webgpu').runtimeIds);
eq(gpuProgress.every(p=>p.backend==='webgpu'&&p.totalAssets===4&&p.totalBytes===4*96),true);eq(gpuProgress.at(-1).loadedBytes,gpuInfo.totalBytes);
await rejects(()=>gpuFirst.store.read('model'),/準備/);eq(await gpuFirst.store.read('model-fp16'),fixtures.get('model-fp16'));
await gpuFirst.store.ensure();eq(gpuFirst.calls.map(c=>c.url),[...gpuAssets,...cpuAssets].map(a=>a.url));
await gpuFirst.store.ensure({backend:'webgpu'});await gpuFirst.store.ensure();eq(gpuFirst.calls.length,8);
eq((await (await gpuFirst.cacheStorage.open(INFERENCE_CACHE_NAME)).keys()).map(r=>r.url).sort(),assets.map(a=>a.url).sort());
await happy.store.ensure({backend:'webgpu'});eq(happy.calls.length,8);

// Version pruning cannot delete another feature's cache, and never caches HTML.
await happy.cacheStorage.open(INFERENCE_CACHE_PREFIX+'old-version');
const unrelated=await happy.cacheStorage.open('unrelated-app');await unrelated.put('https://example.test/index.html',new Response('keep'));
const owned=await happy.cacheStorage.open(INFERENCE_CACHE_NAME);await owned.put('https://example.test/index.html',new Response('remove'));
await happy.store.ensure();eq((await happy.cacheStorage.keys()).sort(),[INFERENCE_CACHE_NAME,'unrelated-app'].sort());
eq(await unrelated.match('https://example.test/index.html').then(r=>r.text()),'keep');eq(await owned.match('https://example.test/index.html'),undefined);
eq((await owned.keys()).map(r=>r.url).sort(),assets.map(a=>a.url).sort());

// A corrupt owned entry is evicted and downloaded once; bad downloads stay out.
const corrupt=fixtures.get('model').slice();corrupt[0]^=1;await owned.put(assets[0].url,new Response(corrupt));
const before=happy.calls.length;await happy.store.ensure();eq(happy.calls.length-before,1);eq(await happy.store.read('model'),fixtures.get('model'));
await owned.put(assets[0].url,new Response(corrupt));await rejects(()=>happy.store.read('model'),/SHA-256/);eq(await owned.match(assets[0].url),undefined);
for(const kind of ['digest','short','long','opaque','http','network']){
 const broken=setup(()=>{
  if(kind==='network')throw Error('synthetic offline');
  if(kind==='http')return new Response('bad',{status:503});
  if(kind==='opaque')return {ok:true,type:'opaque'};
  return new Response(kind==='digest'?corrupt:kind==='short'?corrupt.subarray(1):new Uint8Array(corrupt.length+1));
 });
 await rejects(()=>broken.store.ensure());eq((await broken.cacheStorage.open(INFERENCE_CACHE_NAME)).puts,0);eq((await broken.cacheStorage.open(INFERENCE_CACHE_NAME)).items.size,0);
}

// Same-size bytes from another profile are rejected by the selected asset's
// digest, both during download and when reading CacheStorage.
const mixed=setup(()=>new Response(fixtures.get('model')));
await rejects(()=>mixed.store.ensure({backend:'webgpu'}),/SHA-256/);eq((await mixed.cacheStorage.open(INFERENCE_CACHE_NAME)).puts,0);
await owned.put(gpuAssets[1].url,new Response(fixtures.get('runtime-entry')));
await rejects(()=>happy.store.read('gpu-runtime-entry'),/SHA-256/);eq(await owned.match(gpuAssets[1].url),undefined);
const repairBefore=happy.calls.length;await happy.store.ensure({backend:'webgpu'});eq(happy.calls.length-repairBefore,1);eq(await happy.store.read('gpu-runtime-entry'),fixtures.get('gpu-runtime-entry'));
await owned.put(gpuAssets[0].url,new Response(corrupt));const gpuCorruptBefore=happy.calls.length;
await happy.store.ensure();eq(happy.calls.length-gpuCorruptBefore,1); // Repair the earlier missing CPU model only.
eq(await owned.match(gpuAssets[0].url).then(r=>r.arrayBuffer()).then(b=>new Uint8Array(b)),corrupt);
const gpuRepairBefore=happy.calls.length;await happy.store.ensure({backend:'webgpu'});eq(happy.calls.length-gpuRepairBefore,1);eq(await happy.store.read('model-fp16'),fixtures.get('model-fp16'));

// Aborts before setup, while reading a stream, and after verification never put
// the interrupted asset. Previously completed, verified assets may remain.
const pre=setup(),preController=new AbortController();preController.abort();await rejects(()=>pre.store.ensure({signal:preController.signal}),{name:'AbortError'});eq(pre.calls.length,0);
let streamCancelled=false;
const during=setup(()=>new Response(new ReadableStream({start(controller){controller.enqueue(fixtures.get('model').subarray(0,5));},cancel(){streamCancelled=true;}})));
const duringController=new AbortController();await rejects(()=>during.store.ensure({signal:duringController.signal,onProgress:p=>{if(p.phase==='download'&&p.assetLoadedBytes)duringController.abort();}}),{name:'AbortError'});
eq(streamCancelled,true);eq((await during.cacheStorage.open(INFERENCE_CACHE_NAME)).puts,0);
const verified=setup(),verifiedController=new AbortController();await rejects(()=>verified.store.ensure({signal:verifiedController.signal,onProgress:p=>{if(p.phase==='verified')verifiedController.abort();}}),{name:'AbortError'});eq((await verified.cacheStorage.open(INFERENCE_CACHE_NAME)).puts,0);
const gpuCancelled=setup(),gpuController=new AbortController();await rejects(()=>gpuCancelled.store.ensure({backend:'webgpu',signal:gpuController.signal,onProgress:p=>{if(p.phase==='verified')gpuController.abort();}}),{name:'AbortError'});eq((await gpuCancelled.cacheStorage.open(INFERENCE_CACHE_NAME)).puts,0);eq(gpuCancelled.calls.map(c=>c.url),[gpuAssets[0].url]);

// No arbitrary URL or unbounded manifest is accepted by the fixture seam.
assert.throws(()=>createInferenceAssetCache({assets:assets.map((a,i)=>i? a:{...a,url:'https://example.com/model.onnx'})}));checks++;
assert.throws(()=>createInferenceAssetCache({assets:assets.map((a,i)=>i? a:{...a,bytes:INFERENCE_CACHE_LIMIT})}));checks++;
assert.throws(()=>createInferenceAssetCache({assets:assets.map((a,i)=>i===4?{...a,id:'model'}:a)}));checks++;
assert.throws(()=>createInferenceAssetCache({assets:cpuAssets}));checks++;
for(const asset of INFERENCE_ASSETS)eq(inferenceAssetForRequest(new Request(asset.url))?.id,asset.id);
for(const request of [new Request(assets[0].url,{method:'POST'}),new Request(assets[0].url,{method:'HEAD'}),new Request(assets[0].url+'?other=1'),new Request('https://example.test/index.html'),new Request('https://example.test/local.nds'),new Request('https://example.test/crop.png')])eq(inferenceAssetForRequest(request),null);

// Node can import the loader without a browser; unsupported setup is explicit.
await rejects(()=>ensureInferenceAssets(),/Service Worker/);
await rejects(()=>ensureInferenceAssets({backend:'webgpu'}),/Service Worker/);
await rejects(()=>ensureInferenceAssets({backend:'auto'}),/バックエンド/);
const savedNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),savedSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');
try{
 Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});
 let registered=false;
 Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{controller:{scriptURL:'https://example.test/other-sw.js'},getRegistration:async()=>null,register:()=>{registered=true;}}},configurable:true});
 await rejects(()=>ensureInferenceAssets(),/別のService Worker/);eq(registered,false);
 Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{controller:null,getRegistration:async()=>({scope:'https://example.test/',active:{scriptURL:'https://example.test/other-sw.js'}}),register:()=>{registered=true;}}},configurable:true});
 await rejects(()=>ensureInferenceAssets(),/既存のService Worker/);eq(registered,false);
 const pendingController=new AbortController();
 Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{controller:null,getRegistration:()=>new Promise(()=>{})}},configurable:true});
 const pending=ensureInferenceAssets({signal:pendingController.signal});pendingController.abort();await rejects(()=>pending,{name:'AbortError'});
}finally{if(savedNavigator)Object.defineProperty(globalThis,'navigator',savedNavigator);else delete globalThis.navigator;if(savedSecure)Object.defineProperty(globalThis,'isSecureContext',savedSecure);else delete globalThis.isSecureContext;}

// Exercise the real SW dispatch: unrelated requests are untouched; a permitted
// cache miss becomes a network error, never a fetch or HTML fallback.
const savedSelf=globalThis.self,savedCaches=globalThis.caches,events={};let claimed=0,skipped=0;
globalThis.self={addEventListener:(name,fn)=>{events[name]=fn;},skipWaiting:async()=>{skipped++;},clients:{claim:async()=>{claimed++;}}};
globalThis.caches=new MemoryCacheStorage();
try{
 await import('../web/monster-inference-cache-sw.mjs');
 await new Promise(resolve=>events.install({waitUntil:p=>p.then(resolve)}));await new Promise(resolve=>events.activate({waitUntil:p=>p.then(resolve)}));eq(skipped,1);eq(claimed,1);
 let intercepted=0;events.fetch({request:new Request('https://example.test/index.html'),respondWith:()=>{intercepted++;}});eq(intercepted,0);
 const response=await new Promise(resolve=>events.fetch({request:new Request(assets[0].url),respondWith:p=>{intercepted++;p.then(resolve);}}));eq(intercepted,1);eq(response.type,'error');
 for(const asset of assets.slice(1)){
  const miss=await new Promise(resolve=>events.fetch({request:new Request(asset.url),respondWith:p=>p.then(resolve)}));eq(miss.type,'error');
 }
 // Setup's exact allowlisted no-store GET bypasses this controlled page's SW;
 // a normal module request still fails closed on a miss. Other URLs/methods
 // remain untouched, rather than turning this into an arbitrary fetch proxy.
 for(const request of [new Request(assets[0].url,{cache:'no-store'}),new Request(assets[0].url,{method:'HEAD',cache:'no-store'}),new Request(assets[0].url,{method:'POST',cache:'no-store'}),new Request('https://example.test/index.html',{cache:'no-store'}),new Request(assets[0].url+'?unapproved=1',{cache:'no-store'})]){
  events.fetch({request,respondWith:()=>{intercepted++;}});eq(intercepted,1);
 }
 const controlledCacheStorage=new MemoryCacheStorage();let networkDownloads=0,controlledIntercepts=0;
 const controlled=createInferenceAssetCache({assets,cacheStorage:controlledCacheStorage,cryptoImpl:webcrypto,fetcher:async(url,options)=>{
  let interceptedResponse;events.fetch({request:new Request(url,options),respondWith:p=>{controlledIntercepts++;interceptedResponse=p;}});
  if(interceptedResponse)return interceptedResponse;
  networkDownloads++;return new Response(fixtures.get(assets.find(a=>a.url===url).id));
 }});
 await controlled.ensure();eq(networkDownloads,4);eq(controlledIntercepts,0);eq(await controlled.read('model'),fixtures.get('model'));
 const controlledCache=await controlledCacheStorage.open(INFERENCE_CACHE_NAME);await controlledCache.put(assets[0].url,new Response(corrupt));
 await controlled.ensure();eq(networkDownloads,5);eq(controlledIntercepts,0);eq(await controlled.read('model'),fixtures.get('model'));
 await controlledCache.delete(assets[3].url);await controlled.ensure();eq(networkDownloads,6);eq(await controlled.read('runtime-wasm'),fixtures.get('runtime-wasm'));
 await controlled.ensure({backend:'webgpu'});eq(networkDownloads,10);eq(controlledIntercepts,0);eq(await controlled.read('model-fp16'),fixtures.get('model-fp16'));
 await controlledCache.put(gpuAssets[3].url,new Response(fixtures.get('runtime-wasm')));await controlled.ensure({backend:'webgpu'});eq(networkDownloads,11);eq(controlledIntercepts,0);
 await controlled.ensure();await controlled.ensure({backend:'webgpu'});eq(networkDownloads,11);eq((await controlledCache.keys()).length,8);
}finally{globalThis.self=savedSelf;globalThis.caches=savedCaches;}
console.log(JSON.stringify({passed:true,checks,syntheticOnly:true,remoteDownloads:0,browserServiceWorkerIntegrationTested:false},null,2));
