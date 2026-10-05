import {createRendererSourceArchives} from './renderer-source-archives.mjs?v=recognition-cache-20261005-1007';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * Render the already enumerated background hypothesis on GPU before comparison.
 * No CPU reference render precedes successful GPU work. Source geometry/edges
 * remain CPU preparation; a GPU utilisation or acceleration claim is not made.
 */
import {createNativeIntegerCompute} from './native-integer-compute.mjs?v=wgsl-keyword-20261005-0834';
import {prepareInitialMode1IntegerCompute,renderPreparedIntegerCompute} from './prepare-initial-integer-compute.mjs?v=field-stream-20261005-1108';
import {renderInitialIntegerFog} from './integer-static-fog.mjs?v=field-stream-20261005-1108';
import {createSourcePreparationCache} from './integer/source-preparation-cache.mjs';

export function createAutomaticBackgroundRenderer({initialize=createNativeIntegerCompute,prepare=prepareInitialMode1IntegerCompute,renderGpu=renderPreparedIntegerCompute,renderCpu=renderInitialIntegerFog,createCache=createSourcePreparationCache,now=()=>performance.now()}={}) {
 const sourceArchives=createRendererSourceArchives();
 let initialization=null,gpu=null,generation=0;
 const begin=()=>{if(initialization)return initialization;const mine=generation;return initialization=(async()=>{try{const value=await initialize();if(mine!==generation){value?.destroy?.();return{ready:false,reason:'renderer session released'};}return gpu=value;}catch(error){return{ready:false,reason:error.message};}})();};
 async function render({project,rom,record,active,camera,screenEffectPhase=null,isCurrent=()=>true}) {
  const start=now(),timings={adapterWaitMs:0,sourcePreparationMs:0,gpuRenderAndDecodeMs:0,cpuFallbackMs:0},check=()=>{if(!isCurrent())throw new DOMException('自動背景描画を中止しました','AbortError');};
  check();const sourceProject=sourceArchives.forProject(project,rom);let reason=null,result=null;
  // These are source capability gates, not hypotheses that may be filled by a
  // selected ROM slot or elapsed video time. The CPU path keeps its own gates.
  if(active.environment?.mode!==1)reason='GPU automatic path supports source time-independent mode1 only; mode2 time/slot remains unresolved.';
  else if(!active.environmentApplied)reason='ROM material environment is unresolved.';
  else {
   let at=now();const renderer=await begin();timings.adapterWaitMs=now()-at;check();
   if(!renderer?.ready)reason='GPU unavailable: '+(renderer?.reason??'adapter not ready');
   else try {
    at=now();let job;
    try {const cache=createCache(sourceProject);job=prepare(cache.project,rom,record,active,camera,{applyFog:true,screenEffectPhase});job.evidence??={};job.evidence.automaticSourceCache={...cache.stats};job.evidence.rendererSourceArchives={...sourceArchives.stats};}
    finally {timings.sourcePreparationMs=now()-at;}
    check();at=now();try {result=await renderGpu(renderer,job);} finally {timings.gpuRenderAndDecodeMs=now()-at;}
    check();if(!result?.ready)throw Error('GPU result is not ready');
    const counts=result.diagnostics?.counts;
    if(!counts||counts.covered!==counts.known||counts.unknownTranslucentDestinationFragments!==0)throw Error('GPU translucent destination/native color remains unresolved');
   } catch(error) {if(error.name==='AbortError')throw error;reason='GPU source/compute rejected: '+error.message;result=null;}
  }
  if(!result){check();const at=now();try {result=renderCpu(project,rom,record,active,camera,{applyFog:true,screenEffectPhase});}finally {timings.cpuFallbackMs=now()-at;}}
  check();const pipeline={backend:reason?'cpu-fallback':'webgpu-source-integer-pixels',fallbackReason:reason,timings:{...timings,totalMs:now()-start},cpuReferenceRendered:false,gpuTimingScope:'Wall time includes upload, compute, readback and decode; not a GPU timestamp or utilisation metric.',scope:'Existing candidate only; no position, phase, time, slot or model sweep. Dynamic state and native parity remain unproven.'};
  return {...result,diagnostics:{...result.diagnostics,automaticBackgroundPipeline:pipeline}};
 }
 function destroy(){sourceArchives.clear();generation++;gpu?.destroy?.();gpu=null;initialization=null;}
 return {begin,render,destroy};
}
