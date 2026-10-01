import{validateAssetConfig,readCachedAsset}from'./tiny-yolo-validation.mjs';
let runtimePromise;
// TFJS 4.22's bundled regenerator assigns this global in strict mode. Without
// an existing binding it falls back to Function(...), which our CSP disallows.
// This binding lets the unchanged, hash-verified UMD take its ordinary path.
export function prepareRuntimeGlobals(scope=globalThis){
 if(!Object.hasOwn(scope,'regeneratorRuntime'))Object.defineProperty(scope,'regeneratorRuntime',{value:undefined,writable:true,configurable:true});
}
export function runtimeSnapshot(scope=globalThis){
 const tf=scope.tf,version=value=>typeof value==='string'?value.slice(0,40):null;
 return{tfPresent:!!tf,tfjs:version(tf?.version?.tfjs),core:version(tf?.version_core),versionCore:version(tf?.version?.['tfjs-core']),envType:typeof tf?.env,webgpuType:typeof tf?.WebGPUBackend,regeneratorType:typeof scope.regeneratorRuntime};
}
export function assertRuntimeSnapshot(snapshot,expected,{webgpu=false}={}){
 if(snapshot.tfjs!==expected||snapshot.core!==expected||snapshot.versionCore!==expected||snapshot.envType!=='function'||(webgpu&&snapshot.webgpuType!=='function'))throw Error(`TensorFlow runtime validation failed: expected ${expected}; actual ${JSON.stringify(snapshot)}`);
}
async function loadRuntime(config,read,onProgress){
 const diagnostics={expectedVersion:config.tfjsVersion,cspStringEvaluationAllowed:false,events:[]};
 try{
  prepareRuntimeGlobals();
  for(const asset of config.assets.filter(a=>a.kind==='runtime')){
   const event={asset:asset.id,before:runtimeSnapshot(),after:null,executionErrors:[]};diagnostics.events.push(event);
   const bytes=await read(asset),url=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));
   try{
    await new Promise((resolve,reject)=>{
     const script=document.createElement('script');script.src=url;
     const onError=e=>{if(e.filename===url&&event.executionErrors.length<3)event.executionErrors.push({name:String(e.error?.name??'Error').slice(0,40),message:String(e.message??'Runtime execution error').slice(0,240)});};
     const cleanup=()=>{globalThis.removeEventListener('error',onError);script.remove();};
     globalThis.addEventListener('error',onError);
     script.onload=()=>{cleanup();event.after=runtimeSnapshot();event.executionErrors.length?reject(Error(`Runtime execution failed: ${asset.id}: ${event.executionErrors[0].message}`)):resolve();};
     script.onerror=()=>{cleanup();event.after=runtimeSnapshot();reject(Error(`Runtime script load failed: ${asset.id}`));};
     document.head.append(script);
    });
    assertRuntimeSnapshot(event.after,config.tfjsVersion,{webgpu:asset.id==='webgpu'});
    onProgress({phase:'runtime-validation',runtimeDiagnostics:diagnostics});
   }finally{URL.revokeObjectURL(url);}
  }
  return{tf:globalThis.tf,diagnostics};
 }catch(error){error.runtimeDiagnostics=diagnostics;throw error;}
}
export async function loadDetectorAssets({signal,onProgress=()=>{},model=true}={}){
 const response=await fetch(new URL('./tiny-yolo-assets.json',import.meta.url),{cache:'no-store',signal});if(!response.ok)throw Error(`Configuration HTTP error: ${response.status}`);const config=validateAssetConfig(await response.json());
 if(model&&!config.upstreamModelSourceApproved)throw Error('Pinned upstream model source has not yet been approved; no model download started');
 const cache=await caches.open(config.cacheName);
 const read=asset=>readCachedAsset(asset,cache,{signal,onProgress});
 if(!runtimePromise)runtimePromise=loadRuntime(config,read,onProgress).catch(e=>{runtimePromise=null;throw e;});
 const{tf,diagnostics}=await runtimePromise;onProgress({phase:'runtime-ready',runtimeDiagnostics:diagnostics});tf.env().set('WEBGPU_CPU_FORWARD',false);if(!await tf.setBackend('webgpu'))throw Error('WebGPU initialization failed; CPU/WebGL fallback is disabled');await tf.ready();if(tf.getBackend()!=='webgpu')throw Error('Unexpected non-WebGPU backend');if(!model)return{tf,config};const manifestAsset=config.assets.find(a=>a.id==='coco_model-weights_manifest.json'),manifest=JSON.parse(new TextDecoder().decode(await read(manifestAsset))),buffers=[];for(const name of manifest[0].paths){const asset=config.assets.find(a=>a.id===name);if(!asset||asset.kind!=='model')throw Error('Model manifest names an unapproved shard');buffers.push(await read(asset));}const joined=new Uint8Array(buffers.reduce((n,b)=>n+b.byteLength,0));let offset=0;for(const b of buffers){joined.set(new Uint8Array(b),offset);offset+=b.byteLength;}return{tf,config,manifest,weightMap:tf.io.decodeWeights(joined.buffer,manifest[0].weights)};
}
