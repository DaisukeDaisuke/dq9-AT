import{resolveFrozenInferencePixels}from'./capture-analysis-pixels.mjs?v=video-inference-20261005-1232';
import{createMode1BackgroundInference}from'./automatic-mode1-background.mjs?v=source-floor-20261005-1330';
import {Mode2VideoContinuity} from './mode2-video-continuity.mjs?v=source-floor-20261005-1330';
import {inferAutomaticMode2Background} from './automatic-mode2-background.mjs?v=source-floor-20261005-1330';
import {readRomMapCameraInputGate} from './rom-camera-input-gate.mjs';
import {readRomCameraYawCandidates} from './read-rom-camera-yaw-candidates.mjs';
import {CandidateMapMatcher} from '../map-disambiguation.mjs';
import {loadAutomaticScene} from './automatic-scene.mjs';
import {loadRomFloorInstances} from './rom-floor-candidates.mjs';
import {resolveVideoMinimapCandidates} from './video-minimap-candidates.mjs';
import {automaticPreviewCamera} from './automatic-preview-camera.mjs';
import {automaticBillboardScenes} from './automatic-billboard-scene.mjs';
import {applyAutomaticMaterialEnvironment} from './automatic-material-environment.mjs?v=field-stream-20261005-1108';
import {createAutomaticBackgroundRenderer} from './automatic-background-renderer.mjs?v=field-stream-20261005-1108';
import {readRomMapScreenEffectPlan} from './rom-map-screen-effect-plan.mjs';
import {prepareDrawPackets} from './draw-packets.mjs';
import {rasterizePreviewPackets} from './cpu-preview.mjs';
import {sampleGameplayFrame,gameplayVideoROI,compareMapBackground} from './map-video-residual.mjs';
import {readRomInitialHeading} from './rom-initial-heading.mjs';
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export class AutomaticVideoAlignment {
 constructor({project,rom,romSHA256,catalog,records,renderer,matcher,wasm,backgroundRenderer=createAutomaticBackgroundRenderer()}){this.backgroundRenderer=backgroundRenderer;this.mode1Inference=createMode1BackgroundInference({backgroundRenderer});Object.assign(this,{project,rom,romSHA256,catalog,records,renderer,matcher});this.mode2Continuity=new Mode2VideoContinuity({initializeGpu:()=>this.backgroundRenderer.begin()});this.scenes=new Map();this.sceneHits=0;this.sceneMisses=0;this.imageHits=0;this.imageMisses=0;this.referenceCache=new CandidateMapMatcher(wasm,{...catalog.minimap,records:catalog.maps.map(r=>({...r,candidates:r.minimapCandidates}))},renderer);}
 phasePlan(effect){return{phases:effect.ready&&effect.request?[null,{kind:'source-constructor'}]:[null],coverage:{kind:'initial-diagnostic-only',phaseEnumeration:false,currentPhaseProven:false,requiredInput:'Map entry timeline and enabled draw history; not filled by phase brute force'}};}
 headingPlan(record){const gate=readRomMapCameraInputGate(this.project,this.rom,record);const source=readRomCameraYawCandidates(this.project.sdk);return{...source,candidates:gate.ready&&gate.mapAllowsShoulderInput?source.candidates:[readRomInitialHeading(this.project.sdk)],gate,scope:gate.ready?(gate.mapAllowsShoulderInput?'ROM permits shoulder input: initial and L/R endpoints evaluated; intermediate/runtime angles unresolved':'ROM map disables shoulder input: initial hypothesis only; script/runtime changes unresolved'):'Map input gate unresolved: initial hypothesis only, other headings unsearched'};}
 scene(record){if(this.scenes.has(record.key)){this.sceneHits++;return this.scenes.get(record.key);}this.sceneMisses++;const automatic=loadAutomaticScene(this.project,record),floors=loadRomFloorInstances(this.project,automatic.plan),value={automatic,floors};if(this.scenes.size>=4)this.scenes.delete(this.scenes.keys().next().value);this.scenes.set(record.key,value);return value;}
 async search({input,names,prevalidatedMaps=null,headingsFor,onProgress=async()=>{},isCurrent=()=>true}){
  const {project,rom,catalog,records,matcher}=this,rows=[],mapRows=[],located=[],roi=gameplayVideoROI(input.sourceImage.width,input.sourceImage.height,input.layout),video=sampleGameplayFrame(input.sourceImage,roi);let selected=null;
  const check=()=>{if(!isCurrent())throw new DOMException('自動位置合わせを中止しました','AbortError');};
  let analysisInputPromise=null;
  const analysisInput=()=>analysisInputPromise??=resolveFrozenInferencePixels({input,video,isCurrent});
  const renderer={compose:(_project,path)=>{if(this.referenceCache.cache.has(path))this.imageHits++;else this.imageMisses++;return this.referenceCache.image(path,2097152);}};
  for(const candidate of names.maps){check();const record=records.find(r=>r.key===candidate.key);if(!record){mapRows.push({key:candidate.key,unsupported:'ROM record unavailable'});continue;}
   let scene,selection;try{scene=this.scene(record);selection=(prevalidatedMaps?.frameId===input.frameId&&prevalidatedMaps.sourceImage===input.sourceImage?prevalidatedMaps.selections.get(record.key):null)??await resolveVideoMinimapCandidates({record,catalog,renderer,matcher,floors:scene.floors,...input,isCurrent,onCandidate:async r=>{await onProgress({phase:'map',message:'地図画像を照合中: '+r.path});}});mapRows.push(selection.diagnostics);}catch(error){if(error.name==='AbortError')throw error;mapRows.push({key:record.key,mapId:record.mapId,unsupported:error.message});continue;}
   const paths=selection.diagnostics.equivalentGroups.map(g=>g[0]),references=selection.accepted.filter(a=>paths.includes(a.path));
   for(const reference of references){const position=reference.result.primaryCandidate;if(!position)continue;located.push({record,scene,reference,position});const yawPlan=headingsFor?await headingsFor(record,position,scene):this.headingPlan(record);const effect=readRomMapScreenEffectPlan(project,scene.automatic.plan),phasePlan=this.phasePlan(effect),phases=phasePlan.phases;
    for(const yFx of position.floor.heightsFx)for(const heading of yawPlan.candidates)for(const phase of phases){check();const row={mapId:record.mapId,recordKey:record.key,descriptor:reference.path,descriptorAliases:selection.diagnostics.equivalentGroups.find(g=>g.includes(reference.path)),world:position.world,yFx,heading,phase,rotationPolicy:yawPlan,phaseCoverage:phasePlan.coverage,accepted:false};rows.push(row);
     try{
      const initialPoint={...position.world,yFx,yawDegrees:heading.yawDegrees},initialCamera=automaticPreviewCamera(project,rom,record,initialPoint),active=applyAutomaticMaterialEnvironment(project,record,automaticBillboardScenes(project,scene.automatic,initialCamera.viewFx));let inferred=null,inferenceKind=null;
      if(!active.environmentApplied&&active.environment.mode===2&&input.layout==='obs-side-1920'&&input.sourceImage.width===1920&&input.sourceImage.height===1080){
       if(phase)throw Error('Mode2 screen-effect composition not connected');const analysis=await analysisInput();row.analysisInput=analysis.evidence;inferenceKind='mode2';inferred=await this.mode2Continuity.render({project,rom,record,automatic:scene.automatic,position,yFx,heading,video,analysisVideo:analysis.image,analysisEvidence:analysis.evidence,floors:scene.floors,frameEvidence:input.frameEvidence,romSHA256:this.romSHA256,isCurrent,onProgress});
      }else if((!active.environmentApplied||!active.environment.fogReady)&&active.environment.mode===1&&input.layout==='obs-side-1920'&&input.sourceImage.width===1920&&input.sourceImage.height===1080){
       const analysis=await analysisInput();row.analysisInput=analysis.evidence;inferenceKind='mode1';inferred=await this.mode1Inference.render({project,rom,record,automatic:scene.automatic,position,yFx,heading,video,analysisVideo:analysis.image,analysisEvidence:analysis.evidence,floors:scene.floors,screenEffectPhase:phase,isCurrent,onProgress});
      }else if(!active.environmentApplied)throw Error('ROM material environment unresolved: '+active.environment.unresolved.join('; '));
      check();const alternatives=inferred?.floorAlternatives??[inferred??await this.backgroundRenderer.render({project,rom,record,active,camera:initialCamera,screenEffectPhase:phase,isCurrent})],baseRow={...row};
      for(let branchIndex=0;branchIndex<alternatives.length;branchIndex++){
       check();const integer=alternatives[branchIndex],candidateRow=branchIndex===0?row:{...baseRow};if(branchIndex)rows.push(candidateRow);
       if(alternatives.length>1){candidateRow.floorAlternativeIndex=branchIndex;candidateRow.floorAlternativeSummary=inferred.floorAlternativeSummary;}
       let point=initialPoint,camera=initialCamera;
       if(inferenceKind){const detail=integer.diagnostics?.[inferenceKind==='mode2'?'automaticMode2':'automaticMode1']??integer.diagnostics;candidateRow[inferenceKind+'Inference']=integer.diagnostics;candidateRow.geometryRefinement=detail?.geometryRefinement;candidateRow.floorContinuation=detail?.floorContinuation;candidateRow.floorBranch=detail?.floorBranch;if(!integer.ready){candidateRow.unsupported=integer.reason;continue;}point=integer.point;camera=integer.camera;candidateRow.originalWorld=baseRow.world;candidateRow.originalYFx=yFx;candidateRow.world={xFx:point.xFx,zFx:point.zFx};candidateRow.yFx=point.yFx;}
       let image,backend,unresolved=[];
       if(integer.ready){image=integer;backend=integer.backend??(integer.diagnostics?.automaticBackgroundPipeline?.backend==='webgpu-source-integer-pixels'?'webgpu-source-integer-pixels':'source-integer-static-mode1');}else{if(phase){candidateRow.unsupported=integer.reason;continue;}const packets=active.scenes.map(s=>prepareDrawPackets(s,{materialGlobals:active.environment.materialGlobals,masks:scene.automatic.masks}));image=rasterizePreviewPackets({draws:packets.flatMap(p=>p.draws)},{view:identity,projection:camera.projectionFx.map(x=>x/4096),clearRGBA:[0,0,0,0],colorProfile:'native-mode0-rgb'});backend='float64-diagnostic';unresolved=[{reason:integer.reason},...packets.flatMap(p=>p.unsupported)];}
       const comparison=compareMapBackground(image,video,{applyTranslation:true});Object.assign(candidateRow,{backend,alignment:comparison.alignment,stats:comparison.stats,state:comparison.state,accepted:comparison.state==='conditional-residual-hypotheses'||comparison.state==='no-residual-split',renderPipeline:integer.diagnostics?.automaticBackgroundPipeline,integerReady:integer.ready,rendererReason:integer.reason??null});
       const score=Number.isFinite(comparison.alignment.residual)?comparison.alignment.residual:Infinity;if(!selected||(candidateRow.accepted&&!selected.row.accepted)||(candidateRow.accepted===selected.row.accepted&&score<selected.score))selected={row:candidateRow,score,record,scene,reference,position,heading,image,camera,integer,unresolved,point};
      }
     }catch(error){if(error.name==='AbortError')throw error;row.unsupported=error.message;}
     await onProgress({phase:'background',message:'背景候補を自動比較中: '+rows.length+'件',completed:rows.length});
    }
   }
  }
  check();return{selected,located,diagnostics:{kind:'automatic-video-map-background-hypotheses',mapCandidates:mapRows,backgroundCandidates:rows,selectedIndex:selected?rows.indexOf(selected.row):null,acceptedCount:rows.filter(r=>r.accepted).length,locatedCandidates:located.map(s=>({recordKey:s.record.key,mapId:s.record.mapId,descriptor:s.reference.path,world:s.position.world,floor:s.position.floor})),cache:{mapImages:this.referenceCache.cache.size,mapImageBytes:this.referenceCache.cacheBytes,imageHits:this.imageHits,imageMisses:this.imageMisses,sceneHits:this.sceneHits,sceneMisses:this.sceneMisses,sceneEntries:this.scenes.size},inputFrame:input.frameEvidence,mapIdentityCertified:false,cameraCertified:false,currentEffectPhaseCertified:false,minimumProvenATCalls:0,scope:'Automatic comparison of ROM-linked names/images, existing same-frame player XZ/chunk estimates, source floors and supplied source yaw candidates. All evaluated alternatives and failures retained. Unsearched name/camera/middle-angle/effect-phase branches remain unknown; preview selection is not a native identity or AT claim.'}};
 }
}
