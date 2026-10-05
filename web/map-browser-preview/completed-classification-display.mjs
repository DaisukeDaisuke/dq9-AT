// Presentation only: never assigns sightings to another frame or certifies bodies.
import {nativeSupportDisplaySummary} from './recognition-display-summary.mjs?v=native-continuation-20261006-0333';
export function completedClassificationSnapshot(value,frame,bg,regions=[]){
 if(value?.classificationJob?.complete!==true||frame?.image?.width!==256||frame?.image?.height!==192)return null;
 return {value,frameId:frame.id,evidence:structuredClone(frame.evidence),background:structuredClone(bg.evidence),image:{width:256,height:192,rgba:frame.image.rgba.slice()},regions:structuredClone(regions)};
}
function names(prediction){return (prediction?.speciesCandidates??[]).map(x=>x.nameJa??x.monsterId).join(' / ');}
function nativeComparisonLabel(branch){
 if(branch.status==='unsupported')return '未対応・不明（候補の否定ではありません）';
 if(branch.status!=='evaluated-subset'||!Number.isFinite(branch.ownGain))return '未評価・不明';
 switch(branch.nullComparison){
  case 'improves-background-only':return '背景のみより誤差減少（試行範囲内）';
  case 'ties-background-only':return '背景のみと同点（試行範囲内）';
  case 'background-preferred-for-tested-proposals':return '試行範囲では背景のみが優位（候補全体の否定ではありません）';
  default:return '比較結果は不明';
 }
}
function appendNativeSupport(container,ranking,make){
 const support=nativeSupportDisplaySummary(ranking.sourceNativeSupport);if(!support)return;
 const details=make('details');details.append(make('summary',`ROM身体比較 ${ranking.modelId} ${names(ranking)}（条件付き・候補自身と背景のみの比較）`));
 details.append(make('p','外観候補の順位・条件付き予測は変更しません。種類・身体・姿勢・カメラは未確定。非敵・無イベントの可能性を保持し、AT証明下限は0です。'));
 if(!support.branchCount)details.append(make('p','比較枝なし・不明'));
 for(const b of support.branches){
  const branch=make('li',`枝 ${b.branchId}: ${nativeComparisonLabel(b)} / 自身の誤差減少量 ${Number.isFinite(b.ownGain)?b.ownGain:'不明'} / 試行 ${b.testedProposals}件 / 未対応・未評価 ${b.unsupportedCount}件`);
  if(b.reason)branch.append(make('p',b.reason));
  if(b.best)branch.append(make('p',`試行内の最良結果（全姿勢の最良とは未確定）: ${JSON.stringify(b.best)}`));
  for(const u of b.unsupported)branch.append(make('p',`未対応・不明: ${u.reason??'詳細はJSON'}${u.unsupportedDestination?' / 合成先の条件が未対応':''}${u.remainingProposals!==undefined?' / 未評価の残り '+u.remainingProposals+'件':''}${u.errorCount?' / エラー詳細 '+u.errorCount+'件はJSON参照':''}`));
  if(b.omittedUnsupportedCount)branch.append(make('p',`未対応詳細を${b.omittedUnsupportedCount}件省略。全件はJSONに保持しています。`));
  branch.append(make('p',`仮定（要約）: ${b.assumptions===undefined?'不明':JSON.stringify(b.assumptions)}`),make('p',`残る不明の候補・条件（要約）: ${b.unknownAlternatives===undefined?'不明':JSON.stringify(b.unknownAlternatives)}`));
  const list=make('ul');list.append(branch);details.append(list);
 }
 if(support.omittedBranchCount)details.append(make('p',`比較枝を${support.omittedBranchCount}件省略。全枝はJSONに保持しています。`));
 details.append(make('p','仮定・不明条件の omittedCount は省略件数、detailsOmitted は詳細省略です。全証拠はJSONに保持しています。'));
 container.append(details);
}
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
  for(const s of visible){const r=completed.regions.find(r=>String(r.id)===String(s.originalProposalId))?.roi;if(!r)continue;ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillText(String(s.originalProposalId),Math.max(0,r.x),Math.max(10,r.y));}root.append(canvas);
 }
 root.append(make('p',`比較した残差 ${rows.length}件 / 条件付き予測 ${predicted.length}件 / 比較済み・種類未確定 ${other.length}件 / 未比較 ${(value?.unclassifiedRegionIds??[]).length}件。候補は未確定で、背景・味方・UI・候補外を除外できません。出生・AT加算の証明ではありません。`));
 const list=make('ul');for(const s of visible){const p=s.conditionalBodyPrediction;list.append(make('li',`残差 ${s.originalProposalId}: ${p?.modelId?'条件付き予測 '+(names(p)||p.modelId)+'（未確定）':'種類未確定'}`));}root.append(list);
 if(rows.length>visible.length)root.append(make('p',`概要は${visible.length}件まで表示。残り${rows.length-visible.length}件と全候補順位は詳細にあります。`));
 const details=make('details');details.append(make('summary','全残差・全候補順位・ROM身体比較を見る'));const full=make('ul');for(const s of rows){const li=make('li',`残差 ${s.originalProposalId}`),ranks=make('details');ranks.append(make('summary','候補順位（確定結果ではありません）'));for(const r of s.classificationEvidence?.[0]?.rankings??[]){ranks.append(make('p',`${r.modelId} ${names(r)}: ${r.similarity?.toFixed(4)??r.distance?.toFixed(4)??'値なし'}`));appendNativeSupport(ranks,r,make);}li.append(ranks);full.append(li);}details.append(full);root.append(details);container.replaceChildren(root);
 return {visibleCount:visible.length,predictionCount:predicted.length,completedFrameId:completed?.frameId??null};
}
