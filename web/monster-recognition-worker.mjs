import {classificationNow,classificationDuration,classificationClock} from './monster-classification-timing.mjs?v=envelope-yield-20261007-0140';
// Attached only to the existing appearance result/error. The snapshot precedes
// postMessage; no unmeasured send time is reported as worker computation.
function retainWorkerEnvelope(value,m,started,engineStarted,engineEnded,engineReturned,status){try{
 if(m.type!=='recognize'||!value||typeof value!=='object')return;
 const beforePost=classificationNow();value.classificationEnvelopeTiming={worker:{schema:'classification-worker-envelope-v1',clock:classificationClock('recognition-worker'),requestId:typeof m.id==='string'?m.id.slice(0,128):null,romEpoch:Number.isSafeInteger(m.romEpoch)?m.romEpoch:null,status,handlerStartedAtMs:started,handlerToEngineCallElapsedMs:classificationDuration(started,engineStarted),engineCallElapsedMs:classificationDuration(engineStarted,engineEnded),engineCallReturned:engineReturned,engineCallUnfinishedElapsedMs:engineReturned?null:classificationDuration(engineStarted,beforePost),engineReturnToBeforePostElapsedMs:classificationDuration(engineEnded,beforePost),handlerToBeforePostElapsedMs:classificationDuration(started,beforePost),finalSnapshotBeforePost:status==='completed',measurementKind:'async-elapsed-not-CPU-time',scope:'Same worker realm only; engine-call span includes engine validation, result assembly and cleanup. PostMessage itself and cross-realm delivery are outside this final snapshot.'}};
 }catch{}}
import {NitroFS} from './vendor/nitro-fs.mjs';
import {parseMonsterAssetCatalog} from './monster-assets.mjs';
import {MonsterGeometry} from './monster-geometry.mjs?v=field-stream-20261005-1108';
import {createDinoFeatureBackend} from './monster-dinov2.mjs?v=envelope-yield-20261007-0140';
import {createFeatureBankStore} from './monster-feature-cache.mjs';
import {recognizeROI,supplementEnemyROIs,prepareDinoPoseBank,createRenderedReferenceCache} from './monster-recognition-engine.mjs?v=recognition-20261008-7cf64cf4';
let state=null,epoch=0,active=null,nativeBodyModulePromise=null;
const loadNativeBodyModule=()=>nativeBodyModulePromise??=import('./monster-native-auto-support.mjs?v=native-budget-20261008-83ff459d').catch(error=>{nativeBodyModulePromise=null;throw error;});
const post=message=>self.postMessage(message);
self.onmessage=async({data:m})=>{
 const handlerStarted=classificationNow();let engineStarted=null,engineEnded=null,engineReturned=false;
 if(!m||!['load','recognize','supplement','prepare','native-body-support','cancel'].includes(m.type))return;
 if(m.type==='cancel'){
  // Targeted optional expiry must never abort a newer appearance request.
  // ID-free cancellation remains supported for the other existing clients.
  const targeted=typeof m.id==='string';
  if(!targeted||(active?.requestId===m.id&&active?.romEpoch===m.romEpoch)){active?.abort();active=null;}
  if(targeted)post({type:'cancelled',id:m.id,romEpoch:m.romEpoch});return;
 }
 const id=m.id,romEpoch=m.romEpoch;let requestEpoch=epoch,controller=null,stage=m.type;
 try{
  if(typeof id!=='string'||!id||!Number.isSafeInteger(romEpoch)||romEpoch<0)throw Error('要求の識別情報が不正です');
  if(m.type==='load'){
   active?.abort();active=null;const previous=state;state=null;const mine=++epoch;requestEpoch=mine;previous?.renderedReferenceCache.clear();previous?.nativeBodySupport?.dispose();await previous?.dino?.dispose();
   if(!(m.rom instanceof ArrayBuffer)||m.rom.byteLength<512||m.rom.byteLength>512*1024*1024)throw Error('NDSは512MiB以下のファイルを選んでください');
   if(new TextDecoder().decode(new Uint8Array(m.rom,12,4))!=='YDQJ')throw Error('日本語版DQ9 (YDQJ) のNDSを選んでください');
   const [romDigest,csvResponse,wasmResponse]=await Promise.all([crypto.subtle.digest('SHA-256',m.rom),fetch(new URL('./data/monsters.csv',import.meta.url)),fetch(new URL('./wasm/monster_geometry.wasm',import.meta.url))]);if(!csvResponse.ok||!wasmResponse.ok)throw Error('識別用のコード・カタログを読み込めません');
   const catalog=parseMonsterAssetCatalog(await csvResponse.text()),{instance}=await WebAssembly.instantiate(await wasmResponse.arrayBuffer(),{});if(mine!==epoch)return;
   state={rom:new Uint8Array(m.rom),nitro:NitroFS.fromRom(m.rom),catalog,geometry:new MonsterGeometry(instance),romEpoch,romSHA256:Array.from(new Uint8Array(romDigest),v=>v.toString(16).padStart(2,'0')).join(''),featureStore:createFeatureBankStore(),renderedReferenceCache:createRenderedReferenceCache()};post({type:'loaded',id,romEpoch,catalog:[...catalog].map(([modelId,speciesCandidates])=>({modelId,speciesCandidates}))});return;
  }
  if(!state||state.romEpoch!==romEpoch)throw Error('現在のNDSを読み込み直してください');active?.abort();controller=new AbortController();controller.requestId=id;controller.romEpoch=romEpoch;const mine=epoch;active=controller;
  const runState=state,onProgress=p=>{if(active===controller&&mine===epoch){if(typeof p.phase==='string'&&p.phase)stage=p.phase==='init'?`${m.inferenceBackend??'wasm'}-init`:p.phase;post({type:'progress',id,romEpoch,...p});}};
  if(m.type==='native-body-support'){
   const budget=m.budget;
   if(!Number.isFinite(budget?.wallTimeMs)||budget.wallTimeMs<=0||budget.wallTimeMs>1500||!Number.isSafeInteger(budget.maxProposals)||budget.maxProposals<=0||budget.maxProposals>128)throw Error('Explicit native frame-job budget exceeds 1500 ms / 128 proposals');
   if(m.request?.backgroundEvidence?.romSHA256!==runState.romSHA256)throw Error('Native body request ROM differs from loaded ROM');
   const started=performance.now();
   // Cache only the import promise. A canceled cold import cannot construct
   // heavy source state when it later resolves alongside a newer DINO request.
   if(!runState.nativeBodySupport){
    const {createAutomaticNativeBodySupportService}=await loadNativeBodyModule();
    if(active!==controller||mine!==epoch||controller.signal.aborted)throw new DOMException('中止','AbortError');
    runState.nativeBodySupport=createAutomaticNativeBodySupportService({rom:runState.rom,catalog:runState.catalog,geometry:runState.geometry,romSHA256:runState.romSHA256,nitro:runState.nitro});
   }
   const service=runState.nativeBodySupport;
   // Loading code/service is owned asynchronous preparation, not a source visit.
   // Start the finite cooperative source budget only after preparation.
   const preparationElapsedMs=performance.now()-started;
   onProgress({phase:'native-service-ready',nativePreparationTiming:{elapsedMs:preparationElapsedMs,kind:'async-preparation-elapsed',sourceBudgetStartsAfterPreparation:true}});
   const result=await service.evaluate(m.request,{signal:controller.signal,getCurrentFrame:()=>active===controller&&mine===epoch&&!controller.signal.aborted?{...m.request.videoEvidence,romSHA256:runState.romSHA256}:null,budget:{wallTimeMs:budget.wallTimeMs,maxProposals:budget.maxProposals},onProgress});
   if(active!==controller||mine!==epoch||controller.signal.aborted)return;active=null;post({type:'result',id,romEpoch,result:{...result,nativePreparationTiming:{elapsedMs:preparationElapsedMs,kind:'async-preparation-elapsed',sourceBudgetStartsAfterPreparation:true}}});return;
  }
  const getDino=async({backend:provider='wasm',onAcquisitionTiming}={})=>{if(runState.dino?.spec.backend===provider){try{onAcquisitionTiming?.({reused:true});}catch{}return runState.dino;}const previous=runState.dino,previousStage=stage;runState.dino=null;runState.renderedReferenceCache.clear();stage='backend-dispose';await previous?.dispose();stage=`${provider}-init`;const backend=await createDinoFeatureBackend({backend:provider,signal:controller.signal,onProgress});if(active!==controller||mine!==epoch){await backend.dispose();throw new DOMException('中止','AbortError');}runState.dino=backend;stage=previousStage;try{onAcquisitionTiming?.({reused:false});}catch{}return backend;};
  engineStarted=classificationNow();const outcome=await (m.type==='prepare'?prepareDinoPoseBank:m.type==='supplement'?supplementEnemyROIs:recognizeROI)(m,{...runState,cacheQuery:true,cachePartialPoses:true,signal:controller.signal,onProgress,getDino});engineReturned=true;engineEnded=classificationNow();
  const result=m.type==='prepare'?{prepared:true,timings:outcome.timings,cacheWarnings:outcome.cacheWarnings}:outcome;
  if(active!==controller||mine!==epoch)return;active=null;retainWorkerEnvelope(result,m,handlerStarted,engineStarted,engineEnded,engineReturned,'completed');post({type:'result',id,romEpoch,result});
 }catch(error){if(error?.name==='AbortError'||requestEpoch!==epoch||(controller&&active!==controller))return;const detail={name:typeof error?.name==='string'?error.name:'Error',message:String(error?.message??error),stack:typeof error?.stack==='string'?error.stack:'',stage:typeof error?.stage==='string'&&error.stage?error.stage:stage};const failure={type:'error',id,romEpoch,message:detail.message,error:detail};retainWorkerEnvelope(failure,m,handlerStarted,engineStarted,engineEnded,engineReturned,'failed');post(failure);}
};
