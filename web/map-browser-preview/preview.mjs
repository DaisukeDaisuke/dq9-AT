import {openMapRom} from './static-scene.mjs';
import {buildRomMapCatalog} from './rom-map-catalog.mjs';
import {nameCatalogMaps} from './rom-map-names.mjs';
import {MapRenderer} from './minimap-preview.mjs';
import {loadAutomaticScene} from './automatic-scene.mjs';
import {automaticBillboardScenes} from './automatic-billboard-scene.mjs';
import {applyAutomaticMaterialEnvironment} from './automatic-material-environment.mjs';
import {loadRomFloorInstances,floorHeightsAtXZ} from './rom-floor-candidates.mjs';
import {mapClickWorld,automaticPreviewCamera} from './automatic-preview-camera.mjs';
import {prepareDrawPackets} from './draw-packets.mjs';
import {rasterizePreviewPackets} from './cpu-preview.mjs';
const $=id=>document.getElementById(id),ctx=$('view').getContext('2d'),mapCtx=$('minimap').getContext('2d');
let rom,project,catalog,maps=[],record,automatic,floors,image,point,renderer,version=0,loaded=false;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function clearView(){ctx.clearRect(0,0,256,192);$('draw').disabled=true;point=null;$('floor').replaceChildren();$('floor').disabled=true;}
function reportError(e){$('status').textContent='描画できません：'+e.message;console.error(e);}
function guard(fn){return async event=>{try{await fn(event);}catch(e){reportError(e);}};}
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
async function responseBytes(url){const r=await fetch(url);if(!r.ok)throw Error('必要なファイルを読めません: '+url+' ('+r.status+')');return r;}
$('rom').onchange=guard(async()=>{
 const id=++version,file=$('rom').files[0];clearView();loaded=false;for(const x of['search','map','descriptor'])$(x).disabled=true;if(!file)return;
 $('status').textContent='ROMとマップ一覧を読んでいます…';await frame();const bytes=new Uint8Array(await file.arrayBuffer());if(id!==version)return;
 const p=openMapRom(bytes),c=buildRomMapCatalog(p);let csv='';try{csv=await(await responseBytes('../data/map-id-names.csv')).text();}catch(e){throw Error('既存マップ名一覧の取得に失敗: '+e.message);}
 const w=await(await responseBytes('../wasm/map_render.wasm')).arrayBuffer(),inst=await WebAssembly.instantiate(w,{});if(id!==version)return;
 rom=bytes;project=p;catalog=c;maps=nameCatalogMaps(c,csv);renderer=new MapRenderer(inst.instance);loaded=true;$('search').disabled=false;$('map').disabled=false;filterMaps();
});
function filterMaps(){if(!loaded)return;const q=$('search').value.trim().toLocaleLowerCase(),old=$('map').value,rows=maps.filter(m=>(m.displayLabel+' '+m.fieldCode).toLocaleLowerCase().includes(q));$('map').replaceChildren(new Option('マップを選択',''),...rows.map(r=>new Option(r.displayLabel,r.key)));if(rows.some(r=>r.key===old))$('map').value=old;else{clearView();record=null;image=null;mapCtx.clearRect(0,0,$('minimap').width,$('minimap').height);$('descriptor').replaceChildren();$('descriptor').disabled=true;}$('mapstatus').textContent=rows.length+'件。マップを選択してください。';}
$('search').oninput=filterMaps;
$('map').onchange=guard(async()=>{
 const id=++version;clearView();image=null;mapCtx.clearRect(0,0,$('minimap').width,$('minimap').height);automatic=null;floors=null;record=maps.find(r=>r.key===$('map').value);if(!record)return;
 $('status').textContent='ROMの配置と床を読んでいます…';await frame();if(id!==version)return;automatic=loadAutomaticScene(project,record);floors=loadRomFloorInstances(project,automatic.plan);
 $('descriptor').replaceChildren(...record.minimapCandidates.map(d=>new Option(d.path+' ('+d.relation+')',d.path)));$('descriptor').disabled=!record.minimapCandidates.length;
 if(!record.minimapCandidates.length){$('mapstatus').textContent='このマップに対応する地図画像は未解決です。';$('status').textContent='地図との対応が未解決のためクリック描画はできません。';return;}showMap();
});
function showMap(){clearView();image=renderer.compose(catalog.minimap,$('descriptor').value);const canvas=$('minimap');canvas.width=image.width;canvas.height=image.height;mapCtx.putImageData(new ImageData(image.rgba,image.width,image.height),0,0);$('mapstatus').textContent=record.displayLabel+'。歩ける地点をクリックしてください。';$('status').textContent='地図から描画地点を選択してください。';}
$('descriptor').onchange=guard(showMap);
function markPoint(x,y){mapCtx.putImageData(new ImageData(image.rgba,image.width,image.height),0,0);mapCtx.strokeStyle='#ff4040';mapCtx.lineWidth=1;mapCtx.beginPath();mapCtx.moveTo(x-5,y);mapCtx.lineTo(x+5,y);mapCtx.moveTo(x,y-5);mapCtx.lineTo(x,y+5);mapCtx.stroke();}
$('minimap').onclick=guard(async event=>{
 if(!image||!automatic)return;const box=$('minimap').getBoundingClientRect(),x=(event.clientX-box.left)*image.width/box.width,y=(event.clientY-box.top)*image.height/box.height;clearView();point=mapClickWorld(image,x,y);markPoint(x,y);
 const q=floorHeightsAtXZ(floors,point.xFx,point.zFx);$('diagnostics').textContent=JSON.stringify({map:record.displayLabel,floor:q,unresolved:automatic.unresolved},null,2);
 if(!q.heightsFx.length){$('status').textContent='この地点の床が見つかりません。通路や床の上を選び直してください。未対応の床形状は詳細欄に表示します。';return;}
 $('floor').replaceChildren(...q.heightsFx.map((v,i)=>new Option('床候補'+(i+1)+' 高さ '+(v/4096).toFixed(3),String(v))));$('floor').disabled=q.heightsFx.length===1;$('draw').disabled=false;await render();
});
async function render(){
 if(!point||!$('floor').options.length)return;const id=version;$('status').textContent='CPUで描画しています…';await frame();if(id!==version)return;
 const camera=automaticPreviewCamera(project,rom,record,{...point,yFx:Number($('floor').value),yawDegrees:Number($('yaw').value)}),active=applyAutomaticMaterialEnvironment(project,record,automaticBillboardScenes(project,automatic,camera.viewFx));
 if(!active.environmentApplied){$('diagnostics').textContent=JSON.stringify(active.environment,null,2);throw Error('ROMの初期環境をまだ適用できません: '+active.environment.unresolved.join('; '));}
 const parts=active.scenes.map(s=>prepareDrawPackets(s,{materialGlobals:active.environment.materialGlobals,masks:automatic.masks})),packets={draws:parts.flatMap(x=>x.draws)},r=rasterizePreviewPackets(packets,{view:identity,projection:camera.projectionFx.map(x=>x/4096),clearRGBA:[0,0,0,0],colorProfile:'native-mode0-rgb'});
 ctx.putImageData(new ImageData(r.rgba,r.width,r.height),0,0);const blocked=[...active.unresolved,...active.scenes.flatMap(s=>s.unsupported).filter(x=>!x.reason.startsWith('name-char3-A')),...parts.flatMap(p=>p.unsupported),...r.stats.rejected];
 $('status').textContent=(r.stats.fragments?'CPU描画しました。':blocked.length?'未対応項目のため描画できません。':'この向きでは描画対象が見えません。')+(blocked.length?' 未対応の描画項目があります。':'')+' 初期状態のプレビューです。霧・動的変化・実動画との一致は未確認です。';
 $('diagnostics').textContent=JSON.stringify({map:record.displayLabel,backend:'cpu-canvas2d',point,floor:Number($('floor').value),floorUnresolved:floors.unsupported,cameraScope:camera.scope,renderScope:r.scope,environment:active.environment.scope,colorReady:active.environment.colorReady,fogReady:active.environment.fogReady,fogUnresolved:active.environment.fogUnresolved,fogApplied:false,stats:r.stats,unresolved:blocked},null,2);
}
$('floor').onchange=guard(render);$('draw').onclick=guard(render);$('yaw').oninput=()=>{$('yawlabel').value=$('yaw').value+'°';};$('yaw').onchange=guard(render);
