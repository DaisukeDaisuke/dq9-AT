import{readRomMapScreenEffectPlan}from'./rom-map-screen-effect-plan.mjs';
import{readInitialMseLayers,buildMsePolygonInputs}from'./native-mse-initial-preview.mjs?v=mode2-mse-20261005-0909';
import{createSourcePreparationCache}from'./integer/source-preparation-cache.mjs';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * Source geometry/material preparation only. No CPU pixel render is required
 * before GPU submission. Existing ROM profiles and rejection ledgers remain.
 */
import{readInitialMode1RasterProfile,collectInitialMode1IntegerInputs}from'./integer/initial-mode1-integer-preview.mjs';
import{collectStaticOpaqueDepthInputs}from'./integer/static-opaque-depth.mjs?v=mode2-inverse-20261005-0908';
import{classifyStaticBinaryDepthInputs}from'./integer/static-binary-depth.mjs';
import{collectStaticMode0ColorInputs}from'./integer/static-mode0-rgb.mjs?v=mode2-inverse-20261005-0908';
import{collectInitialMode1TexturedTranslucentInputs,collectInitialMode2TexturedTranslucentInputs,readInitialTexturedBlendProfile}from'./integer/native-textured-translucent.mjs?v=mode2-inverse-20261005-0908';
import{automaticBillboardScenes}from'./automatic-billboard-scene.mjs';
import{buildAutomaticNormalMatrices,applyMode2ToAutomaticScenes}from'./integer/mode2-lighting-adapter.mjs';
import{projectNativePrimitiveFx}from'./integer/native-primitive-inputs.mjs';
import{clipNativePositionPolygon}from'./integer/native-position-clip.mjs';
import{prepareNativeIntegerCompute}from'./native-integer-compute-input.mjs';
const need=(x,m)=>{if(!x)throw Error(m);};
function completeVisibleInventory(inventory,translucent){
 need(inventory.unresolved.every(x=>typeof x.reason==='string'&&x.reason.startsWith('name-char3-A / ')),'Unresolved source drawable instance');
 const remaining=translucent.rejected.map(row=>{const p=inventory.polygons[row.index],position=projectNativePrimitiveFx(p.primitive,p.positionMatrixFx,p.projectionFx),clip=clipNativePositionPolygon(position.clipVerticesFx);return{...row,model:p.model,materialName:p.materialName,positionClipDiscarded:clip.discarded,remainingVertices:clip.positionsFx.length};});
 need(remaining.every(p=>p.positionClipDiscarded),'Unsupported source polygon remains in visible clip volume');return remaining;
}
export function prepareInitialMode1IntegerCompute(project,rom,record,automatic,camera,{applyFog=true,screenEffectPhase=null,screenEffectRenderState=null}={}){
 const start=performance.now(),e=automatic.environment;need(e?.mode===1&&e.colorReady&&e.ordinaryTimeIndependent,'Source mode1 independent color required');need(!applyFog||e.fogReady&&e.fogTimeIndependent&&e.fogParameters,'Source independent fog parameters required');
 const raster=readInitialMode1RasterProfile(project,rom),inventory=collectInitialMode1IntegerInputs(project,record,automatic,camera,raster),translucent=collectInitialMode1TexturedTranslucentInputs(project,automatic,inventory),remaining=completeVisibleInventory(inventory,translucent),controls=readInitialTexturedBlendProfile(project,rom);
 // Disabled fog never consumes color/density. Reuse supplied source parameters;
 // an absent source record is not silently filled with guessed light/fog state.
 need(e.fogParameters,'Source fog record required for this first GPU input profile');
 let compositeInputs=translucent;const effectPlan=readRomMapScreenEffectPlan(project,automatic.plan),screenEvidence={plan:effectPlan,requestedPhase:screenEffectPhase,applied:false,currentPhaseProven:false,gatesEvaluated:false};
 need(!screenEffectRenderState||screenEffectPhase,'MSE render state requires its explicit same-draw phase');
 if(screenEffectPhase){need(effectPlan.ready,'Source MSE plan unresolved');if(effectPlan.request){
  const profile=readInitialMseLayers(project,effectPlan),screen=buildMsePolygonInputs(project,profile,{phase:screenEffectPhase,renderState:screenEffectRenderState,indexStart:inventory.polygons.length,rasterProfile:raster});
  // Same source indices and ordering as CPU: all world translucent polygons,
  // then source layer/tile/primitive order. No post-fog image overlay.
  compositeInputs={...translucent,polygons:[...translucent.polygons,...screen.polygons]};
  Object.assign(screenEvidence,{applied:true,polygonCount:screen.polygons.length,skippedLayers:screen.skippedLayers,phase:screen.phase,renderState:screen.renderState,currentPhaseProven:false,gatesEvaluated:screen.gatesEvaluated,scope:screen.scope});
 }}
 const parameters={...e.fogParameters,enabled:applyFog&&e.fogParameters.enabled},job=prepareNativeIntegerCompute(inventory,compositeInputs,controls,parameters);job.evidence.screenEffect=screenEvidence;job.evidence.remaining=remaining;job.evidence.totalGeometryPreparationMs=performance.now()-start;return job;
}
function initialLightBasis(project,camera){
 need(Array.isArray(camera?.viewFx)&&camera.viewFx.length===16&&camera.viewFx.every(Number.isInteger)&&Array.isArray(camera.projectionFx)&&camera.projectionFx.length===16&&camera.projectionFx.every(Number.isInteger),'Source FX32 camera matrices required');
 const checks=[[0x020b52a0,0x17101610],[0x020b51a4,0xe3a02002],[0x020b51ac,0xe5812048],[0x020b52a8,0x32323232],[0x020b51b4,0xe581007c],[0x020b52b8,0x02109d14],[0x020b52a4,0x02109cc8],[0x020b52f0,0xe2811004],[0x020b52f4,0xe3a0203e],[0x02016d6c,0xe3510000],[0x02016d70,0x1a000004],[0x02016d74,0xeb027959]];
 for(const[a,w]of checks){const b=project.sdk.read(a,4);need(new DataView(b.buffer,b.byteOffset,4).getUint32(0,true)===w,'Source default static LIGHT_VECTOR packet differs');}return{matrixFx:camera.viewFx.slice(),checks};
}
/** One caller-supplied source hypothesis. Never selects a slot/time from video,
 * compares alternative hypotheses, or converts elapsed seconds into a phase.
 */
export function prepareInitialMode2IntegerCompute(project,rom,record,automatic,camera,hypothesis){
 const start=performance.now(),sourceCache=createSourcePreparationCache(project);project=sourceCache.project;need(hypothesis?.kind==='ROM-initial-mode2-slot-hypothesis'&&hypothesis.recordKey===record.key&&automatic?.plan?.recordKey===record.key,'Matching explicit mode2 hypothesis required');
 const basis=initialLightBasis(project,camera),raster=readInitialMode1RasterProfile(project,rom),snapshot={profile:hypothesis.kind,recordKey:record.key,timeIndex:hypothesis.timeIndex,coefficient:0,viewFx:camera.viewFx.slice(),projectionFx:camera.projectionFx.slice()},input={ready:true,profile:snapshot.profile,record,snapshot,hypothesis,mode2Evaluation:hypothesis.mode2Evaluation,materialGlobals:hypothesis.materialGlobals,viewFx:camera.viewFx,projectionFx:camera.projectionFx,lightMatrixFx:basis.matrixFx};
 const timings={},mark=(name,fn)=>{const at=performance.now(),value=fn();timings[name]=performance.now()-at;return value;};
 const opaque=mark('sourceOpaqueInventory',()=>collectStaticOpaqueDepthInputs(project,automatic,input,raster,sourceCache)),binary=mark('binaryTextureClassification',()=>classifyStaticBinaryDepthInputs(project,automatic,opaque,raster,sourceCache)),inventory={...mark('sourceMode2Rgb',()=>collectStaticMode0ColorInputs(project,automatic,input,binary,sourceCache)),rasterProfile:raster},normal=mark('billboardNormalMatrices',()=>buildAutomaticNormalMatrices(project,automaticBillboardScenes(project,automatic,camera.viewFx),camera.viewFx)),lit=mark('sourceMode2SceneColors',()=>applyMode2ToAutomaticScenes(project,normal,input)),translucent=mark('translucentInventory',()=>collectInitialMode2TexturedTranslucentInputs(project,lit,inventory,sourceCache)),remaining=completeVisibleInventory(inventory,translucent),controls=readInitialTexturedBlendProfile(project,rom),job=prepareNativeIntegerCompute(inventory,translucent,controls,hypothesis.fogParameters);job.evidence.preparationTimings=timings;job.evidence.sourceCache={...sourceCache.stats};
 job.evidence.remaining=remaining;job.evidence.initialLightBasis=basis;job.evidence.totalGeometryPreparationMs=performance.now()-start;job.evidence.currentEnvironmentCertified=false;job.evidence.minimumProvenATCalls=0;return job;
}
export async function renderPreparedIntegerCompute(renderer,job){
 need(renderer?.ready,'A compiled WebGPU integer renderer is required');const result=await renderer.render(job);need(result.ready,'WebGPU integer arithmetic error flags: '+result.errorFlags);
 const rgba=new Uint8ClampedArray(49152*4),knownMask=new Uint8Array(49152),counts={covered:0,known:0,unknownTranslucentDestinationFragments:0};
 for(let i=0;i<49152;i++){const at=i*8,flags=result.words[at+4];knownMask[i]=flags>>>1&1;counts.covered+=flags&1;counts.known+=knownMask[i];const packed=result.words[at];for(let c=0;c<4;c++){const n=c===3?packed>>>24:(packed>>>(8*c)&255)>>>1;rgba[i*4+c]=(n<<3)|(n>>>2);}if(!(flags&1))for(let j=job.references[i];j<job.references[i+1];j++)counts.unknownTranslucentDestinationFragments+=job.rows[job.references[job.config[14]+j]*40]&1;}
 return{ready:true,complete:false,width:256,height:192,rgba,knownMask,nativeWords:result.words,diagnostics:{backend:'webgpu-source-integer-pixels',preparation:job.evidence,uploadComputeReadbackMs:result.elapsedMs,counts,fogApplied:Boolean(job.config[8]),scope:result.scope,currentEnvironmentCertified:false,minimumProvenATCalls:0}};
}
