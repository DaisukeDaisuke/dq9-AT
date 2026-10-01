import {createFirstSpawnReplay} from './first-spawn-replay.mjs';
import {parseSeed} from './at-core.mjs';
const hex=n=>'0x'+(n>>>0).toString(16).padStart(8,'0');

// One explicit local experiment. No live-video event or ATSession subscription.
export function setupFirstSpawnPanel({document,getInputs,redraw,eventTarget=globalThis,create=createFirstSpawnReplay,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}){
 const $=id=>document.getElementById(id);let runtime=null,trajectory=null,session=null,epoch=0,running=false,runId=0;
 const reads={runtime:0,trajectory:0};
 function message(text){$('spawn-replay-status').textContent=text;}
 function cancel(){runId++;running=false;update();}
 function invalidate(){cancel();session=null;$('spawn-replay-declared').checked=false;update();redraw();}
 function ready(){return !!getInputs()?.project;}
 function update(){
  $('spawn-replay-run').textContent=$('spawn-replay-newborn').checked?'生成後の未解決まで':'最初の生成 / 未解決まで';
  $('spawn-replay-start').disabled=!ready()||!runtime||!trajectory||!$('spawn-replay-declared').checked||running;
  for(const id of ['spawn-replay-step','spawn-replay-ten','spawn-replay-run'])$(id).disabled=!session||session.stopped||running;
  $('spawn-replay-cancel').disabled=!running;$('spawn-replay-reset').disabled=!session&&!running;
  $('spawn-replay-runtime').disabled=!ready();$('spawn-replay-trajectory').disabled=!ready();
  $('spawn-replay-inputs').textContent=`初期runtime: ${runtime?'読込済み':'未入力'} / pre-spawn軌跡: ${trajectory?'読込済み':'未入力'}。pool・creator・地形runtime条件はROM/seedから自動確定しません。`;
  if(session){
   const last=session.events.at(-1),birth=session.birth;
   message(`${session.status}: ${session.events.length} 段階 / 条件付きAT prefix ${session.consumed} / prefix seed ${hex(session.seed)} / timer ${session.timer}\n${session.status==='unresolved'?'未解決段階の途中までの既知prefixです。呼出完了・実機の現在seedではありません。\n':''}${birth?`生成 species ${birth.species}, slot ${birth.slot}, XYZ ${birth.xyz.join(', ')}\n`:''}${session.actor?`最後の計算actor（段階${(session.actorPhase?.index??-1)+1}/${session.actorPhase?.phase??'unknown'}）: state ${session.actor.state}, body ${session.actor.updateCounter}回, XYZ ${session.actor.xyz.join(', ')}\n`:''}${session.reason||'pre-spawn入力を順に適用中'}${last?.sourceFrame!==null&&last?.sourceFrame!==undefined?`\n入力のsourceFrame ${last.sourceFrame}（呼出回数ではありません）`:''}`);
   if(session.actors?.size>1)$('spawn-replay-status').textContent+='\n派生actor '+session.actors.size+'体\n'+[...session.actors.values()].map(e=>`slot${e.identity.slot} / species${e.actor.species} / serial${e.actor.serial} / state${e.actor.state} / XYZ[${e.actor.xyz}] / 段階${e.phase.index+1}/${e.phase.phase}`).join('\n');
   $('spawn-replay-log').textContent=session.events.slice(-200).map(e=>`${e.index}: hero[${e.heroXYZ}] → node ${e.selectedNodeId??'?'} / species ${e.monsterId??'?'} / AT+${e.consumed} / ${hex(e.seed)} / ${e.reason}`).join('\n');
  }else $('spawn-replay-log').textContent='';
 }
 async function read(kind,file){
  if(!file)return;invalidate();const serial=++reads[kind],stamp=epoch;
  if(kind==='runtime')runtime=null;else trajectory=null;
  update();message('ローカルJSONを読込中');
  try{
   if(file.size>(kind==='runtime'?8*1024*1024:1024*1024))throw Error('runtimeは8MiB、軌跡は1MiBまでです');
   const text=await file.text();if(stamp!==epoch||serial!==reads[kind])return;
   const value=JSON.parse(text);if(kind==='runtime')runtime=value;else trajectory=value;$('spawn-replay-declared').checked=false;
   message('JSONを読み込みました。初期runtime条件と入力phaseを確認し、実行宣言をしてください。');update();
  }catch(error){if(stamp===epoch&&serial===reads[kind]){message(error.message);update();}}
 }
 function start(){
  invalidate();
  try{
   // The caller's click was enabled only under the declaration. Save that
   // before invalidation, while every import/config change requires it anew.
   session=create({...getInputs(),runtime,trajectory,seed:parseSeed($('seed').value),continueNewborn:$('spawn-replay-newborn').checked});
   update();redraw();
  }catch(error){message(error.message);update();redraw();}
 }
 async function advance(count){
  if(!session||session.stopped||running)return;
  const own=++runId,target=session;running=true;update();
  try{
   for(let i=0;i<count;i++){
    if(own!==runId||target!==session)return;
    if(!target.advance())break;
    if((i+1)%16===0){update();redraw();await yieldTask();}
   }
  }catch(error){if(own===runId&&target===session){target.stopped=true;target.status='unresolved';target.reason=error.message;}}
  finally{if(own===runId&&target===session){running=false;update();redraw();}}
 }
 $('spawn-replay-runtime').onchange=()=>{const file=$('spawn-replay-runtime').files[0];$('spawn-replay-runtime').value='';return read('runtime',file);};
 $('spawn-replay-trajectory').onchange=()=>{const file=$('spawn-replay-trajectory').files[0];$('spawn-replay-trajectory').value='';return read('trajectory',file);};
 $('spawn-replay-declared').onchange=()=>{if(!$('spawn-replay-declared').checked)invalidate();update();};
 $('spawn-replay-newborn').onchange=()=>{invalidate();message('更新範囲を変更しました。phase入力を確認して再初期化してください。');};
 $('spawn-replay-start').onclick=()=>{if(!$('spawn-replay-start').disabled&&$('spawn-replay-declared').checked)start();};
 $('spawn-replay-step').onclick=()=>advance(1);$('spawn-replay-ten').onclick=()=>advance(10);$('spawn-replay-run').onclick=()=>advance(2001);
 $('spawn-replay-cancel').onclick=()=>{cancel();message('停止しました。最後の計算済み段階から再開、または初期化できます。');redraw();};
 $('spawn-replay-reset').onclick=()=>{invalidate();message('初期化前。明示したseedから新しく計算します。');};
 $('seed').addEventListener('input',()=>{invalidate();message('seed変更。以前の計算は無効です。');});
 update();
 const controller={
  release(){epoch++;reads.runtime++;reads.trajectory++;runtime=trajectory=null;$('spawn-replay-newborn').checked=false;invalidate();message('初期runtimeと軌跡が未入力です。投入ROM内だけで実行します。');},
  refresh:update,
  controlsChanged(){invalidate();message('初期設定変更。自然生成の以前の計算は無効です。条件を確認して再初期化してください。');},
  dismiss(){invalidate();message('1 actor実験に切り替えました。自然生成を再実行するには初期化してください。');},
  draw(ctx,transform){
   if(!session)return false;const point=p=>[transform.x+p[0]/4096*transform.scale,transform.z+p[2]/4096*transform.scale];
   ctx.strokeStyle='#ef9fbd';ctx.lineWidth=2;ctx.beginPath();session.heroTrace.forEach((p,i)=>{const q=point(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();
   const last=session.heroTrace.at(-1);if(last){const[x,z]=point(last);ctx.fillStyle='#ef9fbd';ctx.fillRect(x-4,z-4,8,8);ctx.fillText('hero input',x+7,z);}
   if(session.birth&&!session.actors?.size){const[x,z]=point(session.birth.xyz);ctx.fillStyle='#58efd1';ctx.beginPath();ctx.arc(x,z,6,0,Math.PI*2);ctx.fill();ctx.fillText(`species ${session.birth.species}`,x+8,z);}
   if(session.actors?.size){let index=0;for(const e of session.actors.values()){const color=['#58efd1','#ffd679','#b1a0ff','#ffb1c8'][index++%4];ctx.strokeStyle=color;ctx.beginPath();e.trace.forEach((p,i)=>{const q=point(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();const[x,z]=point(e.actor.xyz);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,5,0,Math.PI*2);ctx.fill();ctx.fillText(`${e.identity.slot}: species${e.actor.species}`,x+7,z+12);}}
   else if(session.actorTrace?.length){ctx.strokeStyle='#58efd1';ctx.beginPath();session.actorTrace.forEach((p,i)=>{const q=point(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();}
   return true;
  }
 };
 eventTarget.addEventListener?.('pagehide',()=>controller.release());
 return controller;
}
