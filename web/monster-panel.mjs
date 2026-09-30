import {MonsterWebGPU,WebGPUUnavailableError} from './monster-webgpu.mjs';
import {MonsterTemplateBank,DEFAULT_TEMPLATE_VIEWS} from './monster-template-bank.mjs';
const panel=document.createElement('details');panel.className='monster-preview encounter';panel.innerHTML=`<summary>3Dモンスター素材プレビュー（静止姿勢・認識未接続）</summary>
<p>投入済みNDSから選択モデルを抽出し、WebAssemblyで形状を解釈してWebGPUで表示します。ゲームの照明・アニメーションは再現しません。</p>
<div class="monster-controls"><label>モデル <select data-model><option value="z000c">メタルスライム / z000c</option><option value="z000a">スライム / z000a</option><option value="z000b">スライムベス / z000b</option></select></label>
<label>variant <select data-variant><option value="">明示的に選択してください</option><option value="_f">_f（用途未確認）</option><option value="regular">regular（用途未確認）</option></select></label><button data-load disabled>3D表示</button><button data-clear>プレビュー解放</button></div>
<p data-status role="status" aria-live="polite">NDS未読込</p><canvas data-canvas width="640" height="480" hidden aria-label="選択したモンスターの静止モデル"></canvas>
<label>回転 <input data-yaw type="range" min="-180" max="180" value="0" disabled></label><label>見下ろし角度（仮定） <input data-pitch type="range" min="0" max="90" value="45" disabled></label>
<details class="monster-templates"><summary>自動方向テンプレート（照合は未接続）</summary>
<p>選択中の1モデルだけを小さな画像に事前描画します。映像の毎フレームや全312モデルを回しません。静止姿勢・仮定したカメラ角度です。</p>
<div class="monster-controls"><label>方向 <select data-template-views><option value="8">8方位 / 選択角度</option><option value="16">8方位 × 2角度 (±15°)</option></select></label><label>見下ろし中心角度（未校正） <select data-template-elevation><option value="30">30°</option><option value="45" selected>45°</option><option value="60">60°</option></select></label><label>1方向の解像度 <select data-template-size><option value="32">32×32</option><option value="64" selected>64×64</option><option value="128">128×128</option></select></label><button data-templates disabled>方向テンプレート生成</button><button data-template-cancel disabled>生成中止</button></div>
<p data-template-status role="status" aria-live="polite">モデル表示後に生成できます。30/60fpsの照合性能は未測定です。</p><canvas data-template-canvas hidden aria-label="WebGPUで事前生成した方向別テンプレート"></canvas><p data-template-labels></p></details>
<pre data-info></pre><p>同一モデルのspecies ID候補をすべて保持します。_fのフィールド用途は未確認。映像認識の精度、出現イベント、AT消費数の証拠にはなりません。</p>`;
document.querySelector('.workspace').append(panel);
const get=s=>panel.querySelector('[data-'+s+']'),ui=Object.fromEntries(['model','variant','load','clear','status','canvas','yaw','pitch','info','templates','template-views','template-size','template-elevation','template-cancel','template-status','template-canvas','template-labels'].map(s=>[s,get(s)]));
let loaded=false,serial=0,pending=null,renderer=null,busy=false,gpuInitQueue=Promise.resolve(),bank=null,templateLease=null,templateController=null,templateSerial=0,templateBusy=false,romSession=0;
const buttons=()=>{ui.load.disabled=!loaded||!ui.variant.value||busy;ui.yaw.disabled=!renderer?.model;ui.pitch.disabled=!renderer?.model;ui.templates.disabled=!renderer?.model||templateBusy;ui['template-cancel'].disabled=!templateBusy;};
function clearTemplates(message='方向テンプレート未生成'){templateSerial++;templateController?.abort();templateController=null;bank?.cancel();templateLease?.release();templateLease=null;templateBusy=false;ui['template-canvas'].hidden=true;ui['template-labels'].textContent='';ui['template-status'].textContent=message;}
function clear(message='プレビューを解放しました'){clearTemplates();bank?.destroy();bank=null;serial++;pending=null;busy=false;renderer?.destroy();renderer=null;ui.canvas.hidden=true;ui.info.textContent='';ui.yaw.value='0';ui.pitch.value='45';ui.status.textContent=message;buttons();}
window.addEventListener('dq9-rom-metadata',()=>{loaded=true;ui.status.textContent='variantを選び、3D表示を押してください';buttons();});
window.addEventListener('dq9-rom-release',()=>{romSession++;loaded=false;clear('NDS未読込');});
ui.clear.onclick=()=>clear();ui.variant.onchange=()=>{clear('選択を変更しました');};ui.model.onchange=()=>{clear('選択を変更しました');};
ui.load.onclick=async()=>{clear('WebGPUを準備中');const token=serial;busy=true;buttons();try{
 // A superseded initializer must dispose before another device reuses this canvas.
 const attempt=gpuInitQueue.then(async()=>{if(token!==serial)return null;const next=await MonsterWebGPU.create(ui.canvas,message=>{if(token===serial)clear(message);});if(token!==serial){next.destroy();return null;}return next;});
 gpuInitQueue=attempt.then(()=>{},()=>{});const created=await attempt;if(!created||token!==serial){created?.destroy();return;}renderer=created;bank=new MonsterTemplateBank(renderer);
 pending='monster-preview-'+token;ui.status.textContent='選択モデルをROMから抽出・WASMで解釈中';window.dispatchEvent(new CustomEvent('dq9-monster-preview-request',{detail:{requestId:pending,model:{modelId:ui.model.value,variant:ui.variant.value}}}));
 }catch(error){if(token!==serial)return;busy=false;ui.status.textContent=(error instanceof WebGPUUnavailableError?'WebGPU unavailable: ':'プレビューエラー: ')+error.message;buttons();}};
window.addEventListener('dq9-monster-preview-error',e=>{if(e.detail?.requestId!==pending)return;clear('プレビューエラー: '+e.detail.message);});
window.addEventListener('dq9-monster-preview',async e=>{if(e.detail?.requestId!==pending)return;const token=serial,p=e.detail.preview,active=renderer;try{await active.setModel(p);if(token!==serial)return;pending=null;busy=false;ui.canvas.hidden=false;ui.status.textContent=`${p.modelId} / ${p.variant}: ${p.counts.vertices}頂点・${p.counts.triangles}三角形（WASM + WebGPU / 静止姿勢）`;
 ui.info.textContent=JSON.stringify({webgpuAdapter:active.adapterInfo,speciesCandidates:p.speciesCandidates,source:p.source,pose:p.pose,materialBinding:p.materialBinding,materials:p.materials.map(({name,textureName,paletteName,width,height})=>({name,textureName,paletteName,width,height})),recognitionEvidence:false,limitations:p.limitations},null,2);buttons();
 }catch(error){if(token===serial)clear('プレビューエラー: '+error.message);}});
ui.yaw.oninput=()=>{if(renderer){renderer.yaw=Number(ui.yaw.value)*Math.PI/180;renderer.draw();}};
ui.pitch.oninput=()=>{if(renderer){renderer.pitch=Number(ui.pitch.value)*Math.PI/180;renderer.draw();}};
window.addEventListener('pagehide',()=>clear());

ui['template-cancel'].onclick=()=>{clearTemplates('生成を中止しました。途中の結果は使いません');buttons();};
for(const key of ['template-views','template-size','template-elevation'])ui[key].onchange=()=>{clearTemplates('方向・解像度を変更しました');buttons();};
ui.templates.onclick=async()=>{
 if(!renderer?.model||!bank)return;clearTemplates('WebGPUで方向テンプレートを準備中');const token=templateSerial,active=renderer,activeBank=bank,model=renderer.model,controller=new AbortController();templateController=controller;templateBusy=true;buttons();
 const elevation=Number(ui['template-elevation'].value)*Math.PI/180,views=Number(ui['template-views'].value)===16?[...DEFAULT_TEMPLATE_VIEWS.map(v=>({...v,pitch:elevation-Math.PI/12})),...DEFAULT_TEMPLATE_VIEWS.map(v=>({...v,pitch:elevation+Math.PI/12}))]:DEFAULT_TEMPLATE_VIEWS.map(v=>({...v,pitch:elevation}));
 try{const lease=await activeBank.generate([model],{sessionKey:'rom-'+romSession,views,tileSize:Number(ui['template-size'].value),signal:controller.signal,candidateScope:'explicit',onProgress:p=>{if(token===templateSerial)ui['template-status'].textContent=`${p.modelId}: ${p.completedViews}/${p.totalViews}方向 ${p.cacheHit?'(cache)':''}`;}});
  if(token!==templateSerial){lease.release();return;}templateLease=lease;const atlas=lease.entries[0].atlas,rgba=await active.readTemplateAtlas(atlas,controller.signal);if(token!==templateSerial)return;
  const canvas=ui['template-canvas'];canvas.width=atlas.width;canvas.height=atlas.height;canvas.getContext('2d').putImageData(new ImageData(rgba,atlas.width,atlas.height),0,0);canvas.hidden=false;
  ui['template-labels'].textContent=atlas.views.map((v,i)=>`${i+1}: yaw ${Math.round(v.yaw*180/Math.PI)}° / 見下ろし ${Math.round(v.pitch*180/Math.PI)}°`).join(' · ');
  ui['template-status'].textContent=`${atlas.views.length}方向 × ${atlas.tileSize}px · GPU cache ${(lease.stats.logicalCacheBytes/1024).toFixed(0)} KiB · 今回生成 ${lease.stats.generatedModels}モデル / cache hit ${lease.stats.cacheHits} · 準備 ${Math.round(lease.stats.wallMs)}ms（fps測定・認識結果ではありません）`;
 }catch(error){if(token===templateSerial){templateLease?.release();templateLease=null;ui['template-canvas'].hidden=true;ui['template-status'].textContent=error.name==='AbortError'?'生成を中止しました':'方向テンプレートエラー: '+error.message;}}
 finally{if(token===templateSerial){templateBusy=false;templateController=null;buttons();}}
};
