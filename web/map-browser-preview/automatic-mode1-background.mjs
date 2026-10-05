import{continueRefinedFloorAlternatives,collectRefinedFloorResults}from'./refined-floor-alternatives.mjs?v=source-floor-20261005-1330';
/* Image-observed discrete ordinary load record, not continuously interpolated
 * mode2 or video elapsed-time inference. No ordinary-state/fog-phase render loop. */
import{prepareMode1PhotometricBasis,renderMode1PhotometricBasis,inferMode1OrdinaryColor}from'./mode1-photometric-inverse.mjs?v=video-inference-20261005-1232';
import{automaticPreviewCamera}from'./automatic-preview-camera.mjs';
import{automaticBillboardScenes}from'./automatic-billboard-scene.mjs';
import{applyMode1OrdinaryHypothesis}from'./automatic-material-environment.mjs?v=field-stream-20261005-1108';
import{refineGeometryPosition}from'./geometry-position-refinement.mjs';
import{floorHeightsAtXZ}from'./rom-floor-candidates.mjs';
import{compareMapBackground}from'./map-video-residual.mjs';
import{createRendererSourceArchives}from'./renderer-source-archives.mjs';
export function createMode1BackgroundInference({backgroundRenderer}){
 const archives=createRendererSourceArchives();
 async function render({project,rom,record,automatic,position,yFx,heading,video,analysisVideo=video,analysisEvidence=null,floors,screenEffectPhase=null,isCurrent=()=>true,onProgress=async()=>{}}){
  const check=()=>{if(!isCurrent())throw new DOMException('Mode1 inference cancelled','AbortError');},diagnostics={kind:'source-mode1-analytic-discrete-color',basisRenders:0,ordinaryStateRenders:0,fogPhaseEnumeration:false,currentEnvironmentCertified:false,minimumProvenATCalls:0,analysisInput:analysisEvidence,finalComparisonInput:'original-frozen-input-RGBA'};
  try{
   check();project=archives.forProject(project,rom);const initialPoint={...position.world,yFx,yawDegrees:heading.yawDegrees},initialCamera=automaticPreviewCamera(project,rom,record,initialPoint),gpu=await backgroundRenderer.begin();check();
   let totalBasisRenders=0;const basisRender=async(model,weights=false)=>{check();await onProgress({phase:'background',message:'ROMの材質色を解析中',completed:diagnostics.basisRenders});await new Promise(r=>setTimeout(r,0));check();const basis=await renderMode1PhotometricBasis(model,{gpu,isCurrent,weights});diagnostics.basisRenders=++totalBasisRenders;return basis;};
   let model=prepareMode1PhotometricBasis({project,rom,record,automatic,camera:initialCamera}),basis=await basisRender(model);
   const geometry=await refineGeometryPosition({position,camera:initialCamera,image:basis,depth24:basis.sourceDepth24,knownMask:basis.knownMask,video:analysisVideo,isCurrent,onProgress});diagnostics.geometryRefinement=geometry;check();
   if(!geometry.ready||geometry.onBoundary)throw Error(geometry.reason??'Source geometry optimum touches unresolved marker interval boundary');
   const floor=floorHeightsAtXZ(floors,geometry.world.xFx,geometry.world.zFx),continuation=continueRefinedFloorAlternatives({position,yFx,floors,refinedFloor:floor,refinedWorld:geometry.world});diagnostics.refinedFloor=floor;diagnostics.floorContinuation=continuation;if(!continuation.ready)throw Error(continuation.reason);
   const results=[];for(const floorBranch of continuation.alternatives){check();const branchDiagnostics={...diagnostics,floorBranch};try{results.push(await renderBranch(floorBranch,branchDiagnostics));}catch(error){if(error.name==='AbortError')throw error;results.push({ready:false,reason:error.message,diagnostics:branchDiagnostics,currentEnvironmentCertified:false});}}return collectRefinedFloorResults(results);
   async function renderBranch(floorBranch,diagnostics){
   const point={...geometry.world,yFx:floorBranch.yFx,yawDegrees:heading.yawDegrees},camera=automaticPreviewCamera(project,rom,record,point);
   model=prepareMode1PhotometricBasis({project,rom,record,automatic,camera});basis=await basisRender(model);const weights=await basisRender(model,true),photometry=inferMode1OrdinaryColor({model,basis,weights,video:analysisVideo});diagnostics.basisRenders=totalBasisRenders;diagnostics.photometry=photometry;if(!photometry.ready)throw Error(photometry.reason);
   if(photometry.equivalentIndices.length!==1){const images=photometry.equivalentIndices.map(i=>{const a=model.states[i];return JSON.stringify({fog:a.environment.fogParameters,material:a.environment.materialGlobals,colors:a.scenes.map(s=>s.instances.map(n=>n.draws.map(d=>d.vertices.map(v=>v.color555))))});});if(images.some(x=>x!==images[0]))throw Error('Observed COLOR-equivalent slots retain differing unobserved source color/fog');}
   const environment=model.read.hypotheses[photometry.index],active=applyMode1OrdinaryHypothesis(project,record,automaticBillboardScenes(project,automatic,camera.viewFx),environment);check();
   // Exactly one inferred/equivalent source state is forward-rendered. Never
   // retry another slot when this fails or makes a poor residual comparison.
   const image=await backgroundRenderer.render({project,rom,record,active,camera,screenEffectPhase,isCurrent});diagnostics.ordinaryStateRenders++;check();if(!image.ready)throw Error(image.reason??'Mode1 native forward render rejected');
   const comparison=compareMapBackground(image,video,{applyTranslation:true});diagnostics.nativeForward={state:comparison.state,alignment:comparison.alignment,stats:comparison.stats};diagnostics.sourceHypothesis=environment.discreteOrdinaryHypothesis;diagnostics.rendererSourceArchives={...archives.stats};
   return{...image,point,camera,comparison,ready:true,accepted:['conditional-residual-hypotheses','no-residual-split'].includes(comparison.state),backend:'source-integer-mode1-image-inferred-hypothesis',diagnostics:{...image.diagnostics,automaticMode1:diagnostics},currentEnvironmentCertified:false,scope:'Image-observed conditional ordinary mode1 load state with native forward residual validation. No current clock, forced-selector, reload-history or all-map certification.'};
   }
  }catch(error){if(error.name==='AbortError')throw error;return{ready:false,reason:error.message,diagnostics,currentEnvironmentCertified:false};}
 }
 return{render,destroy(){archives.clear();}};
}
