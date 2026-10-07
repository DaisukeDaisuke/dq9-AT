import {inferenceProfile,ensureInferenceAssets} from '../monster-inference-assets.mjs';
import {probeDinoWebGPU} from '../monster-dinov2.mjs?v=envelope-yield-20261007-0140';
const mounted=new WeakMap();
// Downloads are reachable only from the explicit button/prepare action. Ordinary
// playback and backend selection keep their existing cached-only behavior.
export function mountResidualInferencePreparation(document,window,{ensure=ensureInferenceAssets,probe=probeDinoWebGPU}={}){
 const select=document.getElementById('residual-inference-backend');if(!select)return null;
 if(mounted.has(select))return mounted.get(select);
 const panel=document.createElement('span'),cpuButton=document.createElement('button'),prepareButton=document.createElement('button'),cancelButton=document.createElement('button'),progress=document.createElement('progress'),status=document.createElement('span');
 const gpuTotal=inferenceProfile('webgpu').totalBytes,cpuTotal=inferenceProfile('wasm').totalBytes;
 const mib=bytes=>(bytes/1024/1024).toFixed(1);
 panel.id='residual-gpu-preparation';cpuButton.id='prepare-residual-cpu-assets';prepareButton.id='prepare-residual-gpu-assets';cancelButton.id='cancel-residual-gpu-assets';progress.id='residual-gpu-assets-progress';status.id='residual-gpu-assets-status';
 cpuButton.type=prepareButton.type=cancelButton.type='button';cpuButton.textContent=`CPU用ファイルを準備（約${mib(cpuTotal)} MiB）`;prepareButton.textContent=`GPU用ファイルを準備（約${mib(gpuTotal)} MiB）`;cancelButton.textContent='準備を中止';cancelButton.disabled=true;progress.max=gpuTotal;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','GPU用ファイルの準備進捗');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 status.textContent='CPU用はDINOv2 int8、GPU用はDINOv2 fp16です。押したボタンの4ファイルだけ（Hugging Faceの固定版DINOv2とjsDelivrの固定版ONNX Runtime）を取得し、サイズ・SHA-256検証後にブラウザへ保存します。通常再生や推論方式の選択では取得しません。';
 panel.append(cpuButton,prepareButton,cancelButton,progress,status);(select.closest('label')??select).after(panel);
 let controller=null,generation=0,disposed=false;const listeners=[];
 const listen=(node,type,fn)=>{if(!node)return;node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
 const idle=()=>{cpuButton.disabled=prepareButton.disabled=false;cancelButton.disabled=true;};
 function cancel(reason='準備を中止しました。保存済みの検証済みファイルは次回再利用します。'){
  if(!controller)return;generation++;controller.abort();controller=null;idle();progress.hidden=true;status.textContent=reason;
 }
 async function prepare(backend='webgpu'){
  if(disposed||controller)return false;
  const total=inferenceProfile(backend).totalBytes,isGPU=backend==='webgpu',label=isGPU?'GPU':'CPU';
  const mine=++generation,active=new AbortController();controller=active;cpuButton.disabled=prepareButton.disabled=true;cancelButton.disabled=false;progress.hidden=false;progress.max=total;progress.value=0;progress.setAttribute('aria-label',`${label}用ファイルの準備進捗`);status.textContent=isGPU?'WebGPU / shader-f16の対応を確認しています…':'CPU/WASM int8用の検証済みファイルを確認しています…';
  const current=()=>!disposed&&controller===active&&generation===mine&&!active.signal.aborted;
  try{
   if(isGPU)await probe({signal:active.signal});if(!current())return false;
   await ensure({backend,signal:active.signal,onProgress:p=>{
    if(!current())return;const bytes=p.totalBytes??total,loaded=p.loadedBytes;
    if(Number.isFinite(bytes)&&bytes>0){progress.max=bytes;progress.value=Math.max(0,Math.min(bytes,Number.isFinite(loaded)?loaded:0));}else progress.removeAttribute('value');
    const counts=Number.isFinite(loaded)?` ${(loaded/1024/1024).toFixed(1)} / ${(bytes/1024/1024).toFixed(1)} MiB`:'';
    status.textContent=(p.message??p.phase??`${label}用ファイルを準備中`)+counts;
   }});if(!current())return false;
   progress.max=total;progress.value=total;
   status.textContent=isGPU?'GPU用ファイルを検証して保存しました。「保存済みWebGPU fp16を優先」を選ぶと次の比較で使用します。推論方式は自動変更していません。GPU初期化・推論に失敗した場合は全件をCPU/WASMで再比較します。':'CPU/WASM int8用ファイルを検証して保存しました。次の種類比較で使用できます。推論方式は自動変更していません。';return true;
  }catch(error){if(!current())return false;status.textContent=error?.name==='AbortError'?`${label}用ファイルの準備を中止しました。`:`${label}用ファイルを準備できません: ${error?.message??error}。通常のCPU/WASM設定は変更していません。再試行は準備ボタンから行えます。`;return false;
  }finally{if(controller===active){controller=null;idle();}}
 }
 listen(cpuButton,'click',()=>{void prepare('wasm');});listen(prepareButton,'click',()=>{void prepare();});listen(cancelButton,'click',()=>cancel());
 listen(select,'change',()=>cancel('推論方式を変更したため準備を中止しました。必要なら準備ボタンで再開してください。'));
 for(const id of ['rom','comparison-file','comparison-layout'])listen(document.getElementById(id),'change',()=>cancel('入力を変更したため準備を中止しました。保存済みの検証済みファイルは保持します。'));
 listen(window,'pagehide',()=>cancel('ページを離れたため準備を中止しました。'));
 const api={prepare,prepareCPU:()=>prepare('wasm'),cancel,dispose(){if(disposed)return;cancel();disposed=true;for(const remove of listeners)remove();panel.remove();mounted.delete(select);}};mounted.set(select,api);return api;
}
