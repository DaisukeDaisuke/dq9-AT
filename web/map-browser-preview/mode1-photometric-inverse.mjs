import {runSourceStepsSync,runSourceStepsAsync} from './cooperative-source-work.mjs?v=native-body-20261006-0212';
/* Source-retained mode1 COLOR inference. One algebraic white texture basis;
 * no time/fog-state images are searched. Source COLOR interpolation and the common
 * zero-fog domain delimit the supported photometric observations. */
import{readMode1OrdinaryHypotheses,applyMode1OrdinaryHypothesis}from'./automatic-material-environment.mjs?v=native-body-20261006-0212';
import{automaticBillboardScenes}from'./automatic-billboard-scene.mjs';
import{readInitialMode1RasterProfile,collectInitialMode1IntegerInputsSteps}from'./integer/initial-mode1-integer-preview.mjs?v=destination-reuse-20261006-0501';
import{renderClassifiedStaticBinaryDepthSteps}from'./integer/static-binary-depth.mjs?v=destination-reuse-20261006-0501';
import{renderStaticMode0RgbSteps,presentStaticRgb}from'./integer/static-mode0-rgb.mjs?v=destination-reuse-20261006-0501';
import{collectInitialMode1TexturedTranslucentInputs,readInitialTexturedBlendProfile,rasterizeNativeTexturedTranslucentMode0,compositeTexturedTranslucentOverStaticRgb}from'./integer/native-textured-translucent.mjs?v=destination-reuse-20261006-0501';
import{projectNativePrimitiveFx}from'./integer/native-primitive-inputs.mjs';
import{clipNativePositionPolygon}from'./integer/native-position-clip.mjs?v=destination-reuse-20261006-0501';
import{buildFogTable}from'./native/fog-raster.mjs';
import{prepareNativeIntegerCompute}from'./native-integer-compute-input.mjs?v=destination-reuse-20261006-0501';
import{renderPreparedIntegerCompute}from'./prepare-initial-integer-compute.mjs?v=destination-reuse-20261006-0501';
const need=(x,m)=>{if(!x)throw Error(m);},expand=n=>n?2*n+1:0,median=a=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
function* prepareMode1PhotometricBasisSteps({project,rom,record,automatic,camera}){
 const read=readMode1OrdinaryHypotheses(project,record,automatic);need(read.ready,read.reason);need(read.environment.timeIndependenceProof.commonMaterial,'Variable material globals outside flat-COLOR inverse subset');
 const billboard=automaticBillboardScenes(project,automatic,camera.viewFx),states=read.hypotheses.map(e=>applyMode1OrdinaryHypothesis(project,record,billboard,e));need(states.every(a=>a.environmentApplied),'Source mode1 COLOR replay unresolved');
 // The first record is a structural input only: every color is overwritten by
 // algebraic white before any raster; neither it nor its fog is a preview.
 const profile=readInitialMode1RasterProfile(project,rom),original=yield*collectInitialMode1IntegerInputsSteps(project,record,states[0],camera,profile),trans=collectInitialMode1TexturedTranslucentInputs(project,states[0],original),controls=readInitialTexturedBlendProfile(project,rom);
 need(original.unresolved.every(x=>x.reason?.startsWith('name-char3-A / ')),'Source basis contains unresolved drawable instances');
 for(const reject of trans.rejected){const p=original.polygons[reject.index],position=projectNativePrimitiveFx(p.primitive,p.positionMatrixFx,p.projectionFx);need(clipNativePositionPolygon(position.clipVerticesFx).discarded,'Unsupported visible polygon in mode1 basis');}
 const colors=new Map();
 for(const p of original.polygons){if(!p.colorInput)continue;const perState=states.map(active=>{const instance=active.scenes[p.sceneIndex]?.instances.find(i=>i.id===p.instanceId),draw=instance?.draws.find(d=>d.sbcOffset===p.sbcOffset);return p.primitive.vertexIndices.map(i=>draw?.vertices[i]?.color555);});
  if(perState.every(a=>a.length>=3&&a.length<=4&&a.every(Number.isInteger)))colors.set(p.index,perState);
 }
 const white=p=>({...p,colorInput:p.colorInput?{...p.colorInput,rgb555:p.colorInput.rgb555.map(()=>32767)}:null});
 const inventory={...original,polygons:original.polygons.map(white)},translucent={...trans,basePolygons:trans.basePolygons.map(white),polygons:trans.polygons.map(p=>({...p,translucentInput:{...p.translucentInput,rgb555:p.translucentInput.rgb555.map(()=>32767)}}))};
 const whiteTextures=new Map(),unit=[31,31<<5,31<<10,0],weightInput=input=>{let rgba6665=whiteTextures.get(input.texture.rgba6665);if(!rgba6665){rgba6665=input.texture.rgba6665.map((v,i)=>i%4===3?v:63);whiteTextures.set(input.texture.rgba6665,rgba6665);}return{...input,rgb555:input.rgb555.map((_,i)=>unit[i]),texture:{...input.texture,rgba6665}};};
 const weightInventory={...inventory,polygons:inventory.polygons.map(p=>({...p,colorInput:p.colorInput?weightInput(p.colorInput):null}))},weightTranslucent={...translucent,basePolygons:weightInventory.polygons.filter(p=>p.classification!=='rejected'),polygons:translucent.polygons.map(p=>({...p,translucentInput:weightInput(p.translucentInput)}))};
 const zeroFog=new Uint8Array(32768).fill(1);for(const e of read.hypotheses){const table=buildFogTable(e.fogParameters);for(let i=0;i<zeroFog.length;i++)if(e.fogParameters.enabled&&!e.fogParameters.alphaOnly&&table[i]!==0)zeroFog[i]=0;}
 return{kind:'source-mode1-white-texture-basis',recordKey:record.key,read,states,inventory,translucent,weightInventory,weightTranslucent,controls,colors,zeroFog,basisOnly:true,currentEnvironmentCertified:false};
}
export async function renderMode1PhotometricBasis(model,{gpu=null,isCurrent=()=>true,weights=false}={}){
 need(model?.basisOnly&&model.kind==='source-mode1-white-texture-basis','Algebraic mode1 basis required');if(!isCurrent())throw new DOMException('Mode1 inference cancelled','AbortError');
 const {controls}=model,inventory=weights?model.weightInventory:model.inventory,translucent=weights?model.weightTranslucent:model.translucent;let result;
 if(gpu?.ready){const parameters={...model.read.hypotheses[0].fogParameters,enabled:false},job=prepareNativeIntegerCompute(inventory,translucent,controls,parameters);result=await renderPreparedIntegerCompute(gpu,job);const w=result.nativeWords,rgba6665=new Uint8Array(196608),depth24=new Uint32Array(49152),owner=new Int32Array(49152),knownMask=new Uint8Array(49152),isFogged=new Uint8Array(49152);for(let i=0;i<49152;i++){const at=i*8;depth24[i]=w[at+1];owner[i]=w[at+2];knownMask[i]=Number(Boolean(w[at+4]&2)&&w[at+2]===w[at+3]&&w[at+5]===255);isFogged[i]=w[at+4]>>>3&1;for(let c=0;c<4;c++)rgba6665[i*4+c]=w[at]>>>(c*8)&255;}result={...result,rgba6665,sourceDepth24:depth24,owner,knownMask,isFogged};
 }else{
  result=await runSourceStepsAsync(renderMode1BasisCpuSteps(inventory,translucent,controls),{isCurrent});
 }
 if(!isCurrent())throw new DOMException('Mode1 inference cancelled','AbortError');return{...result,basisOnly:true,currentEnvironmentCertified:false,scope:'White vertex-color texture/ownership probe; never a selected ordinary state or accepted background.'};
}
// Exact inverse interval of native integer mode0 modulation followed by the
// existing RGB555 presentation. This avoids a biased continuous point inverse.
export function nativeMode0ColorInterval(texture6,observed8){
 if(!Number.isInteger(texture6)||texture6<0||texture6>63||!Number.isFinite(observed8)||observed8<0||observed8>255)throw Error('Native texture6 and observed channel required');
 let error=Infinity,qs=[];for(let q=0;q<32;q++){const d=Math.abs(((q<<3)|(q>>>2))-observed8);if(d<error){error=d;qs=[q];}else if(d===error)qs.push(q);}
 const intervals=qs.map(q=>{const lo=Math.max(0,Math.ceil((128*q+1)/(texture6+1))-1),hi=Math.min(63,Math.ceil((128*q+129)/(texture6+1))-2);return lo<=hi?{q,lo,hi}:null;}).filter(Boolean);
 if(!intervals.length)return null;return{low:Math.min(...intervals.map(v=>v.lo)),high:Math.min(63,Math.max(...intervals.map(v=>v.hi))+1),quantized:qs,displayError:error};
}
export function inferMode1OrdinaryColor({model,basis,weights,video}){
 need(model?.basisOnly&&basis?.basisOnly&&video?.rgba?.length===196608,'Same-frame algebraic basis and video required');const samples=[],counts={known:0,zeroFog:0,sourceColors:0,interior:0};
 need(weights?.basisOnly,'Independent source interpolation-weight basis required');
 for(let i=0;i<49152;i++){
  if(!basis.knownMask[i]||!weights.knownMask[i]||basis.owner[i]!==weights.owner[i])continue;counts.known++;
  if(basis.isFogged[i]&&!model.zeroFog[basis.sourceDepth24[i]>>>9])continue;counts.zeroFog++;
  const colors=model.colors.get(basis.owner[i]);if(!colors)continue;counts.sourceColors++;
  const x=i%256,y=(i/256)|0;if(x===0||x===255||y===0||y===191||[i-1,i+1,i-256,i+256].some(j=>!basis.knownMask[j]||basis.owner[j]!==basis.owner[i]))continue;counts.interior++;
  const w=[0,1,2].map(c=>weights.rgba6665[i*4+c]/63);w.push(Math.max(0,1-w.reduce((a,b)=>a+b,0)));const total=w.slice(0,colors[0].length).reduce((a,b)=>a+b,0);if(!total)continue;
  for(let c=0;c<3;c++){const predicted=colors.map(vertices=>vertices.reduce((sum,v,j)=>sum+w[j]/total*expand(v>>>(5*c)&31),0));if(predicted.every(v=>v===predicted[0]))continue;
   const texture=basis.rgba6665[i*4+c];if(texture===0)continue;const displayPredicted=predicted.map(v=>((texture+1)*(Math.max(0,Math.min(63,Math.floor(v)))+1)-1)>>7);if(displayPredicted.every(q=>q===displayPredicted[0])){counts.noQuantizedDiscrimination=(counts.noQuantizedDiscrimination??0)+1;continue;}const interval=nativeMode0ColorInterval(texture,video.rgba[i*4+c]);if(!interval){counts.outsideSourceTexture=(counts.outsideSourceTexture??0)+1;continue;}
   samples.push({pixel:i,channel:c,owner:basis.owner[i],interval,predicted,displayPredicted,errors:predicted.map(v=>Math.abs((interval.low+interval.high)/2-v))});
  }
 }
 const pixels=new Set(samples.map(s=>s.pixel)).size;
 if(pixels<256)return{ready:false,reason:'Insufficient discriminating common zero-fog source-COLOR pixels',samples:samples.length,pixels,counts,alternatives:model.read.hypotheses.map(e=>({index:e.discreteOrdinaryHypothesis.index})),currentEnvironmentCertified:false};
 const rows=model.read.hypotheses.map((e,index)=>({index,error:median(samples.map(s=>s.errors[index]))})).sort((a,b)=>a.error-b.error),best=rows[0];
 const equivalent=rows.filter(r=>samples.every(s=>s.predicted[r.index]===s.predicted[best.index]));
 const margins=rows.filter(r=>!equivalent.includes(r)).map(r=>{const informative=samples.filter(s=>s.displayPredicted[r.index]!==s.displayPredicted[best.index]),values=informative.map(s=>s.errors[r.index]-s.errors[best.index]),pixels=new Set(informative.map(s=>s.pixel)).size,margin=values.length?median(values):0,dispersion=values.length?median(values.map(v=>Math.abs(v-margin))):0;return{index:r.index,pixels,margin,dispersion,separated:pixels>=256&&margin>dispersion+Number.EPSILON*64*16};});
 // Arithmetic-roundoff allowance only; no video acceptance threshold.
 // Only pixels with distinct source-predicted quantized display responses may
 // distinguish two states. Interval-center differences alone are not evidence.
 const unique=margins.every(r=>r.separated);
 return{ready:unique,reason:unique?null:'Discrete source COLOR alternatives overlap observed dispersion',index:unique?best.index:null,equivalentIndices:equivalent.map(r=>r.index),samples:samples.length,pixels,counts,alternatives:rows,margins,basisRenders:2,ordinaryStateRenders:0,currentEnvironmentCertified:false,loadRecordObserved:false,
  scope:'Conditional source COLOR discrimination from texture and vertex-weight algebraic bases. Common source-zero-fog pixels only; no fog phase or ordinary-state image search. Codec/geometry/weight-quantization errors and unknown live states remain. One native forward render must validate the proposal.'};
}

function* renderMode1BasisCpuSteps(inventory,translucent,controls){
  const depth=yield*renderClassifiedStaticBinaryDepthSteps(inventory),rgb=yield*renderStaticMode0RgbSteps(inventory,depth),participants=[];for(const p of translucent.polygons){yield 'native-translucent-polygon';const r=rasterizeNativeTexturedTranslucentMode0(p.args,p.translucentInput);need(r.ready,r.reason);participants.push({index:p.index,frontFacing:Boolean(r.frontFacing),fragments:r.fragments});}
  const combined=compositeTexturedTranslucentOverStaticRgb(rgb,translucent,participants,controls),image=presentStaticRgb(combined,{profile:'rgb555-expanded'}),knownMask=Uint8Array.from(rgb.plane.coverage,(v,i)=>Number(v&&!combined.unavailableMask[i]&&combined.colorOwner[i]===combined.depthOwner[i]&&combined.translucentId[i]===255));
  return{...image,rgba:Uint8ClampedArray.from(image.rgba),ready:true,rgba6665:combined.rgba6665,sourceDepth24:combined.depth24,owner:combined.colorOwner,knownMask,isFogged:combined.isFogged,diagnostics:{backend:'CPU-algebraic-white-texture-basis',sourcePolygons:inventory.polygons.length}};
}
export function prepareMode1PhotometricBasis(args){return runSourceStepsSync(prepareMode1PhotometricBasisSteps(args));}
export function prepareMode1PhotometricBasisAsync(args,options){return runSourceStepsAsync(prepareMode1PhotometricBasisSteps(args),options);}
