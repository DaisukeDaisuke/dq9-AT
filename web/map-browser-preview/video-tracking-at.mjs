import {searchAutomaticReplayInputs} from '../video-replay-factor-search.mjs?v=automatic-entry-factors-20261006-1120';
import {deriveTrackingEventEvidence,automaticSingletonSearchOptions} from '../tracking-at-event-evidence.mjs?v=enc-motion-at-20261006-1156';
import {prepareTrackingJob,openTrackingCheckpointStore,startTrackingSession,collectTrackingMotionAssociationInputs} from '../tracking-at-session.mjs?v=native-entry-links-20261006-1240';
// This is an execution budget/prior supplied by the user, never inferred from PTS.
export function videoATSearchOptions(values,tables){
 const {seed,seedProvenance,first,last,indexProvenance}=values;
 if(!/^(?:0x[\da-f]+|\d+)$/i.test(seed.trim())||!Number.isSafeInteger(Number(seed))||Number(seed)<0||Number(seed)>0xffffffff)throw Error('既知の初期seed（10進または0x付き16進）を入力してください。ファイル名からは読みません。');
 if(!seedProvenance.trim()||!indexProvenance.trim())throw Error('seedと探索index範囲の根拠を入力してください。');
 if(!/^[1-9]\d*$/.test(first)||!/^[1-9]\d*$/.test(last)||BigInt(last)<BigInt(first)||BigInt(last)>0xffffffffffffffffn||BigInt(last)-BigInt(first)+1n>0x80000000n)throw Error('有限の最終抽選index範囲（1以上、幅2^31以内）が必要です。秒数はAT回数に変換しません。');
 return {tables,domain:{kind:'known-origin-terminal-indices',origin:{kind:'initial-state-before-draw-1',initialSeed:Number(seed),provenance:seedProvenance.trim()},first,last,provenance:indexProvenance.trim(),predecessorPolicy:'post-boot-events-only'},budget:{maxInspectedIndices:65536,maxWallTimeMs:2000,chunkIndices:4096},materialization:{maxCandidatesTotal:1000}};
}
const scope={minimumProvenATCalls:0,currentVideoStateRecovered:false,unknownAlternativeRetained:true,branchCountsSummed:false};
// Conditional ROM-body/species predictions can produce single-event filters.
// Multi-event search still needs explicit event/order/gap evidence; PTS is not calls.
export function createVideoTrackingAT({getOptions,getTables=()=>({}),engineRevision,onState=()=>{},prepare=prepareTrackingJob,openStore=openTrackingCheckpointStore,startSession=startTrackingSession,loadWasm=async(kind)=>{const file=kind==='known-origin-terminal-indices'?'at_identify_stream.wasm':'at_identify.wasm';const r=await fetch(new URL('../wasm/'+file,import.meta.url));if(!r.ok)throw Error('AT WASM HTTP '+r.status);return new Uint8Array(await r.arrayBuffer());}}){
 let epoch=0,session=null,latest=null,latestNativeBodySupport=null,latestNativeMotionInputs=null,latestReplayInputs=null,storePromise=null,wasmPromises=new Map();
 const emit=(state)=>onState({...scope,...state});
 function cancel(reason='入力が変わりました。',{retainObservation=false}={}){epoch++;session?.cancel();session=null;if(!retainObservation){latest=null;latestNativeBodySupport=null;latestNativeMotionInputs=null;latestReplayInputs=null;}emit({status:'waiting',reason});}
 async function observe(bundle){
  const mine=++epoch;session?.cancel();session=null;latest=structuredClone(bundle);latestNativeBodySupport=null;latestNativeMotionInputs=null;latestReplayInputs=null;
  const snapshot=latest;emit({status:'waiting',reason:'同じ観測bundleを確認中。種類・出生・AT消費は未確定。',sightings:snapshot.sightings?.length??0});
  try{
   const replayInputs=await searchAutomaticReplayInputs(snapshot,{isCurrent:()=>mine===epoch});if(mine!==epoch)return;latestReplayInputs=replayInputs;
   // Only this newly produced tracking companion is kept out of the legacy
   // fingerprinted AT snapshot. All preexisting automatic fields remain hashed.
   const {nativeBodySupportEvidence,...automatic}=deriveTrackingEventEvidence(snapshot);
   latestNativeBodySupport=nativeBodySupportEvidence??null;
   snapshot.automaticATEventEvidence=automatic;
   latestNativeMotionInputs=collectTrackingMotionAssociationInputs(snapshot,latestNativeBodySupport);
   const chains=snapshot.conditionalATEventEvidence?.chains??[];
   if(!chains.length&&!automatic.singleEvents.length){emit({status:'waiting',reason:'映像観測を接続済み。身体と種類が一致する条件付き予測はまだありません。残差の順位だけではAT解析を開始せず、候補と未確定の可能性を保持します。',sightings:snapshot.sightings?.length??0,missingEvidence:['supported conditional body/species prediction or explicit finite event evidence'],deferredAlternatives:automatic.deferred.length,unobservedGapsRetained:true});return;}
   const options=chains.length?getOptions():automaticSingletonSearchOptions(getTables());
   options.singleEvents=automatic.singleEvents;
   // Only an actual automatic producer's explicit conditional evidence is used.
   options.chains=structuredClone(snapshot.conditionalATEventEvidence?.chains??[]);
   const job=await prepare(snapshot,options,{engineRevision,isCurrent:()=>mine===epoch,includeReplayInputHypotheses:false});if(mine!==epoch)return;
   job.replayInputHypotheses=structuredClone(replayInputs);
   if(job.nativeMotionAssociationInputs)latestNativeMotionInputs=structuredClone(job.nativeMotionAssociationInputs);
   const pending=job.gate.filter(b=>b.status==='pending');
   if(!pending.length){emit({status:'waiting',reason:'有限の抽選イベント列・順序・AT消費間隔の自動根拠を待っています。候補順位や同一追跡を別の抽選に数えません。',gate:job.gate,missingEvidence:job.missingEvidence});return;}
   // Store completion, not Worker progress, is the durable ACK boundary.
   storePromise??=openStore().catch(e=>{storePromise=null;throw e;});
   const kind=options.domain.kind;if(!wasmPromises.has(kind))wasmPromises.set(kind,loadWasm(kind).catch(e=>{wasmPromises.delete(kind);throw e;}));
   const [store,wasmBytes]=await Promise.all([storePromise,wasmPromises.get(kind)]);if(mine!==epoch)return;
   let resume=await store.load(job.checkpointKey);if(mine!==epoch)return;
   emit({status:'running',reason:chains.length?'明示された有限条件下だけを探索中。未知の代替・範囲外・現フレームまでの未観測消費は残ります。':'ROMの身体・種類の条件付き予測について、過去の単一抽選という仮説を解析中。誤観測の可能性と現在ATの全状態は残ります。',producer:automatic.producer,conditionalSingletons:automatic.singleEvents.length});
   let lastProgressAt=-Infinity,result;
   for(;;){
   session=startSession({job,wasmBytes,resume,store,onProgress:p=>{if(mine===epoch&&performance.now()-lastProgressAt>=100){lastProgressAt=performance.now();emit({status:'acknowledged',reason:'保存完了した条件付き探索区間のみ反映。現在ATは未特定。',summary:p.summary});}}});
   result=await session.done;if(mine!==epoch)return;session=null;
   if(result.status!=='budget-stopped')break;
   const next=await store.load(job.checkpointKey);if(mine!==epoch)return;
   if(!next||next.sequence<=(resume?.sequence??0))break; // No ACK progress: do not busy-loop.
   resume=next;
   emit({status:'budget-stopped',reason:'計算予算に達した区間を保存済み。残りの同じ条件付き解析を自動で続けます。',summary:result.summary});
   await new Promise(resolve=>setTimeout(resolve,50));if(mine!==epoch)return;
   }

   emit({status:result.status,reason:result.status==='complete'?'条件付きイベント状態の解析終了。誤観測・現在ATの全状態は残り、映像のAT特定完了ではありません。':'計算予算で中断。未探索範囲が残ります。',summary:result.summary});
  }catch(e){if(mine===epoch)emit({status:'waiting',reason:e.message,error:e.name!=='Error'?e.name:undefined});}
 }
 return {observe,cancel,get replayInputHypotheses(){return latestReplayInputs?structuredClone(latestReplayInputs):null;},get nativeBodySupportEvidence(){return latestNativeBodySupport?structuredClone(latestNativeBodySupport):null;},get nativeMotionAssociationInputs(){return latestNativeMotionInputs?structuredClone(latestNativeMotionInputs):null;},retry(){if(latest)return observe(latest);emit({status:'waiting',reason:'先に動画の観測bundleを作成してください。'});}};
}
