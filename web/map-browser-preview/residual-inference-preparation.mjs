import {inferenceProfile,ensureInferenceAssets} from '../monster-inference-assets.mjs';
import {probeDinoWebGPU} from '../monster-dinov2.mjs?v=recognition-cache-20261005-1007';
const mounted=new WeakMap();
// Downloads are reachable only from the explicit button/prepare action. Ordinary
// playback and backend selection keep their existing cached-only behavior.
export function mountResidualInferencePreparation(document,window,{ensure=ensureInferenceAssets,probe=probeDinoWebGPU}={}){
 const select=document.getElementById('residual-inference-backend');if(!select)return null;
 if(mounted.has(select))return mounted.get(select);
 const panel=document.createElement('span'),prepareButton=document.createElement('button'),cancelButton=document.createElement('button'),progress=document.createElement('progress'),status=document.createElement('span');
 const total=inferenceProfile('webgpu').totalBytes,amount=(total/1024/1024).toFixed(1);
 panel.id='residual-gpu-preparation';prepareButton.id='prepare-residual-gpu-assets';cancelButton.id='cancel-residual-gpu-assets';progress.id='residual-gpu-assets-progress';status.id='residual-gpu-assets-status';
 prepareButton.type=cancelButton.type='button';prepareButton.textContent=`GPU用ファイルを準備（約${amount} MiB）`;cancelButton.textContent='準備を中止';cancelButton.disabled=true;progress.max=total;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','GPU用ファイルの準備進捗');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 status.textContent='ボタンを押すとHugging Faceの固定版DINOv2 fp16とjsDelivrの固定版ONNX Runtimeを取得し、サイズ・SHA-256検証後にブラウザへ保存します。通常再生では取得しません。';
 panel.append(prepareButton,cancelButton,progress,status);(select.closest('label')??select).after(panel);
 let controller=null,generation=0,disposed=false;const listeners=[];
 const listen=(node,type,fn)=>{if(!node)return;node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
 const idle=()=>{prepareButton.disabled=false;cancelButton.disabled=true;};
 function cancel(reason='準備を中止しました。保存済みの検証済みファイルは次回再利用します。'){
  if(!controller)return;generation++;controller.abort();controller=null;idle();progress.hidden=true;status.textContent=reason;
 }
 async function prepare(){
  if(disposed||controller)return false;
  const mine=++generation,active=new AbortController();controller=active;prepareButton.disabled=true;cancelButton.disabled=false;progress.hidden=false;progress.value=0;status.textContent='WebGPU / shader-f16の対応を確認しています…';
  const current=()=>!disposed&&controller===active&&generation===mine&&!active.signal.aborted;
  try{
   await probe({signal:active.signal});if(!current())return false;
   await ensure({backend:'webgpu',signal:active.signal,onProgress:p=>{
    if(!current())return;const bytes=p.totalBytes??total,loaded=p.loadedBytes;
    if(Number.isFinite(bytes)&&bytes>0){progress.max=bytes;progress.value=Math.max(0,Math.min(bytes,Number.isFinite(loaded)?loaded:0));}else progress.removeAttribute('value');
    const counts=Number.isFinite(loaded)?` ${(loaded/1024/1024).toFixed(1)} / ${(bytes/1024/1024).toFixed(1)} MiB`:'';
    status.textContent=(p.message??p.phase??'GPU用ファイルを準備中')+counts;
   }});if(!current())return false;
   progress.max=total;progress.value=total;
   status.textContent='GPU用ファイルを検証して保存しました。「保存済みWebGPU fp16を優先」を選ぶと次の比較で使用します。推論方式は自動変更していません。GPU初期化・推論に失敗した場合は全件をCPU/WASMで再比較します。';return true;
  }catch(error){if(!current())return false;status.textContent=error?.name==='AbortError'?'GPU用ファイルの準備を中止しました。':`GPU用ファイルを準備できません: ${error?.message??error}。通常のCPU/WASM設定は変更していません。再試行は準備ボタンから行えます。`;return false;
  }finally{if(controller===active){controller=null;idle();}}
 }
 listen(prepareButton,'click',()=>{void prepare();});listen(cancelButton,'click',()=>cancel());
 listen(select,'change',()=>cancel('推論方式を変更したため準備を中止しました。必要なら準備ボタンで再開してください。'));
 for(const id of ['rom','comparison-file','comparison-layout'])listen(document.getElementById(id),'change',()=>cancel('入力を変更したため準備を中止しました。保存済みの検証済みファイルは保持します。'));
 listen(window,'pagehide',()=>cancel('ページを離れたため準備を中止しました。'));
 const api={prepare,cancel,dispose(){if(disposed)return;cancel();disposed=true;for(const remove of listeners)remove();panel.remove();mounted.delete(select);}};mounted.set(select,api);return api;
}
