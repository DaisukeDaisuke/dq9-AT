import {indexCoverageFraction} from './at-identify-index-form.mjs';
const statusNames={complete:'宣言index範囲の探索完了','budget-stopped':'計算予算で停止',cancelled:'中止',failed:'失敗',searching:'探索中',pending:'待機',unresolved:'未解決',unconstrained:'制約なし',invalid:'入力不正'};
const hex=n=>'0x'+n.toString(16).padStart(8,'0');
export function renderIndexResult(checkpoint,{document:doc,container,progress}){
 if(checkpoint.schema!=='bounded-at-terminal-index-identification-v1')throw Error('Terminal-index result required');
 const el=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 progress.value=checkpoint.branches[0]?indexCoverageFraction(checkpoint.branches[0]):0;
 container.append(el('p',`検査済み最終抽選index数: ${checkpoint.inspectedIndices}。先行履歴の準備: ${checkpoint.warmupInspections}抽選（最終indexの探索件数には含めません）。保存済み候補レコード: ${checkpoint.materializedCandidateRecordsTotal}件。`));
 container.append(el('p','入力seedとindexを仮定すると、そのindexの32bit状態は1つです。bit31違いの出力等価状態は別indexに対応します。初期seedの実機での正しさ・絶対index・現在映像のATは未確定です。'));
 for(const b of checkpoint.branches){
  const article=el('article');article.className='result-branch';article.append(el('h3',`${b.branchId==='conditional-chain'?'入力した種抽選の条件付き仮説':'未排除の別解'} — ${statusNames[b.status]??b.status}`));
  const facts=el('dl'),fact=(k,v)=>facts.append(el('dt',k),el('dd',String(v))),m=b.candidateMaterialization;
  fact('最終イベント',b.eventBoundaryId??'確定していません');fact('最終抽選indexの候補数',b.candidateIndicesFound??'未集計（不明）');fact('種・表の述語',b.predicateExact?'入力仮説の範囲では確定':'未解決の候補を含みます');fact('宣言index範囲の探索',b.searchCompleteWithinDomain?'完了':'未完了');fact('範囲外・周期違いの可能性','保持しています');fact('画面のサンプル',`${b.sampleCandidates.length}件 / 最大16件${b.samplesTruncated?'。残りは省略':''}`);fact('保存済み候補レコード',`${m.materializedCount}件（共有上限 ${m.sharedRequestLimit}件）`);fact('宣言範囲の候補保存',m.candidateExportCompleteWithinDeclaredDomain?'範囲内の全候補を保存済み':'不完全。未探索または保存上限による省略あり');fact('発見済み候補の保存',m.allFoundCandidatesMaterialized?'発見した候補は全件保存済み':'発見済み候補も全件とは限りません');article.append(facts);
  if(b.reason)article.append(el('p',`診断: ${b.reason}`));if(b.assumptions?.length)article.append(el('p',b.assumptions.join(' / ')));
  if(b.sampleCandidates.length){const wrap=el('div');wrap.className='table-wrap';const table=el('table'),head=el('tr');for(const label of ['最終抽選index','そのindexの32bit状態','出力等価な別index（2³²周期内）'])head.append(el('th',label));table.append(head);for(const s of b.sampleCandidates){const tr=el('tr');for(const value of [s.terminalIndex,hex(s.state32),s.outputEquivalentIndexModuloFullCycle])tr.append(el('td',value));table.append(tr);}wrap.append(table);article.append(wrap);}
  const detail=el('details');detail.append(el('summary','index座標での探索済み・未探索・準備区間と保存状態'),el('pre',JSON.stringify({coordinateSystem:b.coordinateSystem,searchedIndexIntervals:b.searchedIndexIntervals,unsearchedIndexIntervals:b.unsearchedIndexIntervals,warmupIndexInterval:b.warmupIndexInterval??null,warmupDraws:b.warmupDraws,candidateMaterialization:{baseTerminalIndex:m.baseTerminalIndex,materializedCount:m.materializedCount,sharedRequestLimit:m.sharedRequestLimit,truncated:m.truncated,allFoundCandidatesMaterialized:m.allFoundCandidatesMaterialized,candidateExportCompleteWithinDeclaredDomain:m.candidateExportCompleteWithinDeclaredDomain},observationEdges:b.observationEdges,sightingEventBindings:b.sightingEventBindings},null,2)));article.append(detail);container.append(article);
 }
 const input=el('details');input.append(el('summary','探索に使った初期seed・index範囲・根拠・計算予算'),el('pre',JSON.stringify(checkpoint.inputForm??null,null,2)));container.append(input);
 container.append(el('p','別indexの出力等価状態を同じindexの2件目として数えません。候補数は枝ごとの値です。保存レコードや最大16行の表示だけを全候補とは扱いません。イベントから目視までの未知の消費、出生対応、範囲外、未探索部分は残ります。'));
}
