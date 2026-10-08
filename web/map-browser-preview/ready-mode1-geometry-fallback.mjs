// Delayed source-bounded geometry only. The caller first exhausts the unchanged
// centroid pass and must not call this when any original candidate is accepted.
import {prepareMode1PhotometricBasis,renderMode1PhotometricBasis} from './mode1-photometric-inverse.mjs?v=fair-source-yield-20261007-0247';
import {refineGeometryPosition} from './geometry-position-refinement.mjs?v=geometry-display-20261006-1112';
import {floorHeightsAtXZ} from './rom-floor-candidates.mjs';
import {continueRefinedFloorAlternatives} from './refined-floor-alternatives.mjs?v=source-scene-20261006-0040';
import {automaticPreviewCamera} from './automatic-preview-camera.mjs';
import {automaticBillboardScenes} from './automatic-billboard-scene.mjs';
import {applyMode1OrdinaryHypothesis} from './automatic-material-environment.mjs?v=native-body-20261006-0212';
import {compareMapBackground} from './map-video-residual.mjs?v=shrine-beam-20261008-a9738d0c';
import {createRendererSourceArchives} from './renderer-source-archives.mjs';
const copy=structuredClone;
export function hasNonzeroSourceXZBounds(position){
 return ['x','z'].every((axis,i)=>{const b=position?.coordinate?.bounds?.[axis],v=position?.world?.[['xFx','zFx'][i]];return b?.inSigned32Range===true&&Number.isInteger(b.rawMin)&&Number.isInteger(b.rawMax)&&b.rawMin>=-2147483648&&b.rawMax<=2147483647&&b.rawMin<b.rawMax&&Number.isInteger(v)&&v>=b.rawMin&&v<=b.rawMax;});
}
export function createReadyMode1GeometryFallback({backgroundRenderer}){
 const archives=createRendererSourceArchives();
 async function render({project,rom,record,automatic,position,yFx,heading,camera,geometryInput=null,frameEvidence=null,environment,requests,video,analysisVideo=video,analysisEvidence=null,floors,isCurrent=()=>true,onProgress=async()=>{}}){
  const check=()=>{if(!isCurrent())throw new DOMException('Ready mode1 geometry cancelled','AbortError');},diagnostics={kind:'ready-mode1-source-bounded-geometry',originalWorld:copy(position?.world),sourceBounds:copy(position?.coordinate?.bounds),analysisInput:analysisEvidence,finalComparisonInput:'original-frozen-input-RGBA',environmentSearch:false,phaseSearch:false,yawExpansion:false,thresholdsChanged:false,currentEnvironmentCertified:false,minimumProvenATCalls:0};
  const unavailable=reason=>requests.map(r=>({originalRowIndex:r.originalRowIndex,phase:copy(r.phase),ready:false,reason,diagnostics:copy(diagnostics)}));
  try{
   check();if(environment?.mode!==1||environment.colorReady!==true||environment.fogReady!==true||!hasNonzeroSourceXZBounds(position))return unavailable('Ready source mode1 environment and original nonzero XZ bounds required');
   const geometryImage=geometryInput?.image??null;
   if(geometryInput){
    const binding=geometryInput.binding;
    if(!geometryImage||!binding||Object.entries({project,rom,record,position,camera,environment,frameEvidence}).some(([key,value])=>binding[key]!==value))return unavailable('Native-color geometry input does not belong to this exact scene/camera/frame branch');
   }
   project=archives.forProject(project,rom);const gpu=await backgroundRenderer.begin();check();
   const model=prepareMode1PhotometricBasis({project,rom,record,automatic,camera}),basis=await renderMode1PhotometricBasis(model,{gpu,isCurrent});check();
   // No photometric inference is called. This white basis supplies coherent
   // source geometry/depth; it is never an accepted environment or display.
   diagnostics.basisRenders=1;diagnostics.basis={basisOnly:basis.basisOnly,knownPixels:basis.knownMask?.reduce((n,v)=>n+v,0)??0};
   let registrationImage=basis,registrationKnown=basis.knownMask;
   if(geometryImage){
    // Supplied only from this exact group's initial camera/environment and
    // phase=null render. The white probe still owns the depth/opaque-owner gate:
    // color/fog changes neither source geometry nor camera. Never use MSE RGB
    // or translucent color with an unrelated opaque depth owner.
    if(geometryImage.ready!==true||geometryImage.width!==256||geometryImage.height!==192||geometryImage.rgba?.length!==196608||geometryImage.knownMask?.length!==49152)throw Error('Coherent ready native-color geometry image required');
    registrationImage=geometryImage;
    registrationKnown=Uint8Array.from(basis.knownMask,(known,i)=>Number(Boolean(known&&geometryImage.knownMask[i]&&geometryImage.rgba[i*4+3]===255)));
   }
   diagnostics.geometryImage={kind:geometryImage?'ready-source-color-fog-no-screen-effect':'algebraic-white-no-fog',sameCamera:true,depthOwnerGate:'unchanged-white-basis-opaque-owner',knownPixels:registrationKnown?.reduce((n,v)=>n+v,0)??0,extraColorRender:false};
   const geometry=await refineGeometryPosition({position,camera,image:registrationImage,depth24:basis.sourceDepth24,knownMask:registrationKnown,video:analysisVideo,isCurrent,onProgress});diagnostics.geometryRefinement=geometry;check();
   if(!geometry.ready||geometry.onBoundary)return unavailable(geometry.reason??'Source geometry optimum touches unresolved marker interval boundary');
   const refinedFloor=floorHeightsAtXZ(floors,geometry.world.xFx,geometry.world.zFx),continuation=continueRefinedFloorAlternatives({position,yFx,floors,refinedFloor,refinedWorld:geometry.world});diagnostics.refinedFloor=refinedFloor;diagnostics.floorContinuation=continuation;if(!continuation.ready)return unavailable(continuation.reason);
   const results=[];
   for(const floorBranch of continuation.alternatives)for(const request of requests){
    check();const detail={...copy(diagnostics),floorBranch:copy(floorBranch)},point={...geometry.world,yFx:floorBranch.yFx,yawDegrees:heading.yawDegrees},refinedCamera=automaticPreviewCamera(project,rom,record,point);
    try{
     const active=applyMode1OrdinaryHypothesis(project,record,automaticBillboardScenes(project,automatic,refinedCamera.viewFx),environment);
     if(!active.environmentApplied)throw Error('Original ready mode1 material replay unavailable');
     const image=await backgroundRenderer.render({project,rom,record,active,camera:refinedCamera,screenEffectPhase:request.phase,isCurrent});if(image.diagnostics?.automaticBackgroundPipeline)detail.renderPipeline=image.diagnostics.automaticBackgroundPipeline;check();if(!image.ready)throw Error(image.reason??'Refined native render unavailable');
     const comparison=compareMapBackground(image,video,{applyTranslation:true});detail.nativeForward={state:comparison.state,alignment:comparison.alignment,stats:comparison.stats};detail.originalEnvironmentRetained=true;
     results.push({originalRowIndex:request.originalRowIndex,phase:copy(request.phase),ready:true,image,comparison,point,camera:refinedCamera,diagnostics:detail});
    }catch(error){if(error.automaticBackgroundPipeline)detail.renderPipeline=error.automaticBackgroundPipeline;if(error.name==='AbortError')throw error;results.push({originalRowIndex:request.originalRowIndex,phase:copy(request.phase),ready:false,reason:error.message,diagnostics:detail});}
   }
   return results;
  }catch(error){if(error.name==='AbortError')throw error;return unavailable(error.message);}
 }
 return {render,destroy(){archives.clear();}};
}
