import {mountResidualInferencePreparation} from './residual-inference-preparation.mjs?v=monster-map-cpu-20261006-1005';
import {createVideoTrackingAT,videoATSearchOptions} from './video-tracking-at.mjs?v=camera-body-alternative-20261006-1430';
import {runResidualRecognitionJob} from './residual-recognition-job.mjs?v=native-transport-timing-20261006-1140';
import {VideoMapContinuity} from './video-map-continuity.mjs?v=monster-map-cpu-20261006-1005';
import {AutomaticVideoAlignment} from './automatic-video-alignment.mjs?v=native-transport-timing-20261006-1140';
import {resolveVideoMinimapCandidates} from './video-minimap-candidates.mjs?v=field-registration-20261006-0913';
import {readRomCameraYawCandidates} from './read-rom-camera-yaw-candidates.mjs';
import {ResidualRecognitionClient} from './residual-recognition-client.mjs?v=native-transport-timing-20261006-1140';
import {residualModelPlan} from './residual-recognition-input.mjs?v=native-transport-timing-20261006-1140';
import {renderInitialIntegerFog} from './integer-static-fog.mjs?v=enc-motion-at-20261006-1156';
import {CPUTextClient} from '../font-akinator-cpu-client.mjs?v=provided-layout-20261005';
import {deriveVideoMapNames} from './video-map-name-input.mjs?v=field-registration-20261006-0913';
import {MapPositionMatcher} from '../map-position.mjs';
import {deriveVideoPlayerMapInput} from './video-player-map-input.mjs?v=field-registration-20261006-0913';
import {readRomInitialHeading} from './rom-initial-heading.mjs';
import {mountMapVideoComparison} from './map-video-comparison.mjs?v=native-transport-timing-20261006-1140';
import {openMapRom} from './static-scene.mjs?v=native-source-reuse-20261006-1028';
import {buildRomMapCatalog} from './rom-map-catalog.mjs';
import {nameCatalogMaps} from './rom-map-names.mjs';
import {MapRenderer} from './minimap-preview.mjs';
import {loadAutomaticScene} from './automatic-scene.mjs';
import {automaticBillboardScenes} from './automatic-billboard-scene.mjs';
import {applyAutomaticMaterialEnvironment} from './automatic-material-environment.mjs?v=native-body-20261006-0212';
import {loadRomFloorInstances,floorHeightsAtXZ} from './rom-floor-candidates.mjs';
import {mapClickWorld,automaticPreviewCamera} from './automatic-preview-camera.mjs';
import {prepareDrawPackets} from './draw-packets.mjs';
import {rasterizePreviewPackets} from './cpu-preview.mjs';
const $=id=>document.getElementById(id),ctx=$('view').getContext('2d'),mapCtx=$('minimap').getContext('2d');
let rom,project,catalog,maps=[],record,automatic,floors,image,point,renderer,version=0,loaded=false,renderVersion=0,romSHA256=null,positionMatcher=null,markerInput=null;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const residualClient=new ResidualRecognitionClient();let encounterTables=null;
mountResidualInferencePreparation(document,window);
const mapContinuity=new VideoMapContinuity();
for(const id of ['comparison-file','comparison-layout'])$(id).addEventListener('change',()=>mapContinuity.reset());
const nameClient=new CPUTextClient({reuseWorker:true});let nameRomEpoch=0;let nameInput=null,pendingNamedMap=null,automaticSearch=null,automaticMsePhase=null;
const trackingAT=createVideoTrackingAT({engineRevision:'sha256:e14f431e81e0441c9f87e49dcd83c0545cc4dd6e34ee3bba1d2852766f1e6305',getTables:()=>encounterTables??{},getOptions:()=>videoATSearchOptions({seed:$('video-at-seed').value,seedProvenance:'User-supplied initial seed, not inferred from video',first:$('video-at-first').value,last:$('video-at-last').value,indexProvenance:'User-specified advanced conditional terminal-index interval; outside interval remains possible'},encounterTables??{}),onState:value=>{$('video-at-status').textContent=value.reason;$('video-at-details').textContent=JSON.stringify(value,null,2);}});
for(const id of ['video-at-seed','video-at-first','video-at-last'])$(id).addEventListener('input',()=>trackingAT.cancel('AT入力を変更しました。再試行または次の動画観測を待ちます。',{retainObservation:true}));
$('video-at-retry').onclick=()=>trackingAT.retry();
const videoComparison=mountMapVideoComparison({onAutomaticStart:()=>automaticSearch?.backgroundRenderer?.begin(),onObservationBundle:bundle=>trackingAT.observe(bundle),onObservationReset:reason=>trackingAT.cancel(reason),canAnalyze:()=>loaded,getRomIdentity:()=>romSHA256,getRecognitionContext:()=>({romEpoch:nameRomEpoch,variant:$('residual-model-variant').value,backend:$('residual-inference-backend')?.value??'wasm'}),renderBackground:render,derivePlayerBackground:renderFromMarker,deriveMapBackground:renderFromName,classifyResiduals:classifyBackgroundResiduals,cancelSearch:()=>{version++;$('auto-search-status').textContent='自動探索を中止しました。';},cancelPending:()=>{nameClient.cancel();residualClient.cancel();}});
function clearView({comparisonAlreadyCleared=false}={}){automaticMsePhase=null;$('marker-details').textContent='';$('marker-status').textContent='描画入力が変わりました。固定映像の上画面から再計算します。';renderVersion++;if(!comparisonAlreadyCleared)videoComparison.invalidate('背景の入力が変わりました。');ctx.clearRect(0,0,256,192);$('draw').disabled=true;point=null;markerInput=null;$('floor').replaceChildren();$('floor').disabled=true;}
function reportError(e){videoComparison.invalidate('背景の描画に失敗しました。',{resetTracking:true});$('status').textContent='描画できません：'+e.message;console.error(e);}
function guard(fn){return async event=>{try{await fn(event);}catch(e){reportError(e);}};}
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
async function responseBytes(url){const r=await fetch(url);if(!r.ok)throw Error('必要なファイルを読めません: '+url+' ('+r.status+')');return r;}
$('rom').onchange=async()=>{
 const id=++nameRomEpoch;try{
 mapContinuity.reset();automaticSearch?.backgroundRenderer?.destroy();automaticSearch=null;videoComparison.resetSource('rom-replacement');nameClient.destroy();
 nameClient.cancel();residualClient.release();nameInput=null;pendingNamedMap=null;$('name-input-candidates').replaceChildren();$('name-input-details').textContent='';version++;const file=$('rom').files[0];clearView();loaded=false;for(const x of['search','map','descriptor'])$(x).disabled=true;if(!file)return;
 $('status').textContent='ROMとマップ一覧を読んでいます…';await frame();const bytes=new Uint8Array(await file.arrayBuffer());if(id!==nameRomEpoch)return;
 const p=openMapRom(bytes),c=buildRomMapCatalog(p);let csv='';try{csv=await(await responseBytes('../data/map-id-names.csv')).text();}catch(e){throw Error('既存マップ名一覧の取得に失敗: '+e.message);}
 const w=await(await responseBytes('../wasm/map_render.wasm')).arrayBuffer(),inst=await WebAssembly.instantiate(w,{});if(id!==nameRomEpoch)return;
 const romHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(id!==nameRomEpoch)return;romSHA256=romHash;rom=bytes;project=p;catalog=c;const sourceAngles=readRomCameraYawCandidates(p.sdk).candidates.map(h=>h.yawDegrees>180?h.yawDegrees-360:h.yawDegrees);$('yaw').min=String(Math.min(...sourceAngles));$('yaw').max=String(Math.max(...sourceAngles));maps=nameCatalogMaps(c,csv);renderer=new MapRenderer(inst.instance);positionMatcher=new MapPositionMatcher(inst.instance);automaticSearch=new AutomaticVideoAlignment({project,rom,romSHA256,catalog,records:maps,renderer,matcher:positionMatcher,wasm:inst.instance});loaded=true;videoComparison.inputsReady();$('search').disabled=false;$('map').disabled=false;filterMaps();await videoComparison.renderCurrent(); }catch(e){if(id===nameRomEpoch)reportError(e);}
};
function filterMaps(){if(!loaded)return;const q=$('search').value.trim().toLocaleLowerCase(),old=$('map').value,rows=maps.filter(m=>(m.displayLabel+' '+m.fieldCode).toLocaleLowerCase().includes(q));$('map').replaceChildren(new Option('マップを選択',''),...rows.map(r=>new Option(r.displayLabel,r.key)));if(rows.some(r=>r.key===old))$('map').value=old;else{clearView();record=null;image=null;mapCtx.clearRect(0,0,$('minimap').width,$('minimap').height);$('descriptor').replaceChildren();$('descriptor').disabled=true;}$('mapstatus').textContent=rows.length+'件。マップを選択してください。';}
$('search').oninput=filterMaps;
$('map').onchange=guard(async()=>{
 nameClient.cancel();nameInput=null;pendingNamedMap=null;$('automatic-map-name').checked=false;
 const id=++version;clearView();image=null;mapCtx.clearRect(0,0,$('minimap').width,$('minimap').height);automatic=null;floors=null;record=maps.find(r=>r.key===$('map').value);if(!record)return;
 $('status').textContent='ROMの配置と床を読んでいます…';await frame();if(id!==version)return;automatic=loadAutomaticScene(project,record);floors=loadRomFloorInstances(project,automatic.plan);
 $('descriptor').replaceChildren(...record.minimapCandidates.map(d=>new Option(d.path+' ('+d.relation+')',d.path)));$('descriptor').disabled=!record.minimapCandidates.length;
 if(!record.minimapCandidates.length){$('mapstatus').textContent='このマップに対応する地図画像は未解決です。';$('status').textContent='地図との対応が未解決のためクリック描画はできません。';return;}showMap();await videoComparison.renderCurrent();
});
function showMap(){clearView();image=renderer.compose(catalog.minimap,$('descriptor').value);const canvas=$('minimap');canvas.width=image.width;canvas.height=image.height;mapCtx.putImageData(new ImageData(image.rgba,image.width,image.height),0,0);$('mapstatus').textContent=record.displayLabel+'。歩ける地点をクリックしてください。';$('status').textContent='地図から描画地点を選択してください。';}
$('descriptor').onchange=guard(async()=>{if(!$('descriptor').value)return;showMap();if(pendingNamedMap&&pendingNamedMap.input.frameId===videoComparison.frameId()&&pendingNamedMap.recordKey===record.key){nameInput=pendingNamedMap.evidence;await renderFromMarker(pendingNamedMap.input);}else await videoComparison.renderCurrent();});
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
 nameInput=evidence;pendingNamedMap={recordKey:record.key,input,evidence};
 $('descriptor').replaceChildren(new Option('ROM地図画像候補を照合中',''),...record.minimapCandidates.map(d=>new Option(d.path+' ('+d.relation+')',d.path)));$('descriptor').disabled=true;
 if(!record.minimapCandidates.length){$('descriptor').replaceChildren(new Option('対応するROM地図画像が未解決',''));$('mapstatus').textContent='このmap recordに結び付く地図画像は0件です。名前候補と映像を保持しています。';$('status').textContent='地図画像の供給が未解決です。別の名前候補も保持しています。';return;}
 const selection=await resolveVideoMinimapCandidates({record,catalog,renderer,matcher:positionMatcher,floors,...input,onCandidate:async row=>{$('mapstatus').textContent='ROM地図画像候補を比較: '+row.path;await frame();},isCurrent:()=>id===version&&input.frameId===videoComparison.frameId()});
 nameInput={...evidence,descriptorSelection:selection.diagnostics};pendingNamedMap.evidence=nameInput;$('name-input-details').textContent=JSON.stringify(nameInput,null,2);
 $('descriptor').replaceChildren(...(selection.chosen?[]:[new Option('ROM地図画像候補を選択（未確定）','')]),...record.minimapCandidates.map(d=>new Option(d.path+' ('+d.relation+')',d.path)));$('descriptor').disabled=record.minimapCandidates.length===1&&Boolean(selection.chosen);
 if(!selection.chosen){$('mapstatus').textContent='地図画像候補'+record.minimapCandidates.length+'件を保持。単一候補には確定できないため地図画像欄で比較する候補を選択してください。';$('status').textContent='地図画像候補の選択待ち（例外ではありません）。';return;}
 $('descriptor').value=selection.chosen.path;showMap();await renderFromMarker(input);
}
async function renderFromName(input){
 if(!loaded||!project){$('name-input-status').textContent='固定映像を保持しています。NDSを選択してください。';return;}
 // Continuous analyze already cleared this new frame's comparison while retaining
 // independently owned older classification jobs. Only reset the preview here.
 const id=++version;clearView({comparisonAlreadyCleared:input.automaticRecognition===true});nameInput=null;$('name-input-status').textContent='既知マップを先に再照合し、未解決の場合はNDSフォントで名前候補を探索します…';await frame();if(id!==version||input.frameId!==videoComparison.frameId())return;
 const reuse=input.automaticRecognition&&automaticSearch?await mapContinuity.probe({input,alignment:automaticSearch,isCurrent:()=>id===version&&input.frameId===videoComparison.frameId()}):null;
 if(id!==version||input.frameId!==videoComparison.frameId())return;
 if(!reuse)mapContinuity.stats.nameSearches++;
 const evidence=reuse?.evidence??await deriveVideoMapNames({...input,romSHA256,project,records:maps,matchText:(image,args)=>nameClient.match(image,{...args,romEpoch:nameRomEpoch,stamp:{romEpoch:nameRomEpoch,frameId:input.frameId,...input.frameEvidence}})});
 if(id!==version||input.frameId!==videoComparison.frameId())return;
 $('name-input-details').textContent=JSON.stringify(evidence,null,2);$('name-input-candidates').replaceChildren(...evidence.maps.map(r=>{const button=document.createElement('button');button.textContent=r.displayLabel+'（候補として描画）';button.onclick=guard(()=>loadNamedMap(r,input,evidence));return button;}));
 $('name-input-status').textContent=reuse?'既知マップを同フレームの地図全体で再照合しました。名前候補・地図別名と未確定性を保持しています。':evidence.maps.length?'映像から地図候補 '+evidence.maps.length+'件: '+evidence.nameCandidates.names.join(' / ')+'。未探索の文字・同名候補を残し、現在地の確定ではありません。':'名前候補は未解決: '+evidence.status+'。既知の地図名は補いません。';
 if(input.automaticRecognition){await runAutomaticSearch(input,evidence,id,reuse?.prevalidatedMaps);return;}if(evidence.maps.length===1)await loadNamedMap(evidence.maps[0],input,evidence);
}
async function runAutomaticSearch(input,evidence,id,prevalidatedMaps=null){
 if(!automaticSearch)return;const result=await automaticSearch.search({input,names:evidence,prevalidatedMaps,isCurrent:()=>id===version&&input.frameId===videoComparison.frameId(),onProgress:async p=>{$('auto-search-status').textContent=p.message;$('comparison-status').textContent=p.message;await frame();}});
 if(id!==version||input.frameId!==videoComparison.frameId())return;
 mapContinuity.remember(input,evidence,result);
 result.diagnostics.mapContinuity={...mapContinuity.stats,reused:Boolean(prevalidatedMaps),mapIdentityCertified:false};
 videoComparison.observeMapCandidates(input.frameId,result.located.map(s=>({recordKey:s.record.key,mapId:s.record.mapId,fieldCode:s.record.fieldCode,descriptorPath:s.reference.path,world:s.position.world,floorHeightsFx:s.position.floor.heightsFx,mapIdentityCertified:false,playerIdentityCertified:false})),{mapNameCandidates:evidence.maps.map(m=>({recordKey:m.key,mapId:m.mapId,fieldCode:m.fieldCode})),nameStatus:evidence.status,unsearchedTextPossible:true,backgroundAlternatives:result.diagnostics.backgroundCandidates,mapSearchDiagnostics:result.diagnostics.mapCandidates,monsterWorkflow:result.diagnostics.monsterWorkflow});
 $('auto-search-details').textContent=JSON.stringify(result.diagnostics,null,2);if(result.diagnostics.monsterWorkflow?.allSkipped){const message='地図候補と動画時刻を保持しました。ROMエンカウント参照がない候補は、敵特定用の背景・カメラ探索を省略します。敵の不在やAT消費ゼロの確定ではありません。';$('auto-search-status').textContent=message;$('comparison-status').textContent=message;$('status').textContent=message;return;}if(!result.selected){if(result.located.length===1){const s=result.located[0];record=s.record;automatic=s.scene.automatic;floors=s.scene.floors;image=s.reference.image;point={...s.position.world,source:s.position.coordinate};markerInput={evidence:s.reference.result};nameInput=evidence;$('map').replaceChildren(...evidence.maps.map(r=>new Option(r.displayLabel,r.key)));$('map').value=record.key;$('descriptor').replaceChildren(...record.minimapCandidates.map(d=>new Option(d.path,d.path)));$('descriptor').value=s.reference.path;$('descriptor').disabled=false;const c=$('minimap');c.width=image.width;c.height=image.height;markPoint(s.position.image.x,s.position.image.y);$('mapstatus').textContent=record.displayLabel+' / '+s.reference.path+'（地図候補取得済み）';$('marker-details').textContent=JSON.stringify(s.position,null,2);$('marker-status').textContent='地図・位置候補を取得済み: X='+point.xFx+'/4096、Z='+point.zFx+'/4096。';$('floor').replaceChildren(...s.position.floor.heightsFx.map(v=>new Option('ROM床候補 '+(v/4096).toFixed(3),String(v))));$('floor').disabled=s.position.floor.heightsFx.length===1;$('auto-search-status').textContent='地図・位置候補は取得できました。背景描画は未対応の条件があり、位置合わせ・敵特定は未完です。';$('status').textContent=result.diagnostics.backgroundCandidates.map(r=>r.unsupported).filter(Boolean).join('; ');$('comparison-status').textContent='地図探索結果を保持しています。背景条件が未解決のため差分はまだ出していません。';}else{$('auto-search-status').textContent='地図・位置候補を一つに確定できません。候補と未対応の内訳を保持しています。';}return;}
 const s=result.selected;record=s.record;automatic=s.scene.automatic;floors=s.scene.floors;image=s.reference.image;point={xFx:s.point.xFx,zFx:s.point.zFx,source:s.position.coordinate,geometryRefinement:s.row.geometryRefinement??null};nameInput={...evidence,automaticSearch:result.diagnostics};pendingNamedMap=null;const {upper,...positionEvidence}=s.reference.result;markerInput={evidence:positionEvidence,heading:s.heading};$('marker-details').textContent=JSON.stringify(positionEvidence,null,2);$('marker-status').textContent=(s.row.mapCandidateKind==='fixed-display-anchor-source-scene-inverse'?'ROM形状と映像から条件付き位置候補を取得（上画面マーカーは表示アンカー）: X=':'上画面からROM座標候補を取得: X=')+s.point.xFx+'/4096、Z='+s.point.zFx+'/4096。床・向き候補を自動比較済み。';$('mapstatus').textContent=record.displayLabel+' / '+s.reference.path+'（自動選択した背景仮説）';$('status').textContent='ROM背景候補'+result.diagnostics.backgroundCandidates.length+'件を比較し描画しました。';if(upper){const c=$('comparison-upper');c.width=upper.width;c.height=upper.height;c.getContext('2d').putImageData(new ImageData(upper.rgba,upper.width,upper.height),0,0);}const hs=s.row.rotationPolicy.candidates;$('rom-yaw-candidate').replaceChildren(...hs.map(h=>new Option(h.kind??'ROM初期向き',String(h.yawDegrees>180?h.yawDegrees-360:h.yawDegrees))));$('rom-yaw-candidate').value=String(s.point.yawDegrees>180?s.point.yawDegrees-360:s.point.yawDegrees);
 $('map').replaceChildren(...evidence.maps.map(r=>new Option(r.displayLabel,r.key)));$('map').value=record.key;$('descriptor').replaceChildren(...record.minimapCandidates.map(d=>new Option(d.path,d.path)));$('descriptor').value=s.reference.path;$('descriptor').disabled=false;
 const canvas=$('minimap');canvas.width=image.width;canvas.height=image.height;markPoint(s.position.image.x,s.position.image.y);const displayedFloor=s.integer?.diagnostics?.automaticMode2?.refinedFloor??s.position.floor;$('floor').replaceChildren(...displayedFloor.heightsFx.map(v=>new Option('ROM床候補 '+(v/4096).toFixed(3),String(v))));$('floor').value=String(s.position.geometricYFx??s.point.yFx);$('floor').disabled=displayedFloor.heightsFx.length===1;$('yaw').value=String(s.point.yawDegrees>180?s.point.yawDegrees-360:s.point.yawDegrees);$('yawlabel').value=$('yaw').value+'°';automaticMsePhase=s.row.phase;$('mse-initial-effect').checked=Boolean(s.row.phase);$('draw').disabled=false;
 ctx.putImageData(new ImageData(s.image.rgba,s.image.width,s.image.height),0,0);const rendererEvidence={requestedRenderer:'automatic-source-candidates',backend:s.row.backend,fogApplied:s.integer.ready&&s.integer.diagnostics.fogApplied,fallback:s.integer.ready?null:{reason:s.integer.reason},integer:s.integer.ready?s.integer.diagnostics:null};
 const background={romSHA256,backgroundBranchSupport:result.backgroundBranchSupport,recordKey:record.key,mapId:record.mapId,fieldCode:record.fieldCode,selected:s.point,viewFx:s.camera.viewFx,projectionFx:s.camera.projectionFx,cameraScope:s.camera.scope,renderScope:s.image.scope,stats:s.image.stats,unresolved:s.unresolved,floorUnresolved:floors.unsupported,fogApplied:rendererEvidence.fogApplied,rendererEvidence,liveCameraVerified:false,playerInput:markerInput,nameInput,automaticSearch:result.diagnostics};
 videoComparison.setBackground(s.image,background,input.frameId);$('auto-search-status').textContent=(s.row.accepted?'自動位置合わせを適用しました。':'自動候補を比較しましたが、位置合わせ条件を満たしていません。')+' 比較'+result.diagnostics.backgroundCandidates.length+'件・地図キャッシュ'+result.diagnostics.cache.mapImages+'件。種類は続けて候補比較します。';
}
$('auto-map-search').onclick=guard(()=>videoComparison.startAutomatic());
async function renderFromMarker(input){
 if(!image||!record||!floors||!positionMatcher){$('marker-status').textContent='固定映像を保持しています。ROMとマップを選択してください。';return;}
 clearView();const id=version;await frame();if(id!==version||input.frameId!==videoComparison.frameId())return;
 const result=deriveVideoPlayerMapInput({...input,mapImage:image,mapId:record.mapId,matcher:positionMatcher,floors});
 const upper=$('comparison-upper');upper.width=256;upper.height=192;const uc=upper.getContext('2d');uc.putImageData(new ImageData(result.upper.rgba,256,192),0,0);uc.strokeStyle='#f44';
 for(const m of result.markers.candidates)uc.strokeRect(m.bounds.x-1,m.bounds.y-1,m.bounds.w+2,m.bounds.h+2);
 const evidence={...result,upper:{width:256,height:192}};$('marker-details').textContent=JSON.stringify(evidence,null,2);
 if(!['position-candidate','floor-unresolved-or-multiple'].includes(result.status)||!result.primaryCandidate?.floor.heightsFx.length){$('marker-status').textContent='上画面からの位置供給は未解決: '+result.status;return;}
 const c=result.primaryCandidate,heading=readRomInitialHeading(project.sdk);point={...c.world,source:c.coordinate};markerInput={evidence,heading};markPoint(c.image.x,c.image.y);
 const multiple=c.floor.heightsFx.length>1;$('floor').replaceChildren(...(multiple?[new Option('ROM床候補を選択（未確定）','')]:[]),...c.floor.heightsFx.map(v=>new Option('ROM床候補 '+(v/4096).toFixed(3),String(v))));$('floor').disabled=!multiple;$('draw').disabled=multiple;const headings=readRomCameraYawCandidates(project.sdk);markerInput.headingAlternatives=headings;$('rom-yaw-candidate').replaceChildren(...headings.candidates.map(h=>new Option(h.kind+' '+h.yawDegrees+'°',String(h.yawDegrees>180?h.yawDegrees-360:h.yawDegrees))));
 $('yaw').value=String(heading.yawDegrees);$('yawlabel').value=heading.yawDegrees+'°';
 $('marker-status').textContent=(multiple?'複数のROM床が残るため候補を選択してください。':'先頭色の点候補→ROM地図位置→唯一の床を取得しました。')+'初期カメラ向きをROM命令から供給して描画します。点の本人対応と映像時点のカメラ変更は未確認です。';
 if(!multiple)await render();
}
async function render(){
 if(!point||!$('floor').options.length||$('floor').value==='')return;const id=version,drawId=++renderVersion,comparisonFrameId=videoComparison.frameId();videoComparison.invalidate('背景を再描画しています。');const selected={...point,yFx:Number($('floor').value),yawDegrees:Number($('yaw').value)};$('status').textContent='CPUで描画しています…';await frame();if(id!==version||drawId!==renderVersion)return;
 const camera=automaticPreviewCamera(project,rom,record,selected),active=applyAutomaticMaterialEnvironment(project,record,automaticBillboardScenes(project,automatic,camera.viewFx));
 if(!active.environmentApplied){$('diagnostics').textContent=JSON.stringify(active.environment,null,2);throw Error('ROMの初期環境をまだ適用できません: '+active.environment.unresolved.join('; '));}
 const parts=active.scenes.map(s=>prepareDrawPackets(s,{materialGlobals:active.environment.materialGlobals,masks:automatic.masks})),packets={draws:parts.flatMap(x=>x.draws)},requestedRenderer=$('render-profile').value;
 const integer=requestedRenderer==='legacy'?null:renderInitialIntegerFog(project,rom,record,active,camera,{applyFog:requestedRenderer==='integer-fog',screenEffectPhase:$('mse-initial-effect').checked?(automaticMsePhase??{kind:'source-constructor'}):null});
 const r=integer?.ready?integer:rasterizePreviewPackets(packets,{view:identity,projection:camera.projectionFx.map(x=>x/4096),clearRGBA:[0,0,0,0],colorProfile:'native-mode0-rgb'}),backend=integer?.ready?'source-integer-static-mode1':'float64-diagnostic',fogApplied=integer?.ready===true&&integer.diagnostics.fogApplied===true;
 const rendererEvidence={requestedRenderer,backend,fogApplied,fallback:integer&&!integer.ready?{reason:integer.reason,diagnostics:integer.diagnostics}:null,integer:integer?.ready?integer.diagnostics:null};
 ctx.putImageData(new ImageData(r.rgba,r.width,r.height),0,0);const blocked=[...active.unresolved,...active.scenes.flatMap(s=>s.unsupported).filter(x=>!x.reason.startsWith('name-char3-A')),...parts.flatMap(p=>p.unsupported),...r.stats.rejected];
 $('status').textContent=(r.stats.fragments?'CPU描画しました。':blocked.length?'未対応項目のため描画できません。':'この向きでは描画対象が見えません。')+(blocked.length?' 未対応の描画項目があります。':'')+(integer?.ready?(fogApplied?' ROM整数描画と時間独立の霧を適用しました。':' ROM整数描画（霧なし比較）です。'):' Float64プレビュー（霧なし）です。')+(integer&&!integer.ready?' 整数経路の条件未成立でfallback: '+integer.reason:'')+' 初期状態の仮説です。現在の動的状態とnative画像一致は未確認です。';
 const evidence={romSHA256,recordKey:record.key,mapId:record.mapId,fieldCode:record.fieldCode,selected,viewFx:camera.viewFx,projectionFx:camera.projectionFx,cameraScope:camera.scope,renderScope:r.scope,stats:r.stats,unresolved:blocked,floorUnresolved:floors.unsupported,fogApplied,rendererEvidence,liveCameraVerified:false,playerInput:markerInput,nameInput};videoComparison.setBackground(r,evidence,comparisonFrameId);
 $('diagnostics').textContent=JSON.stringify({map:record.displayLabel,backend,rendererEvidence,point,floor:Number($('floor').value),floorUnresolved:floors.unsupported,cameraScope:camera.scope,renderScope:r.scope,environment:active.environment.scope,colorReady:active.environment.colorReady,fogReady:active.environment.fogReady,fogUnresolved:active.environment.fogUnresolved,fogApplied,stats:r.stats,unresolved:blocked},null,2);
}
$('mse-initial-effect').onchange=guard(async()=>{automaticMsePhase=null;await render();});$('rom-yaw-candidate').onchange=guard(async()=>{if($('rom-yaw-candidate').value==='')return;$('yaw').value=$('rom-yaw-candidate').value;$('yawlabel').value=$('yaw').value+'°';await render();});$('floor').onchange=guard(async()=>{$('draw').disabled=$('floor').value==='';await render();});$('draw').onclick=guard(render);$('yaw').oninput=()=>{$('automatic-map-name').checked=false;$('automatic-player').checked=false;markerInput=null;renderVersion++;videoComparison.invalidate('向きが変わりました。');$('yawlabel').value=$('yaw').value+'°';};$('yaw').onchange=guard(render);

$('render-profile').onchange=guard(render);

async function classifyBackgroundResiduals(input){
 residualClient.cancel();
 const key=romSHA256,romEpoch=nameRomEpoch,frameId=input.videoEvidence.frameSerial,context=input.recognitionContext??{variant:$('residual-model-variant').value,backend:$('residual-inference-backend')?.value??'wasm'},current=input.isCurrent??(()=>videoComparison.frameId()===frameId);if(input.backgroundEvidence.romSHA256!==key)throw Error('背景とROMの識別が異なります');
 const catalog=await residualClient.load(rom,key);if(romSHA256!==key||nameRomEpoch!==romEpoch||!current())throw Error('比較中に入力が変わりました');
 const cancellationVersion=residualClient.cancellationVersion;
 encounterTables??=(await(await responseBytes('../data/enc.json')).json()).main;
 const retained=input.backgroundEvidence.nameInput?.maps?.map(m=>m.mapId)??[input.backgroundEvidence.mapId],variant=context.variant,plan=residualModelPlan(project,retained,{catalog,tables:encounterTables,variant});
 return runResidualRecognitionJob({input,plan,variant,client:residualClient,preference:context.backend,assertCurrent:()=>{if(residualClient.cancellationVersion!==cancellationVersion||romSHA256!==key||nameRomEpoch!==romEpoch||!current())throw new DOMException('比較中に入力が変わりました','AbortError');}});
}

$('residual-inference-backend')?.addEventListener('change',()=>videoComparison.invalidate('残差推論方式を変更しました。'));
