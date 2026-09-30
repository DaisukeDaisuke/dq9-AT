import {startIdentification} from './at-identify.mjs';
import {createSearchController,syntheticExample} from './at-identify-form.mjs';
export const assetURLs={tables:new URL('./data/enc.json',import.meta.url),wasm:new URL('./wasm/at_identify.wasm',import.meta.url)};
const labels={'loading':'データ読込中','running':'探索中','complete':'宣言範囲の処理終了','budget-stopped':'計算予算で停止','cancelled':'中止','failed':'失敗','unresolved':'未解決','unconstrained':'制約なし','invalid':'入力不正','pending':'待機','searching':'探索中'};
const hex=n=>'0x'+n.toString(16).padStart(8,'0');
export function mountIdentificationPage({document:doc,fetchImpl=globalThis.fetch,startSearch=startIdentification}={}){
 const $=id=>doc.getElementById(id),el=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let tables=null,rowControls=[],busy=false,synthetic=false,lastResult=null,runForm=null;
 async function readAsset(url,signal,kind){const response=await fetchImpl(url,{signal});if(!response.ok)throw Error(`静的データの読込に失敗: ${url.pathname} (HTTP ${response.status})`);return response[kind]();}
 function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
 function resultView(c){
  $('results').replaceChildren();$('export').disabled=!c;lastResult=c;
  if(!c){$('progress').value=0;return;}
  const b=c.branches[0],length=xs=>xs.reduce((n,r)=>n+r.last-r.first+1,0),done=length(b?.searchedIntervals??[]),left=length(b?.unsearchedIntervals??[]);$('progress').value=done+left?done/(done+left):0;
  $('results').append(el('p',`検査済み状態数: ${c.inspectedStates}。イベントから観測時刻までの伝播は未実施。現在映像のATは未確定です。`));
  for(const branch of c.branches){
   const section=el('article');section.className='result-branch';section.append(el('h3',`${branch.branchId==='conditional-chain'?'入力した種抽選の条件付き仮説':'未排除の別解'} — ${labels[branch.status]??branch.status}`));
   const facts=el('dl');const fact=(k,v)=>facts.append(el('dt',k),el('dd',String(v)));
   fact('最終イベント',branch.eventBoundaryId??'確定していません');fact('発見したlow31候補数',branch.candidateClassesFound??'未集計（不明）');fact('種・表の述語',branch.predicateExact?'入力仮説の範囲では確定':'未解決の候補を含みます');fact('宣言範囲の探索',branch.searchCompleteWithinDomain?'完了':'未完了');fact('範囲外の可能性',branch.outsidePriorPossible?'保持しています':'全域を宣言（未探索部分は別記）');fact('サンプル',`${branch.sampleClasses.length}件 / 最大16件${branch.samplesTruncated?'。残りの候補は省略':''}`);section.append(facts);
   if(branch.reason)section.append(el('p',`診断: ${branch.reason}`));
   if(branch.assumptions?.length)section.append(el('p',branch.assumptions.join(' / ')));
   if(branch.sampleFullStateLifts.length){const wrap=el('div');wrap.className='table-wrap';const table=el('table'),head=el('tr');for(const title of ['low31クラス','32bit候補 1','32bit候補 2'])head.append(el('th',title));table.append(head);branch.sampleFullStateLifts.forEach(([a,b])=>{const tr=el('tr');for(const v of [String(a),hex(a),hex(b)])tr.append(el('td',v));table.append(tr);});wrap.append(table);section.append(wrap);}
   const details=el('details');details.append(el('summary','探索済み・未探索区間、観測との対応'));const pre=el('pre',JSON.stringify({searchedIntervals:branch.searchedIntervals,unsearchedIntervals:branch.unsearchedIntervals,observationEdges:branch.observationEdges,sightingEventBindings:branch.sightingEventBindings},null,2));details.append(pre);section.append(details);$('results').append(section);
  }
  const context=el('details');context.append(el('summary','探索に使った入力・間隔の根拠・計算予算'),el('pre',JSON.stringify(c.inputForm??null,null,2)));$('results').append(context);
  $('results').append(el('p','未探索の末尾・範囲外・別の出生対応は残ります。枝ごとの件数を足して全候補数とはしません。1クラスでも2つの32bit候補があり、現在ATの確定ではありません。'));
 }
 function updateState(state){busy=['loading','running'].includes(state.phase);$('inputs').disabled=busy;$('start').disabled=busy;$('cancel').disabled=!busy;status(`${labels[state.phase]??state.phase}${state.error?`: ${state.error}`:state.checkpoint?.error?`: ${state.checkpoint.error}`:''}`,state.phase==='failed');resultView(state.checkpoint?{...state.checkpoint,inputForm:structuredClone(runForm),inputScope:'入力時点の手動仮説。計算予算は証拠の上限ではない'}:null);}
 const controller=createSearchController({loadResources:async signal=>{const [data,wasmBytes]=await Promise.all([tables?Promise.resolve({main:tables}):readAsset(assetURLs.tables,signal,'json'),readAsset(assetURLs.wasm,signal,'arrayBuffer')]);tables=data.main;return{tables,wasmBytes};},startSearch,onState:updateState});
 function input(label,value='',list){const wrapper=el('label',label),node=el('input');node.value=value;if(list)node.setAttribute('list',list);wrapper.append(node);return{wrapper,node};}
 function select(label,options,value){const wrapper=el('label',label),node=el('select');for(const [v,t]of options){const o=el('option',t);o.value=v;node.append(o);}node.value=value;wrapper.append(node);return{wrapper,node};}
 function updateRows(){const ordered=$('ordered').checked;rowControls.forEach((r,i)=>{r.title.textContent=`観測 ${i+1}`;r.gap.hidden=i===0||!ordered;r.range.hidden=r.gapMode.value!=='range';});}
 function addRow(row={}){
  if(rowControls.length>=8)return;const box=el('section');box.className='observation';const titlebar=el('div');titlebar.className='row-title';const title=el('strong'),remove=el('button','この行を削除');remove.type='button';titlebar.append(title,remove);box.append(titlebar);const grid=el('div');grid.className='grid';const controls={box,title};
  for(const [key,label,list]of [['label','観測メモ（任意）',null],['tables','表ID候補（例: 30）','table-options'],['species','種ID候補（例: 83）','species-options']]){const x=input(label,row[key]??'',list);controls[key]=x.node;grid.append(x.wrapper);}box.append(grid);
  const info=el('p');info.className='row-info';const describe=()=>{const lookup=(value,kind)=>value.split(/[,、\s]+/).filter(Boolean).map(id=>{if(kind==='table'){const t=tables?.[id];return t?`表${id}: ${t.data.map(x=>x.monsterName).join('・')}`:`表${id}: 未読込または不明`;}for(const t of Object.values(tables??{})){const found=t.data.find(x=>String(x.monsterId)===id);if(found)return `${id}: ${found.monsterName}`;}return `${id}: 名称未解決`;});info.textContent=[...lookup(controls.tables.value,'table'),...lookup(controls.species.value,'species')].join(' / ')||'表・種が空欄の行は不明のまま保持します';};controls.tables.oninput=describe;controls.species.oninput=describe;box.append(info);
  const gap=el('div');gap.className='gap';const mode=select('前の抽選からの消費数',[['unknown','不明（有限上限なし）'],['range','根拠・仮定を明記した有限範囲']],row.gapMode??'unknown');controls.gapMode=mode.node;gap.append(mode.wrapper);const range=el('div');range.className='grid';for(const [key,label]of [['gapMin','最小消費（次の抽選を含む）'],['gapMax','最大消費'],['gapProvenance','根拠・仮定']]){const x=input(label,row[key]??'');controls[key]=x.node;range.append(x.wrapper);}gap.append(range);Object.assign(controls,{gap,range});box.append(gap);controls.gapMode.onchange=updateRows;remove.onclick=()=>{if(busy)return;if(rowControls.length===1){status('観測は最低1行必要です',true);return;}rowControls=rowControls.filter(x=>x!==controls);box.remove();updateRows();markManual();};rowControls.push(controls);$('rows').append(box);updateRows();describe();
 }
 function markManual(){synthetic=false;$('input-kind').textContent='手入力の仮説。出生・種・表・順序は未検証です。';}
 const fields={domainMode:'domain-mode',domainFirst:'domain-first',domainLast:'domain-last',domainProvenance:'domain-provenance',maxStates:'max-states',maxMs:'max-ms',chunkStates:'chunk-states'};
 function fill(form){$('rows').replaceChildren();rowControls=[];$('ordered').checked=!!form.ordered;for(const [key,id]of Object.entries(fields))$(id).value=form[key]??'';for(const row of form.rows)addRow(row);synthetic=!!form.synthetic;$('input-kind').textContent=synthetic?'合成例: 動作確認用です。実映像・実測ATの結果ではありません。':'手入力。初期値に実測データは含みません。';$('domain-fields').hidden=$('domain-mode').value!=='interval';updateRows();}
 function snapshot(){return{synthetic,ordered:$('ordered').checked,...Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,$(id).value])),rows:rowControls.map(r=>Object.fromEntries(['label','tables','species','gapMode','gapMin','gapMax','gapProvenance'].map(k=>[k,r[k].value])))};}
 $('inputs').addEventListener('input',markManual);$('inputs').addEventListener('change',markManual);$('ordered').onchange=updateRows;$('domain-mode').onchange=()=>{$('domain-fields').hidden=$('domain-mode').value!=='interval';};$('add-row').onclick=()=>{if(!busy){addRow();markManual();}};$('example').onclick=()=>{if(!busy)fill(syntheticExample());};$('clear').onclick=()=>{if(!busy){fill({rows:[{}],ordered:false,domainMode:'all',maxStates:'250000',maxMs:'2000',chunkStates:'8192'});resultView(null);status('入力をリセットしました');}};
 $('search-form').onsubmit=event=>{event?.preventDefault();if(!busy){runForm=snapshot();return controller.run(runForm);}};$('cancel').onclick=()=>controller.cancel();
 $('export').onclick=()=>{if(!lastResult)return;const blob=new Blob([JSON.stringify(lastResult,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='dq9-conditional-at-result.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 fill({rows:[{}],ordered:false,domainMode:'all',maxStates:'250000',maxMs:'2000',chunkStates:'8192'});$('start').disabled=true;
 const ready=readAsset(assetURLs.tables,undefined,'json').then(data=>{tables=data.main;const species=new Map();for(const [id,t]of Object.entries(tables)){const o=el('option',`表${id}: ${t.data.map(r=>r.monsterName).join('・')}`);o.value=id;$('table-options').append(o);for(const r of t.data)species.set(r.monsterId,r.monsterName);}for(const [id,name]of [...species].sort((a,b)=>a[0]-b[0])){const o=el('option',`${id}: ${name}`);o.value=String(id);$('species-options').append(o);}status('準備できました。観測の仮説を入力するか、合成例を試してください。');}).catch(error=>status(`${error.message}。開始時に再試行します。`,true)).finally(()=>{$('start').disabled=false;});
 return{ready,controller,snapshot,getRows:()=>rowControls,getResult:()=>lastResult};
}
if(typeof document!=='undefined')mountIdentificationPage({document});
