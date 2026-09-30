import {NitroFS} from './vendor/nitro-fs.mjs';
import {parseMonsterAssetCatalog} from './monster-assets.mjs';
import {MonsterGeometry} from './monster-geometry.mjs';
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
   active?.abort();active=null;state=null;const mine=++epoch;requestEpoch=mine;
   if(!(m.rom instanceof ArrayBuffer)||m.rom.byteLength<512||m.rom.byteLength>512*1024*1024)throw Error('NDSは512MiB以下のファイルを選んでください');
   if(new TextDecoder().decode(new Uint8Array(m.rom,12,4))!=='YDQJ')throw Error('日本語版DQ9 (YDQJ) のNDSを選んでください');
   const [csvResponse,wasmResponse]=await Promise.all([fetch(new URL('./data/monsters.csv',import.meta.url)),fetch(new URL('./wasm/monster_geometry.wasm',import.meta.url))]);if(!csvResponse.ok||!wasmResponse.ok)throw Error('識別用のコード・カタログを読み込めません');
   const catalog=parseMonsterAssetCatalog(await csvResponse.text()),{instance}=await WebAssembly.instantiate(await wasmResponse.arrayBuffer(),{});if(mine!==epoch)return;
   state={nitro:NitroFS.fromRom(m.rom),catalog,geometry:new MonsterGeometry(instance),romEpoch};post({type:'loaded',id,romEpoch,catalog:[...catalog].map(([modelId,speciesCandidates])=>({modelId,speciesCandidates}))});return;
  }
  if(!state||state.romEpoch!==romEpoch)throw Error('現在のNDSを読み込み直してください');active?.abort();controller=new AbortController();const mine=epoch;active=controller;
  const result=await recognizeROI(m,{...state,signal:controller.signal,onProgress:p=>{if(active===controller&&mine===epoch)post({type:'progress',id,romEpoch,...p});}});
  if(active!==controller||mine!==epoch)return;active=null;post({type:'result',id,romEpoch,result});
 }catch(error){if(error.name==='AbortError'||requestEpoch!==epoch||(controller&&active!==controller))return;post({type:'error',id,romEpoch,message:String(error?.message??error)});}
};
