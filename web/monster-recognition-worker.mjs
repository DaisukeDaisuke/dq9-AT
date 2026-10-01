import {NitroFS} from './vendor/nitro-fs.mjs';
import {parseMonsterAssetCatalog} from './monster-assets.mjs';
import {MonsterGeometry} from './monster-geometry.mjs';
import {createDinoFeatureBackend} from './monster-dinov2.mjs';
import {createFeatureBankStore} from './monster-feature-cache.mjs';
import {recognizeROI} from './monster-recognition-engine.mjs';
let state=null,epoch=0,active=null;
const post=message=>self.postMessage(message);
self.onmessage=async({data:m})=>{
 if(!m||!['load','recognize','cancel'].includes(m.type))return;
 if(m.type==='cancel'){active?.abort();active=null;return;}
 const id=m.id,romEpoch=m.romEpoch;let requestEpoch=epoch,controller=null;
 try{
  if(typeof id!=='string'||!id||!Number.isSafeInteger(romEpoch)||romEpoch<0)throw Error('要求の識別情報が不正です');
  if(m.type==='load'){
   active?.abort();active=null;const previous=state;state=null;const mine=++epoch;requestEpoch=mine;await previous?.dino?.dispose();
   if(!(m.rom instanceof ArrayBuffer)||m.rom.byteLength<512||m.rom.byteLength>512*1024*1024)throw Error('NDSは512MiB以下のファイルを選んでください');
   if(new TextDecoder().decode(new Uint8Array(m.rom,12,4))!=='YDQJ')throw Error('日本語版DQ9 (YDQJ) のNDSを選んでください');
   const [romDigest,csvResponse,wasmResponse]=await Promise.all([crypto.subtle.digest('SHA-256',m.rom),fetch(new URL('./data/monsters.csv',import.meta.url)),fetch(new URL('./wasm/monster_geometry.wasm',import.meta.url))]);if(!csvResponse.ok||!wasmResponse.ok)throw Error('識別用のコード・カタログを読み込めません');
   const catalog=parseMonsterAssetCatalog(await csvResponse.text()),{instance}=await WebAssembly.instantiate(await wasmResponse.arrayBuffer(),{});if(mine!==epoch)return;
   state={nitro:NitroFS.fromRom(m.rom),catalog,geometry:new MonsterGeometry(instance),romEpoch,romSHA256:Array.from(new Uint8Array(romDigest),v=>v.toString(16).padStart(2,'0')).join(''),featureStore:createFeatureBankStore()};post({type:'loaded',id,romEpoch,catalog:[...catalog].map(([modelId,speciesCandidates])=>({modelId,speciesCandidates}))});return;
  }
  if(!state||state.romEpoch!==romEpoch)throw Error('現在のNDSを読み込み直してください');active?.abort();controller=new AbortController();const mine=epoch;active=controller;
  const runState=state,onProgress=p=>{if(active===controller&&mine===epoch)post({type:'progress',id,romEpoch,...p});};
  const getDino=async({backend:provider='wasm'}={})=>{if(runState.dino?.spec.backend===provider)return runState.dino;const previous=runState.dino;runState.dino=null;await previous?.dispose();const backend=await createDinoFeatureBackend({backend:provider,signal:controller.signal,onProgress});if(active!==controller||mine!==epoch){await backend.dispose();throw new DOMException('中止','AbortError');}runState.dino=backend;return backend;};
  const result=await recognizeROI(m,{...runState,signal:controller.signal,onProgress,getDino});
  if(active!==controller||mine!==epoch)return;active=null;post({type:'result',id,romEpoch,result});
 }catch(error){if(error.name==='AbortError'||requestEpoch!==epoch||(controller&&active!==controller))return;post({type:'error',id,romEpoch,message:String(error?.message??error)});}
};
