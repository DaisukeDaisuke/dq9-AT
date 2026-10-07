import {INFERENCE_ASSETS,INFERENCE_CACHE_NAME,inferenceProfile} from '../monster-inference-assets.mjs';
import {dinoSpec,probeDinoWebGPU} from '../monster-dinov2.mjs?v=registration-timing-20261007-0020';
// Selection only inspects existing local assets. The worker verifies their pinned
// size and SHA-256 before use. Nothing here fetches or prepares remote models.
export async function chooseResidualBackend({preference='wasm',gpu=globalThis.navigator?.gpu,cacheStorage=globalThis.caches,assertCurrent=()=>{},probe=probeDinoWebGPU}={}){
 assertCurrent();if(!['wasm','cached-webgpu'].includes(preference))throw Error('不正な残差推論方式です');
 if(preference==='wasm')return {backend:'wasm',reason:'fixed-wasm-int8-baseline'};
 try{
  await probe({gpu});assertCurrent();
  if(!cacheStorage?.open)throw Error('CacheStorageを利用できません');
  const cache=await cacheStorage.open(INFERENCE_CACHE_NAME);assertCurrent();
  for(const id of inferenceProfile('webgpu').assetIds){const asset=INFERENCE_ASSETS.find(a=>a.id===id);const found=await cache.match(asset.url);assertCurrent();if(!found)throw Error('保存済みWebGPUファイルが不足: '+id);}
  return {backend:'webgpu',reason:'cached-webgpu-fp16; worker verifies integrity before inference'};
 }catch(error){assertCurrent();if(error?.name==='AbortError')throw error;return {backend:'wasm',reason:String(error?.message??error)};}
}
export function residualBackendProvenance(backend){const {modelSHA256,modelRevision,runtime,provider,precision,preprocessor}=dinoSpec(backend);return {backend,modelSHA256,modelRevision,runtime,provider,precision,preprocessor,numericalParityWithWasmInt8:false,distancesComparableAcrossBackends:false};}
export function assertResidualBackendResult(result,backend){
 const spec=dinoSpec(backend),actual=result.inference;
 if(!actual||['backend','provider','precision','modelSHA256','runtime','preprocessor'].some(k=>actual[k]!==spec[k]))throw Error('推論結果のbackend/model識別が要求と一致しません');
}
