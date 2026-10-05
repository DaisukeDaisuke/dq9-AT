import {annotateResidualRegions,selectResidualDisplay} from './residual-region-display.mjs';
import {FileVideoInput} from '../file-video-input.mjs';
import {gameplayVideoROI,sampleGameplayFrame,compareMapBackground} from './map-video-residual.mjs';
const $=id=>document.getElementById(id),sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const draw=(id,image)=>{const canvas=$(id);canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(new ImageData(image.rgba,image.width,image.height),0,0);};
export function mountMapVideoComparison({renderBackground,derivePlayerBackground,deriveMapBackground,classifyResiduals,cancelPending=()=>{}}){
 const video=$('comparison-video');let file=null,frozen=null,background=null,comparison=null,revision=0,captureSerial=0,classification=null,classificationEpoch=0;
 const status=text=>{$('comparison-status').textContent=text;};
 function clearResult(){$('classify-residual-eight').disabled=true;cancelPending();classificationEpoch++;comparison=null;classification=null;$('residual-classification-results').textContent='';$('residual-classification-summary').replaceChildren();$('download-residual-observations').disabled=true;$('residual-regions').replaceChildren();$('withheld-residual-regions').replaceChildren();$('residual-display-status').textContent='';$('comparison-details').textContent='';for(const id of['comparison-overlay','comparison-residual'])$(id).getContext('2d').clearRect(0,0,256,192);$('compare-background').disabled=true;$('download-comparison').disabled=true;}
 function invalidate(reason){background=null;clearResult();if(frozen)status(reason+' 固定した映像に対して背景を再描画してください。');}
 function clearFrame(reason){cancelPending();$('name-input-details').textContent='';$('name-input-candidates').replaceChildren();$('name-input-status').textContent='同じ固定上画面の名前を待機しています。';$('comparison-upper').getContext('2d').clearRect(0,0,256,192);$('marker-details').textContent='';$('marker-status').textContent='同じ固定フレームの上画面を待機しています。';revision++;frozen=null;background=null;clearResult();$('comparison-gameplay').getContext('2d').clearRect(0,0,256,192);status(reason);}
 const source=new FileVideoInput(video,()=>{},e=>status(e.message),reason=>clearFrame(reason==='seek'?'シーク中です。到達後に比較フレームを固定してください。':'動画が変わりました。比較フレームを固定してください。'));
 source.interval=0;
 $('comparison-file').onchange=()=>{file=$('comparison-file').files[0]??null;clearFrame('動画を選択してください。');if(file)source.load(file);else source.stop();};
 video.addEventListener('loadedmetadata',()=>{$('comparison-time').max=String(video.duration);$('freeze-frame').disabled=false;status(`${video.videoWidth}×${video.videoHeight} / ${video.duration.toFixed(3)}秒。画面配置を選び、比較したい時刻で固定してください。`);});
 video.addEventListener('timeupdate',()=>{$('comparison-playback-time').textContent=video.currentTime.toFixed(3)+'秒';});
 $('comparison-layout').onchange=()=>clearFrame('画面配置を変更しました。比較フレームを固定し直してください。');
 $('comparison-seek').onclick=()=>{try{const value=Number($('comparison-time').value);if(!source.url||!Number.isFinite(value)||value<0||value>=video.duration)throw Error('動画内の時刻を指定してください');video.pause();video.currentTime=value;}catch(e){status(e.message);}};
 $('freeze-frame').onclick=async()=>{const mine=++revision;try{
  if(!source.url||video.readyState<2||video.seeking)throw Error('動画の読込・シーク完了後に固定してください');video.pause();const stamp=source.snapshot(),width=video.videoWidth,height=video.videoHeight,layout=$('comparison-layout').value,roi=gameplayVideoROI(width,height,layout),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(video,0,0);const full=context.getImageData(0,0,width,height),image=sampleGameplayFrame({width,height,rgba:full.data},roi),fullSHA=await sha(full.data),rgbaSHA=await sha(image.rgba);if(mine!==revision)return;
  frozen={id:++captureSerial,image,sourceImage:{width,height,rgba:full.data.slice()},evidence:{...stamp,filename:file.name,bytes:file.size,sourceSize:{width,height},layout,roi,fullRGBA_SHA256:fullSHA,gameplayRGBA_SHA256:rgbaSHA,sampling:'pixel-center-bilinear-256x192',timeScope:'HTMLMediaElement.currentTime is approximate; full decoded RGBA hash identifies the actual frozen pixels.'}};background=null;clearResult();draw('comparison-gameplay',image);status('映像を固定しました。地図の同じ位置・床・向きを指定して背景を描画してください。');await renderCurrent();
 }catch(e){if(mine===revision){clearFrame('比較フレームを固定できません：'+e.message);console.error(e);}}};
 async function renderCurrent(){
  if(!frozen)return;const targetFrameId=frozen.id;
  if($('automatic-map-name').checked){
   try{await deriveMapBackground({sourceImage:frozen.sourceImage,layout:frozen.evidence.layout,frameEvidence:frozen.evidence,frameId:frozen.id});}
   catch(e){if(frozen?.id!==targetFrameId)return;invalidate('同フレームのマップ候補が未解決です。');$('name-input-status').textContent=e.message;}
  }else if($('automatic-player').checked){
   $('marker-status').textContent='同じ上画面のマーカーとROM地図を照合しています…';
   try{await derivePlayerBackground({sourceImage:frozen.sourceImage,layout:frozen.evidence.layout,frameEvidence:frozen.evidence,frameId:frozen.id});}
   catch(e){if(frozen?.id!==targetFrameId)return;invalidate('上画面からの描画条件が未解決です。');$('marker-status').textContent=e.message;}
  }else await renderBackground();
 }
 $('automatic-map-name').onchange=()=>{cancelPending();invalidate('地図名の供給方式が変わりました。');renderCurrent().catch(e=>status(e.message));};
 $('cancel-map-name').onclick=()=>{cancelPending();status('名前照合を中止しました。未完候補から背景は選びません。');};
 $('automatic-player').onchange=()=>{invalidate('カメラ供給方式を変更しました。');renderCurrent().catch(e=>status(e.message));};
 function display(){if(!comparison||!frozen)return;const mix=Number($('overlay-mix').value)/100,rgba=new Uint8ClampedArray(frozen.image.rgba);for(let i=0;i<256*192;i++)if(comparison.validMask[i])for(let c=0;c<3;c++)rgba[i*4+c]=frozen.image.rgba[i*4+c]*(1-mix)+comparison.alignedBackground[i*4+c]*mix;draw('comparison-overlay',{width:256,height:192,rgba});draw('comparison-residual',{width:256,height:192,rgba:comparison.heatmap});
  const displayRegions=selectResidualDisplay(comparison.annotatedRegions,{minimumPixels:Number($('residual-minimum-pixels').value),maximumSmallWidth:Number($('residual-small-width').value),maximumSmallHeight:Number($('residual-small-height').value)});
  $('residual-display-status').textContent=`表示 ${displayRegions.visibleCount}/${displayRegions.rawCount}領域・内部の小領域${displayRegions.withheldCount}件を別欄へ保留・小さい端/未描画境界${displayRegions.retainedSmallBoundaryCount}件は保持。小領域にも遠方の敵が含まれ得ます。`;
  $('withheld-residual-regions').replaceChildren(...displayRegions.withheldForDisplay.map(c=>{const li=document.createElement('li');li.textContent=`領域${c.id}: (${c.roi.x},${c.roi.y}) ${c.roi.w}×${c.roi.h} / ${c.pixels}画素（存在/種類は未確定）`;return li;}));
  const ctx=$('comparison-overlay').getContext('2d');ctx.strokeStyle='#ffdc68';ctx.lineWidth=1;
  // Every component remains in the record/list. No minimum area, NMS, top-k, or enemy gate.
  for(const item of displayRegions.visible){const b=item.roi;ctx.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);}
 }
 function compare(){try{classificationEpoch++;cancelPending();classification=null;$('residual-classification-summary').replaceChildren();$('residual-classification-results').textContent='';$('download-residual-observations').disabled=true;if(!frozen||!background||background.frameId!==frozen.id)throw Error('現在の固定映像と背景の組がありません。再描画してください');comparison=compareMapBackground(background.image,frozen.image,{applyTranslation:$('apply-translation').checked});comparison.annotatedRegions=annotateResidualRegions(comparison,frozen.image);$('classify-residual-eight').disabled=!comparison.components.length;display();const a=comparison.alignment,s=comparison.stats;
  $('residual-regions').replaceChildren(...comparison.components.map(c=>{const li=document.createElement('li');li.textContent=`未分類領域 ${c.id}: (${c.roi.x}, ${c.roi.y}) ${c.roi.w}×${c.roi.h} / ${c.pixels}画素`;const b=document.createElement('button');b.textContent='この自動領域をROM候補と比較';b.onclick=()=>classify([c.id]);li.append(b);return li;}));
  const state=comparison.state==='alignment-unresolved'?'位置合わせが未成立のため領域仮説を出していません。地図位置・床・向きを確認してください。':comparison.state==='background-unavailable'?'比較できる不透明背景がありません。':`未分類の残差領域 ${comparison.components.length}件。敵・味方・UI・描画誤差の区別は未確定です。`;
  status(`${state}\n小さな平行ずれの推定: (${a.dx}, ${a.dy})px / 既存基準 ${a.reliable?'通過（カメラ一致の証明ではありません）':'不通過'} / 適用 (${a.applied.dx}, ${a.applied.dy})px\n比較 ${s.comparedPixels}/49152画素・未描画/半透明/画像外 ${s.unavailablePixels}画素・RGB平均差 ${s.rgbMAE?.toFixed(3)??'未計算'}。背景はROM初期カメラ仮説、現在のゲームカメラ・動的物体は未確認です。適用した描画経路と霧の条件は詳細に記録します。`);
  const record={version:1,kind:'rom-map-video-background-comparison',video:frozen.evidence,background:background.evidence,alignment:comparison.alignment,stats:comparison.stats,state:comparison.state,components:comparison.components,regionDiagnostics:comparison.annotatedRegions,displayOnly:selectResidualDisplay(comparison.annotatedRegions,{minimumPixels:Number($('residual-minimum-pixels').value),maximumSmallWidth:Number($('residual-small-width').value),maximumSmallHeight:Number($('residual-small-height').value)}),scope:comparison.scope,unknown:true,bodyCertified:false,birthCertified:false,speciesKnown:false,minimumProvenATCalls:0};$('comparison-details').textContent=JSON.stringify(record,null,2);$('download-comparison').disabled=false;
 }catch(e){$('download-comparison').disabled=true;status('比較できません：'+e.message);}};
 $('residual-small-width').onchange=$('residual-small-height').onchange=()=>{if(background&&frozen)compare();};$('compare-background').onclick=compare;$('apply-translation').onchange=()=>{if(background&&frozen)compare();};$('overlay-mix').oninput=display;$('residual-minimum-pixels').onchange=()=>{if(background&&frozen)compare();};
 function showClassification(value){
  $('residual-classification-summary').replaceChildren(...value.sightings.map(s=>{const li=document.createElement('li'),head=document.createElement('strong');head.textContent='自動残差 '+s.originalProposalId+' / 種類未確定';li.append(head);for(const r of s.classificationEvidence[0].rankings){const p=document.createElement('p');p.textContent=`${r.modelId} ${r.speciesCandidates.map(v=>v.nameJa??v.monsterId).join(' / ')}: ${r.similarity?.toFixed(4)??r.distance?.toFixed(4)}`;li.append(p);}return li;}));
  $('residual-classification-results').textContent=JSON.stringify(value,null,2);
 }
 async function classify(ids){
  if(!comparison||!frozen||!background)return;const frame=frozen,bg=background,cmp=comparison,job=++classificationEpoch;
  $('residual-classification-status').textContent='同frameの背景残差cropとROM候補モデルを比較しています…';
  try{
   const digest=await sha(bg.image.rgba);if(job!==classificationEpoch||frame!==frozen||bg!==background||cmp!==comparison)return;
   const value=await classifyResiduals({regionIds:ids,regions:cmp.components,sourceImage:frame.sourceImage,videoEvidence:frame.evidence,backgroundEvidence:bg.evidence,backgroundRGBA_SHA256:digest,onPartial:value=>{if(job===classificationEpoch&&frame===frozen&&bg===background){classification=value;showClassification(value);$('download-residual-observations').disabled=false;}},onProgress:p=>{if(job===classificationEpoch&&frame===frozen&&bg===background)$('residual-classification-status').textContent=p.message??p.phase??'比較中';}});
   if(job!==classificationEpoch||frame!==frozen||bg!==background||cmp!==comparison)return;classification=value;
   $('residual-classification-status').textContent=`比較した残差${value.sightings.length}件、未比較${value.unclassifiedRegionIds.length}件。順位は候補で、背景・味方・UI・候補外を除外できません。出生/AT加算なし。`;
   showClassification(value);$('download-residual-observations').disabled=false;
  }catch(e){if(job===classificationEpoch&&frame===frozen&&bg===background)$('residual-classification-status').textContent='比較未完: '+e.message;}
 }
 $('classify-residual-eight').onclick=()=>{if(comparison)classify(comparison.components.slice(0,8).map(r=>r.id));};
 $('cancel-residual-classification').onclick=()=>cancelPending();$('residual-model-variant').onchange=()=>{classificationEpoch++;cancelPending();classification=null;$('residual-classification-results').textContent='';$('residual-classification-summary').replaceChildren();$('download-residual-observations').disabled=true;};
 $('download-residual-observations').onclick=()=>{if(!classification)return;const url=URL.createObjectURL(new Blob([JSON.stringify(classification,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='background-residual-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('download-comparison').onclick=()=>{if(!comparison)return;const url=URL.createObjectURL(new Blob([$('comparison-details').textContent],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='map-video-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return{invalidate,renderCurrent,frameId:()=>frozen?.id??null,setBackground(image,evidence,frameId){if(!frozen||frameId!==frozen.id)return false;background={frameId,image:{width:image.width,height:image.height,rgba:image.rgba.slice()},evidence:structuredClone(evidence)};clearResult();$('compare-background').disabled=false;status('固定した映像と背景が揃いました。重ね表示と差分を比較できます。');compare();return true;}};
}
