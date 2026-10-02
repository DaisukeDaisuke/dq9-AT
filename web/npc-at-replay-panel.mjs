// The existing AT panel supplies its Worker transport. Results never enter show()
// or the session ledger, and changing files invalidates an in-flight display.
export function attachNpcReplayPanel(root,{send,save}){
 root.innerHTML=`<h3>開始snapshotからのNPC継続予測</h3><p class="muted">動的な開始状態・外部時計列・静的なROM抽出データを端末内で読みます。全slot巡回、global mode不変、外部setter・他AT consumerなしが条件です。起動前後の全履歴や世界全体のAT位置は確定しません。</p><div class="at-controls"><label class="file-button">開始状態<input data-npc="origin" type="file" accept=".json,application/json"></label><span data-name="origin">未選択</span><label class="file-button">外部時計列<input data-npc="clocks" type="file" accept=".json,application/json"></label><span data-name="clocks">未選択</span><label class="file-button">ROM抽出JSON<input data-npc="romData" type="file" accept=".json,application/json"></label><span data-name="romData">未選択</span></div><div class="at-controls"><button data-npc="run" disabled>NPC継続を予測</button><button data-npc="clear">クリア</button><button data-npc="save" disabled>予測結果を保存</button></div><p data-npc="status" role="status">3つのJSONを選択してください。サーバーへ送信しません。</p><div data-npc="result"></div>`;
 const get=key=>root.querySelector(`[data-npc="${key}"]`),keys=['origin','clocks','romData'];
 let generation=0,busy=false,result=null;
 const update=()=>{get('run').disabled=busy||keys.some(k=>!get(k).files?.[0]);get('save').disabled=!result;};
 const invalidate=()=>{generation++;busy=false;result=null;get('result').replaceChildren();get('status').textContent='入力を選択して予測してください。追跡セッションの下限は変更しません。';update();};
 for(const key of keys)get(key).onchange=()=>{root.querySelector(`[data-name="${key}"]`).textContent=get(key).files?.[0]?.name??'未選択';invalidate();};
 get('clear').onclick=()=>{for(const key of keys){get(key).value='';root.querySelector(`[data-name="${key}"]`).textContent='未選択';}invalidate();};
 get('run').onclick=async()=>{
  if(busy||keys.some(k=>!get(k).files?.[0]))return;
  const token=++generation,files=Object.fromEntries(keys.map(k=>[k,get(k).files[0]]));busy=true;result=null;get('result').replaceChildren();update();get('status').textContent='端末内のWorkerで読み込み・予測中…';
  try{
   const value=await send('npc-continuation-files',{files});if(token!==generation)return;
   result=value;get('status').textContent=`${value.resolved?'条件内で予測完了':'未解決境界で停止'} · 条件付き${value.conditionalConsumed} draw · 証明済み下限への加算0 · 追跡セッションは変更なし`;
   const add=text=>{const p=document.createElement('p');p.textContent=text;get('result').append(p);};
   add(`開始frame ${value.originFrame??'未確定'} / 更新tick ${value.frames?.length??0} / 最終sourceFrame ${value.frames?.at(-1)?.sourceFrame??'なし'} / controller ${value.controllers?.length??0}`);
   if(value.seedBefore!==undefined)add(`開始seed ${value.seedBefore} → 条件付き終了seed ${value.seedAfter}`);
   if(!value.resolved)add(`停止理由: ${value.reason}${value.boundary?` / sourceFrame ${value.boundary.sourceFrame} / PC ${value.boundary.pc===null?'未確定':'0x'+value.boundary.pc.toString(16)}`:''}`);
   add('開始以前の初期化drawはこの件数に含めません。外部setter・他consumerがあれば、その先は成立しません。');
   for(const draw of (value.draws??[]).slice(0,40))add(`sourceFrame ${draw.sourceFrame}: ${draw.consumer} / random ${draw.random}${draw.candidateCount!==undefined?` / 候補${draw.candidateCount}・選択ordinal ${draw.ordinal}`:''}`);
   if((value.draws?.length??0)>40)add('表示は先頭40 draw。保存する結果には全件を含みます。');
  }catch(error){if(token===generation)get('status').textContent='予測できません: '+error.message;}
  finally{if(token===generation){busy=false;update();}}
 };
 get('save').onclick=()=>{if(result)save('dq9-npc-continuation.json',result);};
 update();
 return {clear:()=>get('clear').onclick()};
}
