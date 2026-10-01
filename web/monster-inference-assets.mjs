// Remote inference code/weights stay in CacheStorage, never in the app bundle.
// ONNX Runtime: MIT, https://github.com/microsoft/onnxruntime/blob/v1.23.2/LICENSE
// Base DINOv2: Apache-2.0, https://github.com/facebookresearch/dinov2/blob/main/LICENSE
// Conversion source: https://huggingface.co/Xenova/dinov2-small/tree/c2bb04a51fab207c420665f1946016107bffc701
// That conversion repository does not restate the base model's license.
const MODEL_BASE='https://huggingface.co/Xenova/dinov2-small/resolve/c2bb04a51fab207c420665f1946016107bffc701/';
const RUNTIME_BASE='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
export const INFERENCE_CACHE_PREFIX='dq9-monster-inference-';
export const INFERENCE_CACHE_NAME=INFERENCE_CACHE_PREFIX+'v2-dino-c2bb04a51fab-ort-1.23.2';
export const INFERENCE_CACHE_LIMIT=128*1024*1024;
export const INFERENCE_ASSETS=Object.freeze([
 {id:'model',url:MODEL_BASE+'onnx/model_quantized.onnx',bytes:24451943,sha256:'3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917',mime:'application/octet-stream'},
 {id:'runtime-entry',url:RUNTIME_BASE+'ort.wasm.min.mjs',bytes:49856,sha256:'69751720f611e37d1ce2fa3c6ebaa80f949014752636c5f8887a63d40feadcc7',mime:'text/javascript'},
 {id:'runtime-mjs',url:RUNTIME_BASE+'ort-wasm-simd-threaded.mjs',bytes:20321,sha256:'90a557d15c02bac4504d95b67f431d8594635ed2a0a62a7f2cd83d090ff91d3e',mime:'text/javascript'},
 {id:'runtime-wasm',url:RUNTIME_BASE+'ort-wasm-simd-threaded.wasm',bytes:11905541,sha256:'45eaee27761ad883742a8d4b8fce1538d60ce43b51adf1726fafccc59b8c1a15',mime:'application/wasm'},
 {id:'model-fp16',url:MODEL_BASE+'onnx/model_fp16.onnx',bytes:44427534,sha256:'4e9ea6fe106e2225e28ee3c1c3d53b5b92aa4af62142f6ed6b66b6a92213cf04',mime:'application/octet-stream'},
 {id:'gpu-runtime-entry',url:RUNTIME_BASE+'ort.webgpu.min.mjs',bytes:66261,sha256:'8ae8f1340dd86f8aaa5acc0fd5ec2f42ae874ffd7c9cd804281b73fd177c9864',mime:'text/javascript'},
 {id:'gpu-runtime-mjs',url:RUNTIME_BASE+'ort-wasm-simd-threaded.asyncify.mjs',bytes:51913,sha256:'249b4dc791f081d33bd11760bfd669fe85f97289e679bbeb291b874272125dff',mime:'text/javascript'},
 {id:'gpu-runtime-wasm',url:RUNTIME_BASE+'ort-wasm-simd-threaded.asyncify.wasm',bytes:25499390,sha256:'babec0bbddb6d3082623b99b7e1391b75e0729bcca076ff8424d7753af97fada',mime:'application/wasm'}
].map(Object.freeze));
export const INFERENCE_RUNTIME=Object.freeze({entry:INFERENCE_ASSETS[1].url,mjs:INFERENCE_ASSETS[2].url,wasm:INFERENCE_ASSETS[3].url});
const need=(ok,message)=>{if(!ok)throw Error(message);};
const abort=signal=>{if(signal?.aborted)throw new DOMException('推論用ファイルの準備を中止しました','AbortError');};
const assetFor=id=>INFERENCE_ASSETS.find(asset=>asset.id===id);
const profiles=Object.freeze(Object.fromEntries(['wasm','webgpu'].map((backend,index)=>{
 const selected=INFERENCE_ASSETS.slice(index*4,index*4+4),assetIds=Object.freeze(selected.map(a=>a.id));
 return [backend,Object.freeze({backend,assetIds,totalBytes:selected.reduce((sum,a)=>sum+a.bytes,0),modelId:assetIds[0],runtimeIds:Object.freeze({entry:assetIds[1],mjs:assetIds[2],wasm:assetIds[3]})})];
})));
export function inferenceProfile(backend='wasm'){need(backend==='wasm'||backend==='webgpu','推論バックエンドが不正です');return profiles[backend];}
export const inferenceAssetForRequest=request=>request?.method==='GET'?INFERENCE_ASSETS.find(asset=>asset.url===request.url)??null:null;
export function inferenceAssetResponse(asset,bytes){
 return new Response(bytes,{headers:{'Content-Type':asset.mime,'Content-Length':String(bytes.byteLength),'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
}
async function verifiedBytes(response,asset,{signal,onBytes=()=>{},cryptoImpl=globalThis.crypto}={}){
 abort(signal);need(response?.ok&&response.type!=='opaque'&&response.type!=='opaqueredirect','推論用ファイルをCORSで読み込めません');
 need(response.body?.getReader&&cryptoImpl?.subtle,'ストリームとSHA-256を利用できません');
 const data=new Uint8Array(asset.bytes),reader=response.body.getReader();let offset=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
  for(;;){abort(signal);const {done,value}=await reader.read();abort(signal);if(done)break;need(value instanceof Uint8Array&&offset+value.byteLength<=asset.bytes,'推論用ファイルのサイズが一致しません');data.set(value,offset);offset+=value.byteLength;onBytes(offset);}
  need(offset===asset.bytes,'推論用ファイルのサイズが一致しません');
  const hash=Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');abort(signal);
  need(hash===asset.sha256,'推論用ファイルのSHA-256が一致しません');return data;
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
}
// The fixture seam may replace bytes/digests, but never the fixed URL allowlist.
// Public setup and reads below always use the immutable production manifest.
export function createInferenceAssetCache({assets=INFERENCE_ASSETS,cacheStorage=globalThis.caches,fetcher=(...args)=>globalThis.fetch(...args),cryptoImpl=globalThis.crypto}={}){
 need(Array.isArray(assets)&&assets.length===INFERENCE_ASSETS.length&&new Set(assets.map(a=>a.id)).size===assets.length&&assets.every(a=>assetFor(a.id)?.url===a.url&&Number.isSafeInteger(a.bytes)&&a.bytes>0&&/^[0-9a-f]{64}$/.test(a.sha256)),'推論用ファイルの一覧が不正です');
 const allBytes=assets.reduce((n,a)=>n+a.bytes,0);need(allBytes<=INFERENCE_CACHE_LIMIT,'推論用キャッシュの128MiB制限を超えます');
 const byId=id=>{const asset=assets.find(a=>a.id===id);need(asset,'許可されていない推論用ファイルです');return asset;};
 const open=()=>{need(cacheStorage?.open,'CacheStorageを利用できません');return cacheStorage.open(INFERENCE_CACHE_NAME);};
 async function read(id,{signal}={}){
  const asset=byId(id);abort(signal);const cache=await open(),response=await cache.match(asset.url);abort(signal);need(response,'推論用ファイルの準備が必要です');
  try{return await verifiedBytes(response,asset,{signal,cryptoImpl});}
  catch(error){if(error.name!=='AbortError')await cache.delete(asset.url);throw error;}
 }
 async function ensure({backend='wasm',signal,onProgress=()=>{}}={}){
  const profile=inferenceProfile(backend),selected=profile.assetIds.map(byId),totalBytes=selected.reduce((sum,a)=>sum+a.bytes,0);
  abort(signal);const cache=await open();abort(signal);
  // Prune only this feature's caches and unowned entries. A valid asset in the
  // other profile stays cached, without downloading that unselected profile.
  for(const name of await cacheStorage.keys()){abort(signal);if(name.startsWith(INFERENCE_CACHE_PREFIX)&&name!==INFERENCE_CACHE_NAME)await cacheStorage.delete(name);}
  for(const key of await cache.keys()){abort(signal);if(key.method!=='GET'||!assets.some(a=>a.url===key.url))await cache.delete(key);}
  let completedBytes=0;
  for(let i=0;i<selected.length;i++){
   const asset=selected[i];abort(signal);
   const progress=(phase,assetLoadedBytes=0,fromCache=false)=>onProgress({phase,backend,assetId:asset.id,assetIndex:i,totalAssets:selected.length,assetLoadedBytes,assetBytes:asset.bytes,loadedBytes:completedBytes+assetLoadedBytes,totalBytes,fromCache,message:`推論用ファイル ${i+1}/${selected.length}: ${asset.id}`});
   progress('cache-check');let bytes,response=await cache.match(asset.url);abort(signal);
   if(response)try{bytes=await verifiedBytes(response,asset,{signal,cryptoImpl});}catch(error){if(error.name==='AbortError')throw error;await cache.delete(asset.url);progress('repair');}
   if(!bytes){
    progress('download');response=await fetcher(asset.url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'follow',signal});
    bytes=await verifiedBytes(response,asset,{signal,cryptoImpl,onBytes:n=>progress('download',n)});abort(signal);progress('verified',asset.bytes);
    // Cache.put is atomic; interrupted streams are never submitted to it.
    abort(signal);await cache.put(asset.url,inferenceAssetResponse(asset,bytes));abort(signal);
    progress('cached',asset.bytes,false);
   }else progress('cached',asset.bytes,true);
   completedBytes+=asset.bytes;
  }
  return {cacheName:INFERENCE_CACHE_NAME,totalBytes,backend,modelId:profile.modelId,runtimeIds:profile.runtimeIds};
 }
 return {read,ensure};
}
export function readCachedInferenceAsset(id,options){return createInferenceAssetCache().read(id,options);}

function serviceWorkerContext(){
 const workers=globalThis.navigator?.serviceWorker;need(workers&&globalThis.isSecureContext,'推論の準備にはHTTPSとService Workerが必要です');
 return {workers,url:new URL('./monster-inference-cache-sw.mjs',import.meta.url).href,scope:new URL('./',import.meta.url).href};
}
function cancellable(promise,signal){
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const cancel=()=>reject(new DOMException('推論用ファイルの準備を中止しました','AbortError'));
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
 });
}
async function checkServiceWorker({workers,url,scope},signal){
 const existing=await cancellable(workers.getRegistration(scope),signal);abort(signal);
 need(!workers.controller||workers.controller.scriptURL===url,'別のService Workerがこのページを管理しています。推論用の登録は変更していません');
 need(!existing||(existing.scope===scope&&[existing.active,existing.waiting,existing.installing].every(worker=>!worker||worker.scriptURL===url)),'既存のService Workerは置き換えません');
}
async function controlPage(context,signal){
 const {workers,url,scope}=context;abort(signal);await checkServiceWorker(context,signal);abort(signal);
 await cancellable(workers.register(url,{scope,type:'module',updateViaCache:'none'}),signal);abort(signal);
 await new Promise((resolve,reject)=>{
  let timer;const done=error=>{clearTimeout(timer);workers.removeEventListener('controllerchange',check);signal?.removeEventListener('abort',cancel);error?reject(error):resolve();};
  const check=()=>{if(workers.controller)done(workers.controller.scriptURL===url?null:Error('推論用Service Workerの管理対象が変わりました'));};
  const cancel=()=>done(new DOMException('推論用ファイルの準備を中止しました','AbortError'));
  workers.addEventListener('controllerchange',check);signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(()=>done(Error('推論用Service Workerを開始できません。再読み込みして再試行してください')),15000);if(signal?.aborted)cancel();else check();
 });
}
export async function ensureInferenceAssets({backend='wasm',signal,onProgress=()=>{}}={}){
 const profile=inferenceProfile(backend),selected=profile.assetIds.map(assetFor),runtime=Object.freeze(Object.fromEntries(Object.entries(profile.runtimeIds).map(([key,id])=>[key,assetFor(id).url])));
 abort(signal);const context=serviceWorkerContext();await checkServiceWorker(context,signal);abort(signal);
 const info=await createInferenceAssetCache().ensure({backend,signal,onProgress});abort(signal);
 onProgress({phase:'service-worker',message:'検証済みの推論用ファイルをこのページで利用できるようにしています'});
 await controlPage(context,signal);abort(signal);
 onProgress({phase:'ready',loadedBytes:info.totalBytes,totalBytes:info.totalBytes,message:'推論用ファイルの準備ができました'});
 return {...info,assets:Object.freeze(selected),runtime:backend==='wasm'?INFERENCE_RUNTIME:runtime,modelId:profile.modelId};
}
