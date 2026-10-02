import {CANDIDATE_FORECAST_KEY,CANDIDATE_FORECAST_BUDGET,readCandidateResult,verifyCandidateAssociation,candidateCoverage} from './at-candidate-forecast.mjs';
export const candidateForecastMarkup=`<details id="at-candidate-panel"><summary>識別したAT候補で次の対象を比較</summary><div class="at-controls"><label class="file-button">識別結果JSONを読む<input id="at-candidate-file" type="file" accept=".json,application/json"></label><button id="at-candidate-clear">候補を解除</button></div><p id="at-candidate-source" class="muted">候補未読込。識別画面から戻すか、保存した結果JSONを選択してください。</p><div class="at-controls"><label>最終抽選→比較参照点の消費 <select id="at-candidate-gap"><option value="unknown">不明（0とは扱わない）</option><option value="bounded">根拠・仮定つき有限範囲</option></select></label><label>最小 <input id="at-candidate-min" type="number" min="0" max="1000000" placeholder="未入力"></label><label>最大 <input id="at-candidate-max" type="number" min="0" max="1000000" placeholder="未入力"></label><label>根拠・仮定 <input id="at-candidate-basis" maxlength="300" placeholder="何を参照点とするかも明記"></label><button id="at-candidate-compare" disabled>このmap・対象で比較</button></div><p class="muted">上の対象・探索窓と、現在ROMから選択中のmap/node・area・時間を使います。最終抽選の観測場所とは別です。参照点は現在時刻の証明ではありません。1回は最大50,000通りのtable→weighted評価、検証を含め1.5秒（256候補・評価ごとに応答）。途中で止まった範囲は候補から外しません。</p><p id="at-candidate-status" role="status"></p><div id="at-candidate-results"></div></details>`;
export function mountCandidateForecastPanel({document:doc,send,getSession,getContext,getTarget,getWindow,storage=globalThis.sessionStorage}){
 const $=id=>doc.getElementById(id),el=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let result=null,epoch=0,fileEpoch=0,busy=false,lastStorage=null;
 function association(){return verifyCandidateAssociation(result,getSession());}
 function ready(){let reason='';try{if(!result)throw Error('候補未読込');association();if(!getContext()?.resolved)throw Error('ROMを通常どおり読み込み、map/node・area・時間を選択してください。保存map IDだけでは比較できません');}catch(error){reason=error.message;}$('at-candidate-compare').disabled=busy||!!reason;return reason;}
 function invalidate(reason='条件が変わりました。もう一度比較してください'){
  epoch++;fileEpoch++;if(busy)send('candidate-forecast-cancel').catch(()=>{});busy=false;$('at-candidate-results').replaceChildren();$('at-candidate-status').textContent=result?(ready()||reason):'';ready();
 }
 function load(raw){const next=readCandidateResult(raw);invalidate();result=next;$('at-candidate-panel').open=true;const source=next.inputForm?.sessionContext;const seed='0x'+next.origin.initialSeed.toString(16).padStart(8,'0');$('at-candidate-source').textContent=`候補の起点 ${seed} / 元の保存観測 ${source?.selectedObservationIds?.join(', ')||'対応なし'}。観測元map・出典は結果詳細に保持し、現在の表示mapと同一視しません。`;$('at-candidate-status').textContent=ready()||'候補のseed・セッション・観測記録が一致。最終抽選→比較参照点の消費区間は別途指定してください';}
 function checkStorage(){try{const raw=storage?.getItem(CANDIDATE_FORECAST_KEY);if(raw&&raw!==lastStorage){lastStorage=raw;load(JSON.parse(raw));}}catch(error){$('at-candidate-status').textContent=`候補の受取失敗: ${error.message}。結果JSONを読み込んでください。`;}}
 function render(r){
  const root=$('at-candidate-results');root.replaceChildren();
  root.append(el('p',`${r.reason} / 評価 ${r.evaluations.toLocaleString()} / 全保存候補を比較済みのtable draw先 ${r.fullyComparedOffsets}件${r.partialOffset?` / +${r.partialOffset}は途中`:''}`));
  for(const b of r.coverage)root.append(el('p',`${b.branchId}: 発見 ${b.candidateIndicesFound??'不明'} / 保存 ${b.materializedCount} / 探索 ${b.searchCompleteWithinDomain?'宣言範囲内完了':'未完了'} / 保存 ${b.allFoundCandidatesMaterialized?'発見分完了':'不完全'} / 未探索区間 ${b.unsearchedIndexIntervals.length} / 範囲外 ${b.outsidePriorPossible?'保持':'宣言なし'} / ${b.reason??b.status}`));
  const opportunities=r.rows.filter(row=>row.targetPaths>0),display=opportunities.slice(0,20);
  root.append(el('p',`対象になる条件を含むdraw先 ${opportunities.length}件（表示は先頭20件）。一致は保存済み候補・明記した区間・選択area/time内だけです。未保存・未探索・別枝を含む全体の保証ではありません。通り数は確率ではなく、別枝の候補件数も合算しません。`));
  if(display.length){const table=el('table'),head=el('tr');for(const title of ['参照点から table / weighted','条件付き対象','比較結果'])head.append(el('th',title));table.append(head);for(const row of display){const tr=el('tr'),agreement=!row.complete?'途中':row.unresolvedPaths?'未解決を含む':row.agreement==='same-outcome'?'保存済み候補と指定区間内で表・種が一致':'候補・消費区間・area/timeで表または種が異なる';tr.append(el('td',`+${row.offset} / +${row.weightedOffset}`),el('td',`${row.targetPaths}/${row.evaluatedPaths}通り${row.complete?'':'（検査分のみ）'}`),el('td',agreement+' / '+row.outcomes.map(o=>o.resolved?`table ${o.tableId??'なし'}: ${o.monsterName??o.monsterId??'対象抽選なし'} ×${o.paths}`:`未解決: ${o.reason} ×${o.paths}`).join('・')));table.append(tr);}root.append(table);}
  else root.append(el('p','検査した範囲では対象候補なし。未比較の範囲や未解決の枝は除外しません。'));
  const details=el('details');details.append(el('summary','候補元・現在のROM選択・仮定・比較範囲'),el('pre',JSON.stringify({origin:r.origin,sourceObservations:r.sourceObservations,identificationInputForm:r.identificationInputForm,context:r.context,gap:r.gap,scenarios:r.scenarios,coverage:r.coverage,budget:r.budget,stateVerification:r.stateVerification,requestedEvaluations:r.requestedEvaluations,pathsPerOffset:r.pathsPerOffset,allCandidatePossibilitiesCovered:false},null,2)));root.append(details,el('p',r.interpretation));
 }
 $('at-candidate-file').onchange=async()=>{invalidate();const mine=++fileEpoch,file=$('at-candidate-file').files?.[0];if(!file)return;try{const raw=JSON.parse(await file.text());if(mine!==fileEpoch)return;load(raw);}catch(error){if(mine===fileEpoch)$('at-candidate-status').textContent=`候補の読込失敗: ${error.message}`;}};
 $('at-candidate-clear').onclick=()=>{invalidate();result=null;lastStorage=null;try{storage?.removeItem(CANDIDATE_FORECAST_KEY);}catch{};$('at-candidate-source').textContent='候補未読込';$('at-candidate-status').textContent='';$('at-candidate-file').value='';ready();};
 for(const id of ['at-candidate-gap','at-candidate-min','at-candidate-max','at-candidate-basis'])for(const event of ['input','change'])$(id).addEventListener(event,()=>invalidate());
 $('at-candidate-compare').onclick=async()=>{
  if(busy||!result)return;invalidate();const mine=epoch;
  try{association();const number=id=>{const text=$(id).value.trim();if(!/^(0|[1-9][0-9]*)$/.test(text))throw Error('消費数の空欄は0ではありません。有限範囲の最小・最大を入力してください');return Number(text);};
   const gap=$('at-candidate-gap').value==='bounded'?{kind:'bounded',min:number('at-candidate-min'),max:number('at-candidate-max'),provenance:$('at-candidate-basis').value}:{kind:'unknown'};
   busy=true;ready();$('at-candidate-status').textContent='保存済み候補を比較中…';
   const r=await send('candidate-forecast',{result,options:{context:getContext(),gap,targetIds:getTarget().split(',').filter(Boolean).map(Number),window:Number(getWindow()),budget:CANDIDATE_FORECAST_BUDGET}});
   if(mine!==epoch)return;render(r);$('at-candidate-status').textContent=r.status==='complete-materialized-subset'?'条件付き比較完了。現在AT・出現時刻・移動経路は未確定です。':r.reason;
  }catch(error){if(mine===epoch)$('at-candidate-status').textContent=error.message;}
  finally{if(mine===epoch){busy=false;ready();}}
 };
 ready();return{load,invalidate,checkStorage,getResult:()=>result};
}
