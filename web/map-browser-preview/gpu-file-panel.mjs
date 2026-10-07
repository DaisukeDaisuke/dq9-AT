/* SPDX-License-Identifier: GPL-2.0-or-later */
import {createNativeIntegerCompute} from './native-integer-compute.mjs?v=wgsl-keyword-20261005-0834';
import {renderPreparedIntegerCompute} from './prepare-initial-integer-compute.mjs?v=fair-source-yield-20261007-0247';
import {automaticGpuBinding,prepareAutomaticGpuInput,compareAutomaticGpuPixels} from './automatic-gpu-input.mjs?v=fair-source-yield-20261007-0247';

// Retain at most the last immutable selected-result object, not a frame library.
export function createAutomaticGpuSession({initialize=createNativeIntegerCompute,prepare=prepareAutomaticGpuInput,render=renderPreparedIntegerCompute,publish=()=>{}}={}) {
 let initialization=null,renderer=null,epoch=0,cached=null;
 const begin=()=>initialization??=(async()=>{try{return renderer=await initialize();}catch(error){return renderer={ready:false,reason:error.message};}})();
 function invalidate(){epoch++;cached=null;publish({state:'waiting',message:'現在のROM・動画フレームの自動探索結果を待っています。',image:null});}
 async function run({project,rom,result,frameEvidence,isCurrent=()=>true}) {
  const mine=++epoch,binding=automaticGpuBinding(result,frameEvidence),current=()=>mine===epoch&&isCurrent();
  const emit=value=>{if(current())publish({...value,binding});};
  const pipeline=result.selected?.integer?.diagnostics?.automaticBackgroundPipeline;
  if(pipeline?.backend==='webgpu-source-integer-pixels'){emit({state:'gpu-background-used',message:'この背景はGPUで描画してから映像との比較に使用しました。CPUとの画素一致・実機一致・全入力対応は未検証です。',diagnostics:result.selected.integer.diagnostics,image:result.selected.image,scope:pipeline.scope});return;}
  if(pipeline){emit({state:'cpu-background-fallback',message:'GPU経路の条件が成立しないため、通常のCPU背景比較を使用しました。理由と処理時間を保持しています。',diagnostics:result.selected.integer.diagnostics,reason:pipeline.fallbackReason,image:null,scope:pipeline.scope});return;}
  emit({state:'preparing',message:'同じ自動背景候補のGPU入力を準備しています…',image:null});
  const gpu=await begin();if(!current())return;
  // Surface the missing adapter without preventing CPU map recognition.
  if(!gpu.ready){emit({state:'gpu-unavailable',message:'GPUを利用できません: '+gpu.reason+'。地図・位置候補と通常のCPU比較は保持します。',reason:gpu.reason});return;}
  try{
   if(!cached||cached.result!==result||cached.project!==project||cached.rom!==rom)cached={result,project,rom,value:prepare({project,rom,result})};
   const input=cached.value;if(!input.ready){emit({state:'source-unresolved',message:input.reason,source:input});return;}
   if(!current())return;const image=await render(gpu,input.job);if(!current())return;
   const comparison=compareAutomaticGpuPixels(input.cpu,image);
   emit({state:comparison.equal?'same-input-rgba-equal':'same-input-rgba-differs',message:comparison.equal?'同じ背景候補のCPU/GPU表示画素が一致しました。映像・実機との一致や全入力対応の証明ではありません。':'同じ背景候補のCPU/GPU表示画素が異なります。CPU結果と未一致を保持しています。',comparison,diagnostics:image.diagnostics,image,scope:input.scope});
  }catch(error){emit({state:'source-or-gpu-unresolved',message:'GPU比較は未完です: '+error.message+'。自動探索の地図・位置とCPU結果は保持しています。',reason:error.message});}
 }
 function destroy(){invalidate();renderer?.destroy?.();initialization=null;renderer=null;}
 return {begin,invalidate,run,destroy};
}
export function mountAutomaticGpuPanel(root=document) {
 const state=root.getElementById('gpu-file-status'),details=root.getElementById('gpu-file-details'),canvas=root.getElementById('gpu-file-image');
 return createAutomaticGpuSession({publish:value=>{state.textContent=value.message;const {image,...evidence}=value;details.textContent=JSON.stringify(evidence,null,2);if(image)canvas.getContext('2d').putImageData(new ImageData(image.rgba,image.width,image.height),0,0);else canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}});
}
