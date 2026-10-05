/* SPDX-License-Identifier: GPL-2.0-or-later
 * ROM instruction-derived MSE layout; reuses existing DeSmuME535f676-derived
 * integer clip/sample/blend components, with their original source notices.
 * Explicit constructor/phase diagnostic only, never a recovered live phase.
 */
import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {parseCalls,readPoolString,decodeNumber,u32} from './vendor/call-stream.mjs';
import {bindAutomaticTextures} from './auto-texture-binding.mjs';
import {readNativeTextureResource} from './native/native-tex0.mjs';
import {unpackNativeTexture} from './native/native-texture-unpack.mjs';
import {readNativeModelInfo} from './native/native-model-info.mjs';
import {readNativeShapes,decodePackedGx} from './native/native-sbc-gx.mjs';
import {fxDiv,lookAtFx} from './native/native-camera-fx.mjs';
import {buildCameraGeometry} from './camera-geometry.mjs';
import {retainNativePrimitiveInputs,projectNativePrimitiveFx} from './integer/native-primitive-inputs.mjs';
import {readMseAlphaMaterialRules,validateMseRenderState} from './native-mse-alpha-material.mjs?v=mode2-mse-20261005-0909';
const decoded=raw=>raw[0]===16?new Uint8Array(Compression.decompress(new BufferReader(raw.buffer,raw.byteOffset,raw.length))):raw;
const i32=v=>Number(BigInt.asIntN(32,v)),mul=(a,b)=>i32((BigInt(a)*BigInt(b)+2048n)>>12n);
const multiply=(a,b)=>Array.from({length:16},(_,k)=>{let s=0n;for(let j=0;j<4;j++)s+=BigInt(a[j*4+k%4])*BigInt(b[(k>>2)*4+j]);return i32(s>>12n);});
const matrix=(position=[0,0,0])=>[4096,0,0,0,0,4096,0,0,0,0,4096,0,...position,4096];
function reader(project){
 const word=a=>{const b=project.sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.length).getUint32(0,true);};
 for(const[a,n,want]of[[0x0207ae98,0xbf8,0x92e42b58],[0x0207ba90,0x318,0xb889b0ad],[0x020c44b8,0x204,0x03eeb91a],[0x02034620,0x13c,0xc5fba60d],[0x020367e4,0x98,0xb38e8f6d],[0x020b8a30,0xa4,0xbdcf1ffc],[0x020b53f0,0x28,0x30a8afd3]]){let h=2166136261;for(const b of project.sdk.read(a,n))h=Math.imul(h^b,16777619)>>>0;if(h!==want)throw Error('MSE source span differs at '+a.toString(16));}
 const mov=(a,rd)=>{const w=word(a);if(((w&0xfffff000)>>>0)!==(0xe3a00000|(rd<<12))>>>0)throw Error('Source MOV differs');const shift=(w>>>8&15)*2,value=w&255;return((value>>>shift)|(value<<(32-shift)))>>>0;};
 return{word,mov};
}
function fromFloat(value){const result=Math.trunc(Math.fround(value)*4096);if(!Number.isFinite(value)||result<0||result>2147483647)throw Error('Positive finite BMED FX32 subset required');return result;}
function ortho(top,bottom,left,right,near,far){
 // 020c44b8: signed64 hardware reciprocals, +0x80000000 then high word.
 const inv=v=>(4096n<<32n)/BigInt(v),rounded=n=>i32((n+0x80000000n)>>32n),x=inv(right-left),y=inv(top-bottom),z=inv(near-far),p=Array(16).fill(0);
 p[0]=rounded(x<<13n);p[5]=rounded(y<<13n);p[10]=rounded(z<<13n);p[12]=rounded(-BigInt(right+left)*x);p[13]=rounded(-BigInt(top+bottom)*y);p[14]=rounded(BigInt(far+near)*z);p[15]=4096;return p;
}
/** Lower only source-understood BMED commands. No video/GT/model-name branch. */
export function readInitialMseLayers(project,plan){
 if(!plan.ready||!plan.request?.present)throw Error('Source-resolved MSE request required');
 const r=reader(project),z=Narc.load(decoded(new Uint8Array(project.nfs.readFile(plan.request.path)))),entries=z.files.map((b,i)=>({name:z.fnt.getFilenameOf(i),bytes:decoded(b)})),bmed=entries.filter(e=>e.name.endsWith('.bmed')),cmed=entries.filter(e=>e.name.endsWith('.cmed'));
 if(bmed.length!==1||cmed.length!==1)throw Error('One native BMED/CMED pair required');
 const baseZoom=r.mov(0x0207aeac,0),baseDimension=r.mov(0x0207aed0,0),baseAlpha=r.mov(0x0207aef4,0),baseZero=r.mov(0x0207aea4,1),initial=(name,modelBytes)=>({name,modelBytes,zoomFx:baseZoom,widthFx:baseDimension,heightFx:baseDimension,speedSFx:baseZero,speedTFx:baseZero,offsetSFx:baseZero,offsetTFx:baseZero,flags:baseZero,alpha5:baseAlpha,sourceCalls:[]}),layers=[];
 const c=Narc.load(cmed[0].bytes);for(let i=0;i<c.files.length;i++){
  const path=c.fnt.getFilenameOf(i),name=path.slice(path.lastIndexOf('/')+1);if(!name.endsWith('.chr'))throw Error('CMED member outside source CHR subset');
  const chr=Narc.load(decoded(c.files[i])),models=chr.files.map((b,i)=>({name:chr.fnt.getFilenameOf(i),bytes:decoded(b)}));
  if(models.length!==1||!models[0].name.endsWith('.nsbmd'))throw Error('Animated/multiple-model MSE CHR remains unsupported');
  if(layers.some(l=>l.name===name))throw Error('Ambiguous native layer name');layers.push(initial(name,models[0].bytes));
 }
 let selected=null;const bytes=bmed[0].bytes,pool=u32(bytes,4),calls=parseCalls(bytes);
 for(const call of calls){const args=call.args.map(a=>a.type===0?readPoolString(bytes,pool,a):decodeNumber(a)),types=call.args.map(a=>a.type),proof={index:call.index,offset:call.offset,opcode:call.opcode,args};
  if(call.opcode===0x66){if(types.length!==1||types[0]!==0)throw Error('Layer selector shape differs');selected=layers.find(l=>l.name===args[0]);if(!selected)throw Error('BMED selects unknown native layer');continue;}
  if(call.opcode===0x69){if(types.length!==2||types.some(t=>t!==0)||layers.some(l=>l.name===args[1]))throw Error('Copy name/arity unresolved');const source=layers.find(l=>l.name===args[0]);if(!source)throw Error('Layer copy source absent');const target=initial(args[1],source.modelBytes);target.sourceCalls.push(proof);layers.push(target);continue;}
  if(!selected)throw Error('BMED command without current layer');selected.sourceCalls.push(proof);
  if(call.opcode===0x64){if(![1,2].includes(types.length)||types.some(t=>t!==2))throw Error('Velocity command differs');selected.speedSFx=fromFloat(args[0]);selected.speedTFx=fromFloat(args[1]??args[0]);}
  else if(call.opcode===0x65){if(![1,2].includes(types.length)||types.some(t=>t!==1)||args.some(a=>a<0||a>8||!Number.isInteger(a)))throw Error('Low direction-flag command outside source subset');for(const a of args)selected.flags|=a;}
  else if(call.opcode===0x6a){if(types.length!==1||types[0]!==2)throw Error('Zoom command differs');selected.zoomFx=fromFloat(args[0]);}
  else if(call.opcode===0x6c){if(![1,2].includes(types.length)||types.some(t=>t!==1))throw Error('Layer dimensions command differs');selected.widthFx=fromFloat(args[0]);selected.heightFx=fromFloat(args[1]??args[0]);}
  else throw Error('BMED command not connected: '+call.opcode);
 }
 const viewportWidthFx=r.mov(0x0207bb1c,0),viewportHeightFx=r.mov(0x0207bb2c,0),eyeYFx=r.mov(0x0207bad8,0),depthYFx=-r.mov(0x0207bc60,0),upZFx=r.mov(0x0207bad4,1),nearFx=r.mov(0x0207bb38,2),farFx=r.mov(0x0207bb48,0),firstPolygonId=r.mov(0x0207bb04,4);
 const look=lookAtFx([0,eyeYFx,0],[0,0,upZFx],[0,0,0]),viewFx=[...look.slice(0,3),0,...look.slice(3,6),0,...look.slice(6,9),0,...look.slice(9),4096];
 for(const l of layers){if(l.zoomFx<=0||l.widthFx<=0||l.heightFx<=0||l.flags&~15)throw Error('Layer layout outside proven positive low-flags subset');l.viewportWidthFx=fxDiv(viewportWidthFx,l.zoomFx);l.viewportHeightFx=fxDiv(viewportHeightFx,l.zoomFx);l.columns=Math.trunc(fxDiv(l.viewportWidthFx,l.widthFx)/4096)+1+Number(Boolean(l.flags&12));l.rows=Math.trunc(fxDiv(l.viewportHeightFx,l.heightFx)/4096)+1+Number(Boolean(l.flags&3));l.deltaSFx=mul(l.speedSFx,fxDiv(l.viewportWidthFx,l.widthFx));l.deltaTFx=mul(l.speedTFx,fxDiv(l.viewportHeightFx,l.heightFx));if(l.columns*l.rows>256)throw Error('Bounded layer tile budget exceeded');l.projectionFx=ortho(l.viewportHeightFx>>1,(-l.viewportHeightFx)>>1,(-l.viewportWidthFx)>>1,l.viewportWidthFx>>1,nearFx,farFx);}
 return{layers,viewFx,depthYFx,firstPolygonId,source:{request:plan.request,layerInit:0x0207ae98,bmedDispatch:0x020f0f10,copy:0x020367e4,layout:0x0207ba90,orthographic:0x020c44b8,phaseUpdate:0x0207bd34},currentPhaseProven:false,scope:'ROM BMED resource/configuration plus explicit constructor offsets. Runtime pre-draw fade/enable gates are not evaluated.'};
}
/** Caller explicitly requests constructor offsets or supplies each layer offset.
 * No video time -> draw-count conversion or phase default is performed.
 */
export function buildMsePolygonInputs(project,profile,{phase,indexStart,rasterProfile,renderState}={}){
 if(!Number.isInteger(indexStart)||!rasterProfile||!phase||!['source-constructor','explicit-offsets'].includes(phase.kind))throw Error('Explicit source profile, polygon index, raster profile and phase required');
 const polygons=[],tileEvidence=[],skippedLayers=[];
 if(renderState){readMseAlphaMaterialRules(project.sdk);validateMseRenderState(profile,phase,renderState);}
 for(const [layerIndex,l]of profile.layers.entries()){
  const offset=phase.kind==='source-constructor'?[l.offsetSFx,l.offsetTFx]:phase.offsetsFx?.[layerIndex];if(!Array.isArray(offset)||offset.length!==2||!offset.every(Number.isInteger)||offset[0]<0||offset[0]>=l.widthFx||offset[1]<0||offset[1]>=l.heightFx)throw Error('Explicit source-period layer offsets required');
  const stateAlpha=renderState?renderState.layerAlpha[layerIndex]:null;
  if(stateAlpha===0){skippedLayers.push({layerIndex,reason:'Source effective-alpha0 model draw gate02035424'});continue;}
  const polygonId=profile.firstPolygonId+layerIndex;if(polygonId>63)throw Error('Source polygon-ID range outside connected subset');
  const bindings=bindAutomaticTextures(l.modelBytes,[]),resource=readNativeTextureResource(l.modelBytes),textures=new Map(),padS=Math.max(0,Math.trunc((l.viewportWidthFx-l.widthFx)/2)),padT=Math.max(0,Math.trunc((l.viewportHeightFx-l.heightFx)/2));
  for(let s=0;s<l.columns;s++)for(let t=0;t<l.rows;t++){
   const position=[(s*l.widthFx-padS-offset[0])*(l.flags&4?-1:1),profile.depthYFx,(t*l.heightFx-padT-offset[1])*(l.flags&1?-1:1)],geometry=buildCameraGeometry(l.modelBytes,project.sdk.read(0x020e936c,36),{viewFx:multiply(profile.viewFx,matrix(position))}),preserved=retainNativePrimitiveInputs(l.modelBytes,geometry);
   tileEvidence.push({layerIndex,name:l.name,column:s,row:t,positionFx:position,offsetFx:offset.slice(),polygonId});
   for(const draw of preserved.draws){const supplied=geometry.draws.find(d=>d.sbcOffset===draw.sbcOffset),b=bindings[draw.materialIndex];if(b.status!=='bound'||!b.texture||![1,6].includes(b.texture.format)||b.material.textureSrt||b.material.textureParameter>>>30||b.texture.parameter>>>30)throw Error('MSE requires bound native alpha texture/TexGen0/no texture SRT');if(supplied.vertices.some(v=>v.normalFx9||!Number.isInteger(v.color555)||!v.texcoord))throw Error('MSE requires explicit source GX COLOR/UV and no unresolved NORMAL');
    // Material DIF_AMB may set COLOR at SBC MAT. Here each source shape emits
    // COLOR again before its first VTX and contains no NORMAL, so retained
    // diffuse/specular globals are not read by this fragment-color path.
    const model=readNativeModelInfo(l.modelBytes).models[0],shape=readNativeShapes(l.modelBytes,model)[draw.shapeIndex],gx=decodePackedGx(l.modelBytes,shape.displayListOffset,shape.displayListBytes),firstVertex=gx.commands.findIndex(c=>c.opcode>=0x23&&c.opcode<=0x28),firstColor=gx.commands.findIndex(c=>c.opcode===0x20);
    if(gx.unresolved.length||firstColor<0||firstVertex<0||firstColor>firstVertex||gx.commands.some(c=>c.opcode===0x21))throw Error('MSE shape color depends on prior material/NORMAL state');
    const attributeMask=(b.material.polygonAttributeMask&~0x3f000000)>>>0,globalAttribute=((polygonId<<24)|(31<<16)|(3<<6))>>>0,materialAttribute=stateAlpha===null?b.material.polygonAttribute:((b.material.polygonAttribute&~0x1f0000)|(stateAlpha<<16))>>>0,attr=((globalAttribute&~attributeMask)|(materialAttribute&attributeMask))>>>0;
    if((b.material.flags&32)||(attr>>>4&3)!==0||(attr>>>16&31)!==(stateAlpha??l.alpha5)||(attr&0x4800))throw Error('MSE source material outside connected mode0/no-depth-write subset');
    if(!textures.has(draw.materialIndex)){const decoded=unpackNativeTexture(l.modelBytes,resource,resource.textures[b.texture.index],resource.palettes[b.palette.index],'6665'),parameter=(b.material.textureParameter|b.texture.parameter)>>>0;textures.set(draw.materialIndex,{width:decoded.width,height:decoded.height,rgba6665:decoded.pixels,format:b.texture.format,parameter,wrapMode:parameter>>>16&15});}
    for(const primitive of draw.polygons){const projected=projectNativePrimitiveFx(primitive,draw.positionMatrixFx,l.projectionFx),rgb555=primitive.vertexIndices.map(i=>supplied.vertices[i].color555),uvFx4=primitive.vertexIndices.map(i=>supplied.vertices[i].texcoord.map(n=>n*16));polygons.push({index:indexStart+polygons.length,layerIndex,column:s,row:t,primitive,positionMatrixFx:draw.positionMatrixFx,projectionFx:l.projectionFx,materialEvidence:{polygonAttribute:attr},args:{...rasterProfile,clipVerticesFx:projected.clipVerticesFx,polygonAttribute:attr,primitiveMode:primitive.primitiveMode,textureFormat:b.texture.format,textureParameter:textures.get(draw.materialIndex).parameter},translucentInput:{rgb555,texture:{...textures.get(draw.materialIndex),uvFx4}},polygonId});}
   }
  }
 }
 return{polygons,tileEvidence,skippedLayers,phase,renderState:renderState??null,currentPhaseProven:false,gatesEvaluated:!!renderState,scope:'Source constructor or explicit source-state alpha and offsets; alpha0 model draw gate. Initialized model scale31/no external model override subset. Native framebuffer/video parity remains unverified.'};
}
