import {NitroFS} from '../../vendor/nitro-fs.mjs';
import {parseMonsterAssetCatalog} from '../../monster-assets.mjs';
import {MonsterGeometry} from '../../monster-geometry.mjs';
import {createDinoFeatureBackend} from '../../monster-dinov2.mjs?v=envelope-yield-20261007-0140';
import {createFeatureBankStore} from '../../monster-feature-cache.mjs';
import {recognizeROI,supplementEnemyROIs,prepareDinoPoseBank,prepareLocalPositionBank} from './monster-recognition-engine.mjs?v=integer-scale-source-20261007-1102';
import {proposeLocalEnemyROIs} from './monster-local-proposals.mjs';
let state=null,epoch=0,active=null,serial=Promise.resolve(),cancelGeneration=0;
const post=message=>self.postMessage(message);
self.onmessage=({data:m})=>{
 if(m?.type==='cancel'){cancelGeneration++;active?.abort();active=null;return;}
 const generation=cancelGeneration;
 // ORT sessions are serial: cancellation invalidates output immediately while
 // a provider finishes its current dispatch before the next request may run.
 serial=serial.catch(()=>{}).then(()=>{if(generation===cancelGeneration||m?.type==='load')return handleMessage(m);});
};
async function handleMessage(m){
 if(!m||!['load','recognize','supplement','prepare','prepare-position','position','cancel'].includes(m.type))return;
 if(m.type==='cancel'){active?.abort();active=null;return;}
 const id=m.id,romEpoch=m.romEpoch;let requestEpoch=epoch,controller=null,stage=m.type;
 try{
  if(typeof id!=='string'||!id||!Number.isSafeInteger(romEpoch)||romEpoch<0)throw Error('要求の識別情報が不正です');
  if(m.type==='load'){
   active?.abort();active=null;const previous=state;state=null;const mine=++epoch;requestEpoch=mine;await previous?.dino?.dispose();
   if(!(m.rom instanceof ArrayBuffer)||m.rom.byteLength<512||m.rom.byteLength>512*1024*1024)throw Error('NDSは512MiB以下のファイルを選んでください');
   if(new TextDecoder().decode(new Uint8Array(m.rom,12,4))!=='YDQJ')throw Error('日本語版DQ9 (YDQJ) のNDSを選んでください');
   const [romDigest,csvResponse,wasmResponse]=await Promise.all([crypto.subtle.digest('SHA-256',m.rom),fetch(new URL('../../data/monsters.csv',import.meta.url)),fetch(new URL('../../wasm/monster_geometry.wasm',import.meta.url))]);if(!csvResponse.ok||!wasmResponse.ok)throw Error('識別用のコード・カタログを読み込めません');
   const catalog=parseMonsterAssetCatalog(await csvResponse.text()),{instance}=await WebAssembly.instantiate(await wasmResponse.arrayBuffer(),{});if(mine!==epoch)return;
   state={nitro:NitroFS.fromRom(m.rom),catalog,geometry:new MonsterGeometry(instance),romEpoch,romSHA256:Array.from(new Uint8Array(romDigest),v=>v.toString(16).padStart(2,'0')).join(''),featureStore:createFeatureBankStore()};post({type:'loaded',id,romEpoch,catalog:[...catalog].map(([modelId,speciesCandidates])=>({modelId,speciesCandidates}))});return;
  }
  if(!state||state.romEpoch!==romEpoch)throw Error('現在のNDSを読み込み直してください');active?.abort();controller=new AbortController();const mine=epoch;active=controller;
  const runState=state,onProgress=p=>{if(active===controller&&mine===epoch){if(typeof p.phase==='string'&&p.phase)stage=p.phase==='init'?`${m.inferenceBackend??'wasm'}-init`:p.phase;post({type:'progress',id,romEpoch,...p});}};
  const getDino=async({backend:provider='wasm'}={})=>{if(runState.dino?.spec.backend===provider)return runState.dino;const previous=runState.dino,previousStage=stage;runState.dino=null;stage='backend-dispose';await previous?.dispose();stage=`${provider}-init`;const backend=await createDinoFeatureBackend({backend:provider,signal:controller.signal,onProgress});if(active!==controller||mine!==epoch){await backend.dispose();throw new DOMException('中止','AbortError');}runState.dino=backend;stage=previousStage;return backend;};
  let result;
  if(m.type==='prepare-position'){
   const dino=await getDino({backend:m.inferenceBackend});
   if(runState.localBank?.identity===dino.identity){result={prepared:true,reused:true,timings:{totalMs:0}};}
   else{const outcome=await prepareLocalPositionBank(m,{...runState,signal:controller.signal,onProgress,getDino});runState.localBank=outcome.bank;result={prepared:true,timings:outcome.timings,cacheWarnings:outcome.cacheWarnings};}
  }else if(m.type==='position'){
   if(!runState.localBank)throw Error('ROM前景patchを先に準備してください');
   result=await proposeLocalEnemyROIs(m.image,m.captureStamp,{backend:await getDino({backend:m.inferenceBackend}),bank:runState.localBank,signal:controller.signal,onProgress});
   // Compact buffers belong to the worker, except the small tracking snapshot.
  }else{const outcome=await (m.type==='prepare'?prepareDinoPoseBank:m.type==='supplement'?supplementEnemyROIs:recognizeROI)(m,{...runState,signal:controller.signal,onProgress,getDino});result=m.type==='prepare'?{prepared:true,timings:outcome.timings,cacheWarnings:outcome.cacheWarnings}:outcome;}
  if(active!==controller||mine!==epoch)return;active=null;post({type:'result',id,romEpoch,result});
 }catch(error){if(error?.name==='AbortError'||requestEpoch!==epoch||(controller&&active!==controller))return;const detail={name:typeof error?.name==='string'?error.name:'Error',message:String(error?.message??error),stack:typeof error?.stack==='string'?error.stack:'',stage:typeof error?.stage==='string'&&error.stage?error.stage:stage};post({type:'error',id,romEpoch,message:detail.message,error:detail});}
}
