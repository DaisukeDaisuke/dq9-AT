// Presentation only: never assigns sightings to another frame or certifies bodies.
export function completedClassificationSnapshot(value,frame,bg,regions=[]){
 if(value?.classificationJob?.complete!==true||frame?.image?.width!==256||frame?.image?.height!==192)return null;
 return {value,frameId:frame.id,evidence:structuredClone(frame.evidence),background:structuredClone(bg.evidence),image:{width:256,height:192,rgba:frame.image.rgba.slice()},regions:structuredClone(regions)};
}
function names(prediction){return (prediction?.speciesCandidates??[]).map(x=>x.nameJa??x.monsterId).join(' / ');}
export function renderClassificationSummary(container,value,{completed=null,document:doc=globalThis.document}={}){
 const make=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const rows=value?.sightings??[],predicted=rows.filter(s=>s.conditionalBodyPrediction?.modelId),other=rows.filter(s=>!s.conditionalBodyPrediction?.modelId),visible=[...predicted,...other].slice(0,8),root=make('li');
 root.dataset.completedFrame=completed?String(completed.frameId):'';
 if(completed){
  const pts=completed.evidence.mediaTime,map=completed.background;
  root.append(make('strong',`最新の比較完了フレーム / 元映像 PTS ${Number.isFinite(pts)?pts.toFixed(3)+'秒':'不明'} / map ${map.mapId??'不明'} / ${map.fieldCode??map.recordKey??''}`));
  root.append(make('p','下の画像・枠・候補はこの過去の固定フレームの結果です。再生中の現在フレームを示していません。'));
  const canvas=make('canvas');canvas.width=256;canvas.height=192;canvas.style.width='256px';canvas.style.height='192px';canvas.style.maxWidth='100%';canvas.setAttribute('aria-label','比較が完了した元の固定映像と残差枠');
  const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(completed.image.rgba,256,192),0,0);ctx.strokeStyle='#ffcc00';ctx.lineWidth=1;ctx.font='10px sans-serif';ctx.fillStyle='#ffcc00';
  for(const s of visible){const r=completed.regions.find(r=>r.id===s.originalProposalId)?.roi;if(!r)continue;ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillText(String(s.originalProposalId),Math.max(0,r.x),Math.max(10,r.y));}root.append(canvas);
 }
 root.append(make('p',`比較した残差 ${rows.length}件 / 条件付き予測 ${predicted.length}件 / 比較済み・種類未確定 ${other.length}件 / 未比較 ${(value?.unclassifiedRegionIds??[]).length}件。候補は未確定で、背景・味方・UI・候補外を除外できません。出生・AT加算の証明ではありません。`));
 const list=make('ul');for(const s of visible){const p=s.conditionalBodyPrediction;list.append(make('li',`残差 ${s.originalProposalId}: ${p?.modelId?'条件付き予測 '+(names(p)||p.modelId)+'（未確定）':'種類未確定'}`));}root.append(list);
 if(rows.length>visible.length)root.append(make('p',`概要は${visible.length}件まで表示。残り${rows.length-visible.length}件と全候補順位は詳細にあります。`));
 const details=make('details');details.append(make('summary','全残差・全候補順位を見る'));const full=make('ul');for(const s of rows){const li=make('li',`残差 ${s.originalProposalId}`),ranks=make('details');ranks.append(make('summary','候補順位（確定結果ではありません）'));for(const r of s.classificationEvidence?.[0]?.rankings??[])ranks.append(make('p',`${r.modelId} ${names(r)}: ${r.similarity?.toFixed(4)??r.distance?.toFixed(4)??'値なし'}`));li.append(ranks);full.append(li);}details.append(full);root.append(details);container.replaceChildren(root);
 return {visibleCount:visible.length,predictionCount:predicted.length,completedFrameId:completed?.frameId??null};
}
