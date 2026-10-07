import {createRendererSourceArchives} from './renderer-source-archives.mjs?v=recognition-cache-20261005-1007';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * Render the already enumerated background hypothesis on GPU before comparison.
 * No CPU reference render precedes successful GPU work. Source geometry/edges
 * remain CPU preparation; a GPU utilisation or acceleration claim is not made.
 */
import {createNativeIntegerCompute} from './native-integer-compute.mjs?v=wgsl-keyword-20261005-0834';
import {prepareInitialMode1IntegerComputeAsync as prepareInitialMode1IntegerCompute,renderPreparedIntegerCompute} from './prepare-initial-integer-compute.mjs?v=fair-source-yield-20261007-0247';
import {renderInitialIntegerFogAsync} from './integer-static-fog.mjs?v=rgb-dependency-optin-20261007-0943';
import {createSourcePreparationCache} from './integer/source-preparation-cache.mjs?v=automatic-playback-source-cache-20261006-1100';

// Constant-size aggregates for one original preparation/render branch. The
// synchronous segment clock is wall time with no cooperative await inside it;
// wait elapsed includes browser scheduling/other work and is not CPU idle time.
function cooperativeTiming(){
 const value={segments:0,synchronousSegmentWallMs:0,maximumSynchronousSegmentWallMs:0,maximumSegmentEndingBoundary:null,yields:0,cooperativeWaitElapsedMs:0,maximumCooperativeWaitElapsedMs:0,rejectedYields:0,segmentStreamCompleted:false,lastBoundary:null,invalidTimingEvents:0,yieldPolicy:null};
 return{onSegment(event){try{if(!Number.isFinite(event?.elapsedMs)||event.elapsedMs<0){value.invalidTimingEvents++;return;}value.segments++;value.synchronousSegmentWallMs+=event.elapsedMs;if(event.elapsedMs>value.maximumSynchronousSegmentWallMs){value.maximumSynchronousSegmentWallMs=event.elapsedMs;value.maximumSegmentEndingBoundary=typeof event.boundary==='string'?event.boundary.slice(0,96):null;}value.segmentStreamCompleted=event.done===true;value.lastBoundary=typeof event.boundary==='string'?event.boundary.slice(0,96):null;}catch{}},onYieldTiming(event){try{if(!Number.isFinite(event?.elapsedMs)||event.elapsedMs<0){value.invalidTimingEvents++;return;}value.yields++;if(['message-channel-task','scheduler-yield-fallback','timer-task-fallback','explicit-caller-yield'].includes(event.yieldPolicy))value.yieldPolicy=value.yieldPolicy===null||value.yieldPolicy===event.yieldPolicy?event.yieldPolicy:'mixed';value.cooperativeWaitElapsedMs+=event.elapsedMs;value.maximumCooperativeWaitElapsedMs=Math.max(value.maximumCooperativeWaitElapsedMs,event.elapsedMs);if(event.completed!==true)value.rejectedYields++;}catch{}},snapshot(elapsedMs){return{...value,observed:value.segments>0||value.yields>0,phaseElapsedMs:elapsedMs,unattributedElapsedMs:elapsedMs-value.synchronousSegmentWallMs-value.cooperativeWaitElapsedMs,coverageComplete:value.segmentStreamCompleted,scope:'Completed synchronous segment wall time and existing cooperative yield elapsed only. No CPU utilization or idle-time inference; thrown/cancelled final segments and other phase overhead may remain unattributed.'};}};
}

export function createAutomaticBackgroundRenderer({initialize=createNativeIntegerCompute,prepare=prepareInitialMode1IntegerCompute,renderGpu=renderPreparedIntegerCompute,renderCpu=renderInitialIntegerFogAsync,createCache=createSourcePreparationCache,now=()=>performance.now()}={}) {
 const sourceArchives=createRendererSourceArchives();
 let initialization=null,gpu=null,generation=0;
 const begin=()=>{if(initialization)return initialization;const mine=generation;return initialization=(async()=>{try{const value=await initialize();if(mine!==generation){value?.destroy?.();return{ready:false,reason:'renderer session released'};}return gpu=value;}catch(error){return{ready:false,reason:error.message};}})();};
 async function render({project,rom,record,active,camera,screenEffectPhase=null,isCurrent=()=>true}) {
  const mine=generation,start=now(),timings={adapterWaitMs:0,sourcePreparationMs:0,gpuRenderAndDecodeMs:0,cpuFallbackMs:0},performanceSpans=[],phase=(name,at)=>{const endedAtMs=now();performanceSpans.push({phase:name,startedAtMs:at,endedAtMs,durationMs:endedAtMs-at,kind:'async-elapsed-not-CPU-time'});return endedAtMs-at;},check=()=>{if(mine!==generation||!isCurrent())throw new DOMException('自動背景描画を中止しました','AbortError');};
  const preparationWork=cooperativeTiming(),fallbackWork=cooperativeTiming();
  const pipeline=()=>({backend:reason?'cpu-fallback':'webgpu-source-integer-pixels',fallbackReason:reason,timings:{...timings,totalMs:now()-start},performanceTimeOrigin:globalThis.performance?.timeOrigin??null,performanceSpans,cpuReferenceRendered:false,gpuTimingScope:'Wall time includes upload, compute, readback and decode; not a GPU timestamp or utilisation metric. Performance spans share the page clock for overlap with callback gaps and browser long tasks; they are not synchronous CPU durations.',cooperativeWork:{sourcePreparation:preparationWork.snapshot(timings.sourcePreparationMs),cpuFallback:fallbackWork.snapshot(timings.cpuFallbackMs),diagnosticOnly:true},scope:'Existing candidate only; no position, phase, time, slot or model sweep. Dynamic state and native parity remain unproven.'});
  let reason=null,result=null;
  try{
  check();const sourceProject=sourceArchives.forProject(project,rom);
  // These are source capability gates, not hypotheses that may be filled by a
  // selected ROM slot or elapsed video time. The CPU path keeps its own gates.
  if(active.environment?.mode!==1)reason='GPU automatic path supports source time-independent mode1 only; mode2 time/slot remains unresolved.';
  else if(!active.environmentApplied)reason='ROM material environment is unresolved.';
  else {
   let at=now();const renderer=await begin();timings.adapterWaitMs=phase('adapter-wait',at);check();
   if(!renderer?.ready)reason='GPU unavailable: '+(renderer?.reason??'adapter not ready');
   else try {
    at=now();let job,cache;
    try {cache=createCache(sourceProject);job=await prepare(cache.project,rom,record,active,camera,{applyFog:true,screenEffectPhase,isCurrent:()=>mine===generation&&isCurrent(),onSegment:preparationWork.onSegment,onYieldTiming:preparationWork.onYieldTiming});job.evidence??={};job.evidence.automaticSourceCache={...cache.stats};job.evidence.rendererSourceArchives={...sourceArchives.stats};}
    finally {cache?.dispose?.();timings.sourcePreparationMs=phase('source-preparation',at);}
    check();at=now();try {result=await renderGpu(renderer,job);} finally {timings.gpuRenderAndDecodeMs=phase('gpu-render-and-decode',at);}
    check();if(!result?.ready)throw Error('GPU result is not ready');
    const counts=result.diagnostics?.counts;
    if(!counts||counts.covered!==counts.known||counts.unknownTranslucentDestinationFragments!==0)throw Error('GPU translucent destination/native color remains unresolved');
   } catch(error) {if(error.name==='AbortError')throw error;reason='GPU source/compute rejected: '+error.message;result=null;}
  }
  if(!result){check();const at=now();try {result=await renderCpu(project,rom,record,active,camera,{applyFog:true,screenEffectPhase,retainBodyDestination:true,isCurrent:()=>mine===generation&&isCurrent(),onSegment:fallbackWork.onSegment,onYieldTiming:fallbackWork.onYieldTiming});}finally {timings.cpuFallbackMs=phase('cpu-fallback',at);}}
  check();return {...result,diagnostics:{...result.diagnostics,automaticBackgroundPipeline:{...pipeline(),status:result?.ready===false?'unsupported':'completed'}}};
  }catch(error){try{Object.defineProperty(error,'automaticBackgroundPipeline',{value:{...pipeline(),backend:reason?'cpu-fallback':'unresolved-or-interrupted',completedResult:false,status:error?.name==='AbortError'?'cancelled':'threw',errorName:error?.name??'Error'},configurable:true});}catch{/* Optional diagnostics never replace the original error. */}throw error;}

 }
 function destroy(){sourceArchives.clear();generation++;gpu?.destroy?.();gpu=null;initialization=null;}
 return {begin,render,destroy};
}
