import {readRomCameraYawCandidates} from './read-rom-camera-yaw-candidates.mjs';
import {ResidualRecognitionClient} from './residual-recognition-client.mjs?v=asset-prepare-20261005-0358';
import {residualModelPlan,residualClassificationRequest,residualObservationBundle} from './residual-recognition-input.mjs';
import {renderInitialIntegerFog} from './integer-static-fog.mjs?v=mse-explicit-20261005-0443';
import {CPUTextClient} from '../font-akinator-cpu-client.mjs';
import {deriveVideoMapNames} from './video-map-name-input.mjs';
import {MapPositionMatcher} from '../map-position.mjs';
import {deriveVideoPlayerMapInput} from './video-player-map-input.mjs';
import {readRomInitialHeading} from './rom-initial-heading.mjs';
import {mountMapVideoComparison} from './map-video-comparison.mjs?v=mse-explicit-20261005-0443';
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
let rom,project,catalog,maps=[],record,automatic,floors,image,point,renderer,version=0,loaded=false,renderVersion=0,romSHA256=null,positionMatcher=null,markerInput=null;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const residualClient=new ResidualRecognitionClient();let encounterTables=null;
const nameClient=new CPUTextClient();let nameInput=null;
const videoComparison=mountMapVideoComparison({renderBackground:render,derivePlayerBackground:renderFromMarker,deriveMapBackground:renderFromName,classifyResiduals:classifyBackgroundResiduals,cancelPending:()=>{nameClient.cancel();residualClient.cancel();}});
function clearView(){$('marker-details').textContent='';$('marker-status').textContent='描画入力が変わりました。固定映像の上画面から再計算します。';renderVersion++;videoComparison.invalidate('背景の入力が変わりました。');ctx.clearRect(0,0,256,192);$('draw').disabled=true;point=null;markerInput=null;$('floor').replaceChildren();$('floor').disabled=true;}
function reportError(e){videoComparison.invalidate('背景の描画に失敗しました。',{resetTracking:true});$('status').textContent='描画できません：'+e.message;console.error(e);}
function guard(fn){return async event=>{try{await fn(event);}catch(e){reportError(e);}};}
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
async function responseBytes(url){const r=await fetch(url);if(!r.ok)throw Error('必要なファイルを読めません: '+url+' ('+r.status+')');return r;}
$('rom').onchange=guard(async()=>{
 nameClient.cancel();residualClient.release();nameInput=null;$('name-input-candidates').replaceChildren();$('name-input-details').textContent='';const id=++version,file=$('rom').files[0];clearView();loaded=false;for(const x of['search','map','descriptor'])$(x).disabled=true;if(!file)return;
 $('status').textContent='ROMとマップ一覧を読んでいます…';await frame();const bytes=new Uint8Array(await file.arrayBuffer());if(id!==version)return;
 const p=openMapRom(bytes),c=buildRomMapCatalog(p);let csv='';try{csv=await(await responseBytes('../data/map-id-names.csv')).text();}catch(e){throw Error('既存マップ名一覧の取得に失敗: '+e.message);}
 const w=await(await responseBytes('../wasm/map_render.wasm')).arrayBuffer(),inst=await WebAssembly.instantiate(w,{});if(id!==version)return;
 romSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(id!==version)return;rom=bytes;project=p;catalog=c;maps=nameCatalogMaps(c,csv);renderer=new MapRenderer(inst.instance);positionMatcher=new MapPositionMatcher(inst.instance);loaded=true;$('search').disabled=false;$('map').disabled=false;filterMaps();await videoComparison.renderCurrent();
});
function filterMaps(){if(!loaded)return;const q=$('search').value.trim().toLocaleLowerCase(),old=$('map').value,rows=maps.filter(m=>(m.displayLabel+' '+m.fieldCode).toLocaleLowerCase().includes(q));$('map').replaceChildren(new Option('マップを選択',''),...rows.map(r=>new Option(r.displayLabel,r.key)));if(rows.some(r=>r.key===old))$('map').value=old;else{clearView();record=null;image=null;mapCtx.clearRect(0,0,$('minimap').width,$('minimap').height);$('descriptor').replaceChildren();$('descriptor').disabled=true;}$('mapstatus').textContent=rows.length+'件。マップを選択してください。';}
$('search').oninput=filterMaps;
$('map').onchange=guard(async()=>{
 nameClient.cancel();nameInput=null;$('automatic-map-name').checked=false;
 const id=++version;clearView();image=null;mapCtx.clearRect(0,0,$('minimap').width,$('minimap').height);automatic=null;floors=null;record=maps.find(r=>r.key===$('map').value);if(!record)return;
 $('status').textContent='ROMの配置と床を読んでいます…';await frame();if(id!==version)return;automatic=loadAutomaticScene(project,record);floors=loadRomFloorInstances(project,automatic.plan);
 $('descriptor').replaceChildren(...record.minimapCandidates.map(d=>new Option(d.path+' ('+d.relation+')',d.path)));$('descriptor').disabled=!record.minimapCandidates.length;
 if(!record.minimapCandidates.length){$('mapstatus').textContent='このマップに対応する地図画像は未解決です。';$('status').textContent='地図との対応が未解決のためクリック描画はできません。';return;}showMap();await videoComparison.renderCurrent();
});
function showMap(){clearView();image=renderer.compose(catalog.minimap,$('descriptor').value);const canvas=$('minimap');canvas.width=image.width;canvas.height=image.height;mapCtx.putImageData(new ImageData(image.rgba,image.width,image.height),0,0);$('mapstatus').textContent=record.displayLabel+'。歩ける地点をクリックしてください。';$('status').textContent='地図から描画地点を選択してください。';}
$('descriptor').onchange=guard(async()=>{showMap();await videoComparison.renderCurrent();});
function markPoint(x,y){mapCtx.putImageData(new ImageData(image.rgba,image.width,image.height),0,0);mapCtx.strokeStyle='#ff4040';mapCtx.lineWidth=1;mapCtx.beginPath();mapCtx.moveTo(x-5,y);mapCtx.lineTo(x+5,y);mapCtx.moveTo(x,y-5);mapCtx.lineTo(x,y+5);mapCtx.stroke();}
$('minimap').onclick=guard(async event=>{
 if(!image||!automatic)return;$('automatic-map-name').checked=false;$('automatic-player').checked=false;const box=$('minimap').getBoundingClientRect(),x=(event.clientX-box.left)*image.width/box.width,y=(event.clientY-box.top)*image.height/box.height;clearView();point=mapClickWorld(image,x,y);markPoint(x,y);
 const q=floorHeightsAtXZ(floors,point.xFx,point.zFx);$('diagnostics').textContent=JSON.stringify({map:record.displayLabel,floor:q,unresolved:automatic.unresolved},null,2);
 if(!q.heightsFx.length){$('status').textContent='この地点の床が見つかりません。通路や床の上を選び直してください。未対応の床形状は詳細欄に表示します。';return;}
 $('floor').replaceChildren(...q.heightsFx.map((v,i)=>new Option('床候補'+(i+1)+' 高さ '+(v/4096).toFixed(3),String(v))));$('floor').disabled=q.heightsFx.length===1;$('draw').disabled=false;await render();
});
async function loadNamedMap(candidate,input,evidence){
 if(!loaded||input.frameId!==videoComparison.frameId()||evidence.romSHA256!==romSHA256)return;
 const id=++version;clearView();image=null;automatic=null;floors=null;record=maps.find(r=>r.key===candidate.key);
 if(!record)throw Error('名前候補のROM recordが現在のcatalogにありません');
 $('search').value='';$('map').replaceChildren(...evidence.maps.map(r=>new Option(r.displayLabel,r.key)));$('map').value=record.key;
 $('status').textContent='映像の名前候補からROM配置と床を読んでいます…';await frame();if(id!==version||input.frameId!==videoComparison.frameId())return;
 automatic=loadAutomaticScene(project,record);floors=loadRomFloorInstances(project,automatic.plan);
 $('descriptor').replaceChildren(...record.minimapCandidates.map(d=>new Option(d.path+' ('+d.relation+')',d.path)));$('descriptor').disabled=record.minimapCandidates.length<2;
 if(record.minimapCandidates.length!==1)throw Error('名前候補の地図画像が無い、または複数です。全候補を保持し自動選択を保留します');
 showMap();nameInput=evidence;await renderFromMarker(input);
}
async function renderFromName(input){
 if(!loaded||!project){$('name-input-status').textContent='固定映像を保持しています。NDSを選択してください。';return;}
 const id=++version;clearView();nameInput=null;$('name-input-status').textContent='NDSフォントで同じ上画面の名前候補を照合しています（CPU上限10秒）…';await frame();if(id!==version||input.frameId!==videoComparison.frameId())return;
 const evidence=await deriveVideoMapNames({...input,romSHA256,project,records:maps,matchText:(image,args)=>nameClient.match(image,{...args,romEpoch:id,stamp:{romEpoch:id,frameId:input.frameId,...input.frameEvidence}})});
 if(id!==version||input.frameId!==videoComparison.frameId())return;
 $('name-input-details').textContent=JSON.stringify(evidence,null,2);$('name-input-candidates').replaceChildren(...evidence.maps.map(r=>{const button=document.createElement('button');button.textContent=r.displayLabel+'（候補として描画）';button.onclick=guard(()=>loadNamedMap(r,input,evidence));return button;}));
 $('name-input-status').textContent=evidence.maps.length?'映像から地図候補 '+evidence.maps.length+'件: '+evidence.nameCandidates.names.join(' / ')+'。未探索の文字・同名候補を残し、現在地の確定ではありません。':'名前候補は未解決: '+evidence.status+'。既知の地図名は補いません。';
 if(evidence.maps.length===1)await loadNamedMap(evidence.maps[0],input,evidence);
}
async function renderFromMarker(input){
 if(!image||!record||!floors||!positionMatcher){$('marker-status').textContent='固定映像を保持しています。ROMとマップを選択してください。';return;}
 clearView();const id=version;await frame();if(id!==version||input.frameId!==videoComparison.frameId())return;
 const result=deriveVideoPlayerMapInput({...input,mapImage:image,mapId:record.mapId,matcher:positionMatcher,floors});
 const upper=$('comparison-upper');upper.width=256;upper.height=192;const uc=upper.getContext('2d');uc.putImageData(new ImageData(result.upper.rgba,256,192),0,0);uc.strokeStyle='#f44';
 for(const m of result.markers.candidates)uc.strokeRect(m.bounds.x-1,m.bounds.y-1,m.bounds.w+2,m.bounds.h+2);
 const evidence={...result,upper:{width:256,height:192}};$('marker-details').textContent=JSON.stringify(evidence,null,2);
 if(!['position-candidate','floor-unresolved-or-multiple'].includes(result.status)||!result.primaryCandidate?.floor.heightsFx.length){$('marker-status').textContent='上画面からの位置供給は未解決: '+result.status;return;}
 const c=result.primaryCandidate,heading=readRomInitialHeading(project.sdk);point={...c.world,source:c.coordinate};markerInput={evidence,heading};markPoint(c.image.x,c.image.y);
 const multiple=c.floor.heightsFx.length>1;$('floor').replaceChildren(...(multiple?[new Option('ROM床候補を選択（未確定）','')]:[]),...c.floor.heightsFx.map(v=>new Option('ROM床候補 '+(v/4096).toFixed(3),String(v))));$('floor').disabled=!multiple;$('draw').disabled=multiple;const headings=readRomCameraYawCandidates(project.sdk);markerInput.headingAlternatives=headings;$('rom-yaw-candidate').replaceChildren(...headings.candidates.map(h=>new Option(h.kind+' '+h.yawDegrees+'°',String(h.yawDegrees))));
 $('yaw').value=String(heading.yawDegrees);$('yawlabel').value=heading.yawDegrees+'°';
 $('marker-status').textContent=(multiple?'複数のROM床が残るため候補を選択してください。':'先頭色の点候補→ROM地図位置→唯一の床を取得しました。')+'初期カメラ向きをROM命令から供給して描画します。点の本人対応と映像時点のカメラ変更は未確認です。';
 if(!multiple)await render();
}
async function render(){
 if(!point||!$('floor').options.length||$('floor').value==='')return;const id=version,drawId=++renderVersion,comparisonFrameId=videoComparison.frameId();videoComparison.invalidate('背景を再描画しています。');const selected={...point,yFx:Number($('floor').value),yawDegrees:Number($('yaw').value)};$('status').textContent='CPUで描画しています…';await frame();if(id!==version||drawId!==renderVersion)return;
 const camera=automaticPreviewCamera(project,rom,record,selected),active=applyAutomaticMaterialEnvironment(project,record,automaticBillboardScenes(project,automatic,camera.viewFx));
 if(!active.environmentApplied){$('diagnostics').textContent=JSON.stringify(active.environment,null,2);throw Error('ROMの初期環境をまだ適用できません: '+active.environment.unresolved.join('; '));}
 const parts=active.scenes.map(s=>prepareDrawPackets(s,{materialGlobals:active.environment.materialGlobals,masks:automatic.masks})),packets={draws:parts.flatMap(x=>x.draws)},requestedRenderer=$('render-profile').value;
 const integer=requestedRenderer==='legacy'?null:renderInitialIntegerFog(project,rom,record,active,camera,{applyFog:requestedRenderer==='integer-fog',screenEffectPhase:$('mse-initial-effect').checked?{kind:'source-constructor'}:null});
 const r=integer?.ready?integer:rasterizePreviewPackets(packets,{view:identity,projection:camera.projectionFx.map(x=>x/4096),clearRGBA:[0,0,0,0],colorProfile:'native-mode0-rgb'}),backend=integer?.ready?'source-integer-static-mode1':'float64-diagnostic',fogApplied=integer?.ready===true&&integer.diagnostics.fogApplied===true;
 const rendererEvidence={requestedRenderer,backend,fogApplied,fallback:integer&&!integer.ready?{reason:integer.reason,diagnostics:integer.diagnostics}:null,integer:integer?.ready?integer.diagnostics:null};
 ctx.putImageData(new ImageData(r.rgba,r.width,r.height),0,0);const blocked=[...active.unresolved,...active.scenes.flatMap(s=>s.unsupported).filter(x=>!x.reason.startsWith('name-char3-A')),...parts.flatMap(p=>p.unsupported),...r.stats.rejected];
 $('status').textContent=(r.stats.fragments?'CPU描画しました。':blocked.length?'未対応項目のため描画できません。':'この向きでは描画対象が見えません。')+(blocked.length?' 未対応の描画項目があります。':'')+(integer?.ready?(fogApplied?' ROM整数描画と時間独立の霧を適用しました。':' ROM整数描画（霧なし比較）です。'):' Float64プレビュー（霧なし）です。')+(integer&&!integer.ready?' 整数経路の条件未成立でfallback: '+integer.reason:'')+' 初期状態の仮説です。現在の動的状態とnative画像一致は未確認です。';
 const evidence={romSHA256,recordKey:record.key,mapId:record.mapId,fieldCode:record.fieldCode,selected,viewFx:camera.viewFx,projectionFx:camera.projectionFx,cameraScope:camera.scope,renderScope:r.scope,stats:r.stats,unresolved:blocked,floorUnresolved:floors.unsupported,fogApplied,rendererEvidence,liveCameraVerified:false,playerInput:markerInput,nameInput};videoComparison.setBackground(r,evidence,comparisonFrameId);
 $('diagnostics').textContent=JSON.stringify({map:record.displayLabel,backend,rendererEvidence,point,floor:Number($('floor').value),floorUnresolved:floors.unsupported,cameraScope:camera.scope,renderScope:r.scope,environment:active.environment.scope,colorReady:active.environment.colorReady,fogReady:active.environment.fogReady,fogUnresolved:active.environment.fogUnresolved,fogApplied,stats:r.stats,unresolved:blocked},null,2);
}
$('mse-initial-effect').onchange=guard(render);$('rom-yaw-candidate').onchange=guard(async()=>{if($('rom-yaw-candidate').value==='')return;$('yaw').value=$('rom-yaw-candidate').value;$('yawlabel').value=$('yaw').value+'°';await render();});$('floor').onchange=guard(async()=>{$('draw').disabled=$('floor').value==='';await render();});$('draw').onclick=guard(render);$('yaw').oninput=()=>{$('automatic-map-name').checked=false;$('automatic-player').checked=false;markerInput=null;renderVersion++;videoComparison.invalidate('向きが変わりました。');$('yawlabel').value=$('yaw').value+'°';};$('yaw').onchange=guard(render);

$('render-profile').onchange=guard(render);

async function classifyBackgroundResiduals(input){
 const key=romSHA256,frameId=videoComparison.frameId();if(input.backgroundEvidence.romSHA256!==key)throw Error('背景とROMの識別が異なります');
 const catalog=await residualClient.load(rom,key);if(romSHA256!==key||videoComparison.frameId()!==frameId)throw Error('比較中に入力が変わりました');
 encounterTables??=(await(await responseBytes('../data/enc.json')).json()).main;
 const retained=input.backgroundEvidence.nameInput?.maps?.map(m=>m.mapId)??[input.backgroundEvidence.mapId],variant=$('residual-model-variant').value,plan=residualModelPlan(project,retained,{catalog,tables:encounterTables,variant}),modelIds=plan.models.map(m=>m.modelId),classifications=[];
 if(!modelIds.length)throw Error('同frameのmap/table候補からROMモデルを供給できません: '+JSON.stringify(plan.unsupported));
 for(const regionId of input.regionIds){const region=input.regions.find(r=>r.id===regionId);if(!region)throw Error('元残差領域が変わりました');let sourceROI=null,cropSHA256=null;const batches=[],rankings=[];
  for(let first=0;first<modelIds.length;first+=4){
   if(romSHA256!==key||videoComparison.frameId()!==frameId)throw Error('比較中に入力が変わりました');
   const request=residualClassificationRequest({...input,gameplayROI:input.videoEvidence.roi,region,modelIds:modelIds.slice(first,first+4),variant,romEpoch:residualClient.epoch});sourceROI=request.captureStamp.enemyROI;
   cropSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',request.crop.rgba)),x=>x.toString(16).padStart(2,'0')).join('');
   const result=await residualClient.classify(request,input.onProgress);batches.push({...result,rankings:result.rankings.map(({thumbnail,...r})=>r)});rankings.push(...result.rankings.map(({thumbnail,...r})=>r));
  }
  rankings.sort((a,b)=>a.distance-b.distance||a.modelId.localeCompare(b.modelId));classifications.push({regionId,sourceROI,cropSHA256,batches,rankings});
  input.onPartial?.({...residualObservationBundle({...input,plan,classifications}),classificationJob:{complete:false,requestedRegionIds:input.regionIds,completed:classifications.length}});
 }
 return {...residualObservationBundle({...input,plan,classifications}),classificationJob:{complete:true,requestedRegionIds:input.regionIds,completed:classifications.length}};
}
