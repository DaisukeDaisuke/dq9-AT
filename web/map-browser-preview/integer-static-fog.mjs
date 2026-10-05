import {readRomMapScreenEffectPlan} from './rom-map-screen-effect-plan.mjs';
import {readInitialMseLayers,buildMsePolygonInputs} from './native-mse-initial-preview.mjs';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * Browser adapter over the previously source-compared integer polygon modules.
 * DeSmuME535f676-derived modules retain their notices; see INTEGER_RENDER_NOTICE.md.
 * No previewDepth/RGBA8888 is converted into native raster input.
 */
import {readInitialMode1RasterProfile,renderInitialMode1IntegerPreview} from './integer/initial-mode1-integer-preview.mjs';
import {readInitialTexturedBlendProfile,collectInitialMode1TexturedTranslucentInputs,rasterizeNativeTexturedTranslucentMode0,compositeTexturedTranslucentOverStaticRgb} from './integer/native-textured-translucent.mjs?v=edge-source-return-20261005-0434';
import {projectNativePrimitiveFx} from './integer/native-primitive-inputs.mjs';
import {clipNativePositionPolygon} from './integer/native-position-clip.mjs';
import {presentStaticRgb} from './integer/static-mode0-rgb.mjs';
import {buildFogTable,applyFogPixel} from './native/fog-raster.mjs';

export function renderInitialIntegerFog(project,rom,record,automatic,camera,{applyFog=true,screenEffectPhase=null}={}){
 const diagnostics={backend:'source-integer-static-mode1',requestedFog:applyFog,recordKey:record.key,fogApplied:false,sourcePolygonCount:null,remaining:[],scope:'ROM initial mode1 static scene; live camera/environment, animation, edge marking/antialiasing and native framebuffer parity unverified.'};
 try{
  const environment=automatic.environment;
  if(environment?.mode!==1||!environment.colorReady||!environment.ordinaryTimeIndependent)throw Error('時間独立mode1材質が未対応です');
  if(applyFog&&(!environment.fogReady||!environment.fogTimeIndependent||!environment.fogParameters))throw Error('ROMの時間独立fog入力が未解決です');
  const profile=readInitialMode1RasterProfile(project,rom),base=renderInitialMode1IntegerPreview(project,record,automatic,camera,profile),inventory=base.inventory;
  diagnostics.profile=profile;diagnostics.inventory=inventory.counts;diagnostics.colorCounts=inventory.colorCounts;diagnostics.sourcePolygonCount=inventory.polygons.length;diagnostics.unresolved=inventory.unresolved;diagnostics.depth=base.depth.stats;diagnostics.availability=base.rgb.availability;
  // The existing source name-char3-A branch is collision data, not drawable
  // geometry. Every other missing source-instance/matrix/material path blocks
  // this complete-visible-static preview rather than filling from behind it.
  if(inventory.unresolved.some(x=>typeof x.reason!=='string'||!x.reason.startsWith('name-char3-A / ')))throw Error('整数経路に未解決の描画instanceがあります');
  if(base.depth.stats.rasterRejected||base.rgb.polygons.some(p=>p.rasterRejection)||base.rgb.availability.unavailable)throw Error('整数raster/RGBの可視所有画素が未解決です');
  const translucent=collectInitialMode1TexturedTranslucentInputs(project,automatic,inventory),controls=readInitialTexturedBlendProfile(project,rom),participants=[];
  diagnostics.translucent={eligible:translucent.polygons.length,controls,rejected:translucent.rejected};
  for(const row of translucent.rejected){const p=inventory.polygons[row.index],position=projectNativePrimitiveFx(p.primitive,p.positionMatrixFx,p.projectionFx),clip=clipNativePositionPolygon(position.clipVerticesFx);diagnostics.remaining.push({...row,model:p.model,materialName:p.materialName,positionClipDiscarded:clip.discarded,remainingVertices:clip.positionsFx.length});}
  if(diagnostics.remaining.some(p=>!p.positionClipDiscarded))throw Error('可視範囲に未対応polygonがあります（原形状と拒否理由を保持）');
  diagnostics.nativeEdgeSetupAborts=[];for(const p of translucent.polygons){const r=rasterizeNativeTexturedTranslucentMode0(p.args,p.translucentInput);if(!r.ready)throw Error('半透明raster未対応: '+r.reason);if(r.nativeEdgeSetupAbort)diagnostics.nativeEdgeSetupAborts.push({index:p.index,...r.nativeEdgeSetupAbort});participants.push({index:p.index,frontFacing:Boolean(r.frontFacing),fragments:r.fragments});}
  let compositeInputs=translucent;const effectPlan=readRomMapScreenEffectPlan(project,automatic.plan);diagnostics.screenEffect={plan:effectPlan,requestedPhase:screenEffectPhase,applied:false,currentPhaseProven:false,gatesEvaluated:false};if(screenEffectPhase){if(!effectPlan.ready)throw Error('画面効果のROM選択が未解決です');if(effectPlan.request){const mse=readInitialMseLayers(project,effectPlan),screen=buildMsePolygonInputs(project,mse,{phase:screenEffectPhase,indexStart:inventory.polygons.length,rasterProfile:profile});for(const p of screen.polygons){const r=rasterizeNativeTexturedTranslucentMode0(p.args,p.translucentInput);if(!r.ready)throw Error(r.reason);participants.push({index:p.index,frontFacing:Boolean(r.frontFacing),fragments:r.fragments});}compositeInputs={...translucent,polygons:[...translucent.polygons,...screen.polygons]};diagnostics.screenEffect.applied=true;diagnostics.screenEffect.polygonCount=screen.polygons.length;}}
 const combined=compositeTexturedTranslucentOverStaticRgb(base.rgb,compositeInputs,participants,controls);
  diagnostics.translucent.stats=combined.stats;if(combined.stats.unknownDestination||combined.unavailableMask.some(v=>v))throw Error('半透明合成先のnative depth/色が未解決です');
  let rgba6665=combined.rgba6665;
  if(applyFog){const parameters=environment.fogParameters,table=buildFogTable(parameters);rgba6665=rgba6665.slice();let changed=0,fogged=0;
   for(let i=0;i<49152;i++){if(!base.rgb.plane.coverage[i])continue;const before=rgba6665.subarray(i*4,i*4+4),flag=Boolean(combined.isFogged[i]),after=applyFogPixel(before,combined.depth24[i],flag,parameters,table);if(flag)fogged++;if(after.some((v,k)=>v!==before[k]))changed++;rgba6665.set(after,i*4);}
   diagnostics.fogApplied=true;diagnostics.fog={parameters:{...parameters,density:Array.from(parameters.density)},source:environment.source,changed,fogged,depthSource:'native integer original GX polygon clip/raster/depth24',maskSource:'source polygon owner and accepted opaque/translucent fog flag AND',timeIndependent:true};
  }
  const image=presentStaticRgb({...combined,rgba6665},{profile:'rgb555-expanded'});
  return{ready:true,...image,rgba:Uint8ClampedArray.from(image.rgba),diagnostics,scope:diagnostics.scope,stats:{...base.depth.stats,fragments:base.depth.stats.opaqueGeometricFragments+base.depth.stats.binaryGeometricFragments+combined.stats.incoming,rejected:[]}};
 }catch(error){return{ready:false,reason:error.message,diagnostics};}
}
