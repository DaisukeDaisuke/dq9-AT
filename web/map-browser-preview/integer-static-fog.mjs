import{prepareMode1NativeBodyDestination}from'./mode1-native-body-destination.mjs?v=footprint-rgb-20261006-2328';
import {runSourceStepsSync,runSourceStepsAsync} from './cooperative-source-work.mjs?v=envelope-yield-20261007-0140';
import{isSupportedMode1ColorEnvironment,isSupportedMode1FogEnvironment}from'./automatic-material-environment.mjs?v=native-body-20261006-0212';
import {readRomMapScreenEffectPlan} from './rom-map-screen-effect-plan.mjs';
import {readInitialMseLayers,buildMsePolygonInputs} from './native-mse-initial-preview.mjs';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * Browser adapter over the previously source-compared integer polygon modules.
 * DeSmuME535f676-derived modules retain their notices; see INTEGER_RENDER_NOTICE.md.
 * No previewDepth/RGBA8888 is converted into native raster input.
 */
import {readInitialMode1RasterProfile,renderInitialMode1IntegerPreviewSteps} from './integer/initial-mode1-integer-preview.mjs?v=source-reuse-interruption-20261007-0204';
import {readInitialTexturedBlendProfile,collectInitialMode1TexturedTranslucentInputsSteps,rasterizeNativeTexturedTranslucentMode0,compositeTexturedTranslucentOverStaticRgbSteps} from './integer/native-textured-translucent.mjs?v=envelope-yield-20261007-0140';
import {projectNativePrimitiveFx} from './integer/native-primitive-inputs.mjs';
import {clipNativePositionPolygon} from './integer/native-position-clip.mjs?v=native-raster-reuse-20261006-0637';
import {presentStaticRgb} from './integer/static-mode0-rgb.mjs?v=envelope-yield-20261007-0140';
import {buildFogTable,applyFogPixel} from './native/fog-raster.mjs';
import {createSourcePreparationCache} from './integer/source-preparation-cache.mjs?v=automatic-playback-source-cache-20261006-1100';
import {readInitialMode1ClearProfile} from './integer/native-initial-clear.mjs?v=native-body-20261006-0212';

export function* renderInitialIntegerFogSteps(project,rom,record,automatic,camera,{applyFog=true,screenEffectPhase=null,retainBodyDestination=false}={}){
 const diagnostics={backend:'source-integer-static-mode1',requestedFog:applyFog,recordKey:record.key,fogApplied:false,sourcePolygonCount:null,remaining:[],scope:'ROM initial mode1 static scene; live camera/environment, animation, edge marking/antialiasing and native framebuffer parity unverified.'};
 let sourceCache=null;
 try{
  const environment=automatic.environment;
  if(!isSupportedMode1ColorEnvironment(environment,record.key))throw Error('時間独立mode1材質が未対応です');
  if(applyFog&&(!isSupportedMode1FogEnvironment(environment,record.key)))throw Error('ROMの時間独立fog入力が未解決です');
  // Reuse immutable ROM archive bytes and byte-checked GX/alpha decoding only
  // within this render. All polygon, material, position and failure checks run.
  sourceCache=createSourcePreparationCache(project);project=sourceCache.project;
  const profile=readInitialMode1RasterProfile(project,rom),base=yield*renderInitialMode1IntegerPreviewSteps(project,record,automatic,camera,profile,sourceCache),inventory=base.inventory;
  diagnostics.profile=profile;diagnostics.inventory=inventory.counts;diagnostics.colorCounts=inventory.colorCounts;diagnostics.sourcePolygonCount=inventory.polygons.length;diagnostics.unresolved=inventory.unresolved;diagnostics.depth=base.depth.stats;diagnostics.availability=base.rgb.availability;
  // The existing source name-char3-A branch is collision data, not drawable
  // geometry. Every other missing source-instance/matrix/material path blocks
  // this complete-visible-static preview rather than filling from behind it.
  if(inventory.unresolved.some(x=>typeof x.reason!=='string'||!x.reason.startsWith('name-char3-A / ')))throw Error('整数経路に未解決の描画instanceがあります');
  if(base.depth.stats.rasterRejected||base.rgb.polygons.some(p=>p.rasterRejection)||base.rgb.availability.unavailable)throw Error('整数raster/RGBの可視所有画素が未解決です');
  const translucent=yield*collectInitialMode1TexturedTranslucentInputsSteps(project,automatic,inventory,sourceCache),controls=readInitialTexturedBlendProfile(project,rom),participants=[];
  diagnostics.translucent={eligible:translucent.polygons.length,controls,rejected:translucent.rejected};
  for(const row of translucent.rejected){const p=inventory.polygons[row.index],position=projectNativePrimitiveFx(p.primitive,p.positionMatrixFx,p.projectionFx),clip=clipNativePositionPolygon(position.clipVerticesFx);diagnostics.remaining.push({...row,model:p.model,materialName:p.materialName,positionClipDiscarded:clip.discarded,remainingVertices:clip.positionsFx.length});}
  if(diagnostics.remaining.some(p=>!p.positionClipDiscarded))throw Error('可視範囲に未対応polygonがあります（原形状と拒否理由を保持）');
  diagnostics.nativeEdgeSetupAborts=[];for(const p of translucent.polygons){yield 'native-translucent-polygon';const r=rasterizeNativeTexturedTranslucentMode0(p.args,p.translucentInput);if(!r.ready)throw Error('半透明raster未対応: '+r.reason);if(r.nativeEdgeSetupAbort)diagnostics.nativeEdgeSetupAborts.push({index:p.index,...r.nativeEdgeSetupAbort});participants.push({index:p.index,frontFacing:Boolean(r.frontFacing),fragments:r.fragments});}
  let compositeInputs=translucent;const effectPlan=readRomMapScreenEffectPlan(project,automatic.plan);diagnostics.screenEffect={plan:effectPlan,requestedPhase:screenEffectPhase,applied:false,currentPhaseProven:false,gatesEvaluated:false};if(screenEffectPhase){if(!effectPlan.ready)throw Error('画面効果のROM選択が未解決です');if(effectPlan.request){const mse=readInitialMseLayers(project,effectPlan),screen=buildMsePolygonInputs(project,mse,{phase:screenEffectPhase,indexStart:inventory.polygons.length,rasterProfile:profile});for(const p of screen.polygons){yield 'native-screen-polygon';const r=rasterizeNativeTexturedTranslucentMode0(p.args,p.translucentInput);if(!r.ready)throw Error(r.reason);participants.push({index:p.index,frontFacing:Boolean(r.frontFacing),fragments:r.fragments});}compositeInputs={...translucent,polygons:[...translucent.polygons,...screen.polygons]};diagnostics.screenEffect.applied=true;diagnostics.screenEffect.polygonCount=screen.polygons.length;}}
 let bodyDestination=null;if(retainBodyDestination)try{bodyDestination=prepareMode1NativeBodyDestination({project,rom,rgb:base.rgb,inventory,translucent,compositeInputs,participants,controls,diagnostics});bodyDestination.sourceFogParameters=applyFog?structuredClone(environment.fogParameters):null;diagnostics.bodyDestinationRetention={ready:true,conditionalHypothesisOnly:true};}catch(error){if(error.name==='AbortError')throw error;diagnostics.bodyDestinationRetention={ready:false,reason:error.message};}
 let combined=yield*compositeTexturedTranslucentOverStaticRgbSteps(base.rgb,compositeInputs,participants,controls);
  // Resolve uncovered native destinations only through the guarded ROM clear
  // producer/consumer. Existing successful renders keep their exact output.
  if(combined.stats.unknownDestination){diagnostics.translucent.beforeClearStats={...combined.stats};try{const clearProfile=readInitialMode1ClearProfile(project,rom,record,automatic);diagnostics.clear=clearProfile;combined=yield*compositeTexturedTranslucentOverStaticRgbSteps(base.rgb,compositeInputs,participants,{...controls,clearProfile});}catch(error){diagnostics.clear={ready:false,reason:error.message};}}
  diagnostics.translucent.stats=combined.stats;const unresolvedDestinationPixels=combined.unavailableMask.reduce((n,v)=>n+Number(Boolean(v)),0);diagnostics.completeVisibleStatic=combined.stats.unknownDestination===0&&unresolvedDestinationPixels===0;diagnostics.partialKnownStatic={unresolvedDestinationPixels,unknownDestinationFragments:combined.stats.unknownDestination,reason:diagnostics.completeVisibleStatic?null:'半透明合成先のnative depth/色が未解決です'};
  let rgba6665=combined.rgba6665;
  if(applyFog){const parameters=environment.fogParameters,table=buildFogTable(parameters);rgba6665=rgba6665.slice();let changed=0,fogged=0;
   for(let i=0;i<49152;i++){if((i&511)===0)yield 'native-fog-pixels';if(!(combined.coverage??base.rgb.plane.coverage)[i]||combined.unavailableMask[i])continue;const before=rgba6665.subarray(i*4,i*4+4),flag=Boolean(combined.isFogged[i]),after=applyFogPixel(before,combined.depth24[i],flag,parameters,table);if(flag)fogged++;if(after.some((v,k)=>v!==before[k]))changed++;rgba6665.set(after,i*4);}
   diagnostics.fogApplied=true;diagnostics.fog={parameters:{...parameters,density:Array.from(parameters.density)},source:environment.source,changed,fogged,depthSource:'native integer original GX polygon clip/raster/depth24',maskSource:'source polygon owner and accepted opaque/translucent fog flag AND',timeIndependent:environment.fogTimeIndependent,discreteOrdinaryHypothesis:environment.discreteOrdinaryHypothesis??null};
  }
  const image=presentStaticRgb({...combined,rgba6665},{profile:'rgb555-expanded'}),knownMask=new Uint8Array(49152);for(let i=0;i<49152;i++){if(combined.unavailableMask[i])image.rgba[i*4+3]=0;else if(image.rgba[i*4+3]===255)knownMask[i]=1;}diagnostics.partialKnownStatic.comparablePixels=knownMask.reduce((n,v)=>n+v,0);
  return{ready:true,...image,...(bodyDestination?{bodyDestination}:{}),completeVisibleStatic:diagnostics.completeVisibleStatic,knownMask,unavailableMask:combined.unavailableMask,rgba:Uint8ClampedArray.from(image.rgba),diagnostics,scope:diagnostics.scope,stats:{...base.depth.stats,fragments:base.depth.stats.opaqueGeometricFragments+base.depth.stats.binaryGeometricFragments+combined.stats.incoming,rejected:[]}};
 }catch(error){return{ready:false,reason:error.message,diagnostics};}finally{sourceCache?.dispose();}
}

export function renderInitialIntegerFog(project,rom,record,automatic,camera,options={}){return runSourceStepsSync(renderInitialIntegerFogSteps(project,rom,record,automatic,camera,options));}
export function renderInitialIntegerFogAsync(project,rom,record,automatic,camera,options={}){return runSourceStepsAsync(renderInitialIntegerFogSteps(project,rom,record,automatic,camera,options),options);}
