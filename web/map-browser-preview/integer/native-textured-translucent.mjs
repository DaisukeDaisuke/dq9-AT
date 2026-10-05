/* SPDX-License-Identifier: GPL-2.0-or-later
 * Bounded A3I5/I4/A5I3 mode0 connection, derived from DeSmuME contributors,535f676:
 * clip interpolation, edge_fx_fl::Interpolant, _drawscanline, _shade, _pixel,
 * alphaBlend and GFX3D_GenerateRenderLists. Existing ROM unpacker is reused.
 * Original source IDs are retained. No captured color/alpha or unique-ID fixup.
 */
import{Narc}from'../vendor/narc-source.js';
import{Compression,BufferReader}from'../vendor/nitro-fs.mjs';
import{readNativeTextureResource}from'../native/native-tex0.mjs';
import{unpackNativeTexture}from'../native/native-texture-unpack.mjs';
import{readNativeModelInfo}from'../native/native-model-info.mjs';
import{readNativeShapes,decodePackedGx,decodeLocalVertices}from'../native/native-sbc-gx.mjs';
import{projectNativePrimitiveFx}from'./native-primitive-inputs.mjs';
import{clipNativePositionPolygon}from'./native-position-clip.mjs';
import{rasterizeTexturedTranslucentCoverageNativeZPolygon}from'./native-polygon-depth.mjs?v=edge-source-return-20261005-0434';
const expand5=x=>x===0?0:2*x+1,modulate=(a,b)=>((a+1)*(b+1)-1)>>6;
const i64=n=>{if(n<-(1n<<63n)||n>=(1n<<63n))throw Error('Active signed64 interpolant overflow unsupported');return n;};
export {readInitialMode1BlendProfile as readInitialTexturedBlendProfile} from './native-mode0-translucent.mjs';

function resource(project,p,e){
 let bytes;if(e.kind==='embedded-model')bytes=project.archive(p.archive).get(p.model);else if(e.kind==='ambl-member'){
  const at=e.name.indexOf('/'),archive=e.name.slice(0,at),member=e.name.slice(at+1),z=Narc.load(new Uint8Array(project.nfs.readFile('data/map/'+archive))),matches=z.files.map((_,i)=>i).filter(i=>z.fnt.getFilenameOf(i)===member);if(matches.length!==1)throw Error('Exact source AMBL member required');bytes=z.files[matches[0]];if(bytes[0]===0x10)bytes=new Uint8Array(Compression.decompress(new BufferReader(bytes.buffer,bytes.byteOffset,bytes.length)));
 }else throw Error('Unsupported source texture resource');return{bytes,resource:readNativeTextureResource(bytes)};
}
export function collectInitialMode1TexturedTranslucentInputs(project,automatic,inventory,sourceCache=null){
 if(automatic?.environmentApplied!==true||automatic.environment.mode!==1||!automatic.environment.colorReady||!automatic.environment.ordinaryTimeIndependent||automatic.plan.recordKey!==inventory.recordKey||inventory.snapshot?.profile!=='ROM-initial-time-independent-mode1')throw Error('Matching source-verified initial mode1 inventory required');
 return collectStaticTexturedTranslucentInputs(project,automatic,inventory,sourceCache);
}
export function collectInitialMode2TexturedTranslucentInputs(project,automatic,inventory,sourceCache=null){
 if(automatic?.mode2Applied!==true||automatic.mode2Evaluation?.ready!==true||automatic.plan.recordKey!==inventory.recordKey||inventory.snapshot?.profile!=='ROM-initial-mode2-slot-hypothesis'||automatic.plan.recordKey!==`map:${automatic.mode2Evaluation.source.callIndex}:${automatic.mode2Evaluation.source.callOffset}`)throw Error('Matching explicit initial mode2 slot hypothesis required');
 return collectStaticTexturedTranslucentInputs(project,automatic,inventory,sourceCache);
}
export function collectInferredMode2TexturedTranslucentInputs(project,automatic,inventory,sourceCache=null){
 if(automatic?.mode2Applied!==true||automatic.mode2Evaluation?.ready!==true||automatic.plan.recordKey!==inventory.recordKey||inventory.snapshot?.profile!=='ROM-mode2-inverse-source-hypothesis'||automatic.plan.recordKey!==`map:${automatic.mode2Evaluation.source?.callIndex}:${automatic.mode2Evaluation.source?.callOffset}`)throw Error('Matching source mode2 inverse hypothesis required');
 return collectStaticTexturedTranslucentInputs(project,automatic,inventory,sourceCache);
}
function collectStaticTexturedTranslucentInputs(project,automatic,inventory,sourceCache=null){
 const polygons=[],rejected=[],cache=new Map();for(const p of inventory.polygons){if(p.classification!=='rejected')continue;
  try{
   const attr=p.materialEvidence.polygonAttribute,alpha=attr>>>16&31;if(!Number.isInteger(attr)||(attr>>>4&3)!==0||alpha<1||alpha>31||(attr&0x4000))throw Error('Requires mode0 alpha1..31 ordinary depth');if(attr&0x800)throw Error('Translucent depth-write branch remains outside measured subset');
   const scene=automatic.scenes[p.sceneIndex],instance=scene.instances.find(v=>v.id===p.instanceId),draw=instance?.draws.find(d=>d.sbcOffset===p.sbcOffset),binding=draw?.textureBinding;
   if(!binding||binding.status!=='bound'||binding.selectionEvidence?.rule!=='embedded-model-then-reverse-ambl-first-exact16-per-mapping')throw Error('Source texture binding unavailable');
   const parameter=(binding.material.textureParameter|binding.texture.parameter)>>>0;if(parameter>>>30!==0||![1,3,6].includes(parameter>>>26&7))throw Error('Only actual A3I5/I4/A5I3 TexGen0 is connected');if(alpha===31&&![1,6].includes(parameter>>>26&7))throw Error('Native classifier places this alpha31 format in opaque list');if(((parameter^binding.texture.parameter)&0x3ff00000)!==0)throw Error('Effective texture format differs');
   const key=JSON.stringify([binding.selectionEvidence,parameter]);let texture=cache.get(key);if(!texture){const e=binding.selectionEvidence,tr=resource(project,p,e.texture),pr=resource(project,p,e.palette),t=tr.resource.textures[e.texture.entryIndex],pal=pr.resource.palettes[e.palette.entryIndex];if(t.nameHex!==e.texture.nameHex||pal.nameHex!==e.palette.nameHex)throw Error('Source texture/palette exact name differs');
    const rgba=unpackNativeTexture(tr.bytes,tr.resource,t,pal,'6665',{paletteBytes:pr.bytes,paletteResource:pr.resource});texture={width:rgba.width,height:rgba.height,rgba6665:rgba.pixels,format:t.format,parameter,wrapMode:parameter>>>16&15,source:{binding:e},raw:{bytes:tr.bytes.slice(t.data.offset,t.data.offset+t.data.bytes),palette:Array.from({length:t.format===1?32:t.format===3?16:8},(_,i)=>new DataView(pr.bytes.buffer,pr.bytes.byteOffset,pr.bytes.length).getUint16(pal.paletteDataOffset+2*i,true))}};cache.set(key,texture);}
   const bytes=project.archive(p.archive).get(p.model);let gx,local;if(sourceCache){({gx,local}=sourceCache.shape(bytes,0,p.shapeIndex));}else{const model=readNativeModelInfo(bytes).models[0],shape=readNativeShapes(bytes,model)[p.shapeIndex];gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes);local=decodeLocalVertices(gx.commands);}if(gx.unresolved.length||local.unresolved.length||local.vertices.length!==draw.vertices.length)throw Error('Source GX correspondence unresolved');
   const uvFx4=p.primitive.vertexIndices.map((i,k)=>{const v=local.vertices[i];if(v.command!==p.primitive.vertexCommands[k]||JSON.stringify(v.positionFx12)!==JSON.stringify(p.primitive.localPositionFx[k])||!v.texcoordFx4)throw Error('Original UV/position command-index differs');return v.texcoordFx4.slice();}),rgb555=p.primitive.vertexIndices.map(i=>draw.vertices[i].color555);if(rgb555.some(v=>!Number.isInteger(v)||v<0||v>32767))throw Error('Source event-ordered RGB555 required');
   const projected=projectNativePrimitiveFx(p.primitive,p.positionMatrixFx,p.projectionFx);polygons.push({...p,args:{...inventory.rasterProfile,clipVerticesFx:projected.clipVerticesFx,polygonAttribute:attr,primitiveMode:p.primitive.primitiveMode,textureFormat:texture.format,textureParameter:parameter},translucentInput:{rgb555,texture:{...texture,uvFx4}},polygonId:attr>>>24&63});
  }catch(e){rejected.push({index:p.index,originalRejection:p.binaryRejection,reason:e.message});}
 }
 return{recordKey:inventory.recordKey,snapshot:inventory.snapshot,sourcePolygonCount:inventory.polygons.length,basePolygons:inventory.polygons.filter(p=>p.classification!=='rejected'),polygons,rejected,unresolved:inventory.unresolved,scope:'Initial mode1 original source A3I5/I4/A5I3 TexGen0 mode0 alpha1..31, depth-write disabled. Other rejected polygons and dynamic instances retained.'};
}
function wrap(v,size,repeat,flip){if(!repeat)return Math.min(size-1,Math.max(0,v));if(!flip)return v&(size-1);v&=size*2-1;return v>=size?size*2-v-1:v;}
function edgeValue(e,vs,values){const a=vs[e.topIndex],b=vs[e.bottomIndex],dn=b.y-a.y;if(dn<=0n)throw Error('Nonascending active attribute edge');const top=values[e.topIndex],bottom=values[e.bottomIndex],y0=(a.y+65535n)/65536n,dy=i64(65536n*(bottom-top))/dn;return i64(top+i64((y0*65536n-a.y)*dy)/65536n+i64((BigInt(e.y)-y0)*dy));}
export function rasterizeNativeTexturedTranslucentMode0(args,input){
 if(![1,3,6].includes(input?.texture?.format)||args.clipVerticesFx.length!==input.rgb555.length||input.texture.uvFx4.length!==input.rgb555.length)throw Error('Original A3I5/I4/A5I3 polygon inputs required');
 const clip=clipNativePositionPolygon(args.clipVerticesFx),uvs=new Map(input.texture.uvFx4.map((v,i)=>[i,v.slice()])),colors=new Map(input.rgb555.map((v,i)=>[i,[0,5,10].map(s=>expand5(v>>>s&31))]));
 for(const q of clip.intersections){const a=uvs.get(q.insideId),b=uvs.get(q.outsideId),ca=colors.get(q.insideId),cb=colors.get(q.outsideId);uvs.set(q.id,a.map((v,c)=>Number((BigInt(v)*4096n+BigInt(b[c]-v)*BigInt(q.ratioFx))/4096n)));colors.set(q.id,ca.map((v,c)=>Number(BigInt.asUintN(8,BigInt.asUintN(64,(BigInt(v)<<12n)+BigInt.asUintN(64,BigInt(cb[c]-v))*BigInt(q.ratioFx))>>12n))));}
 const clippedUvFx4=clip.vertices.map(v=>uvs.get(v.id)),clippedRgb6=clip.vertices.map(v=>colors.get(v.id));if(clip.discarded)return{ready:true,discarded:true,clip,clippedUvFx4,clippedRgb6,fragments:[]};
 const geometry=rasterizeTexturedTranslucentCoverageNativeZPolygon({...args,clipVerticesFx:clip.positionsFx});if(!geometry.ready)return{...geometry,clip,clippedUvFx4,clippedRgb6};
 const attributes=clip.positionsFx.map((v,i)=>{const w=BigInt(v[3]);if(w<=0n)throw Error('Nonpositive perspective W');return[(1n<<44n)/w,...clippedUvFx4[i].map(u=>i64(BigInt(u)*(1n<<40n))/w),...clippedRgb6[i].map(c=>i64(BigInt(c)*(1n<<44n))/w)];}),fragments=[],alpha=args.polygonAttribute>>>16&31,texture=input.texture;let cursor=0;
 for(const row of geometry.scanlines){const width=BigInt(row.xEndExclusive-row.xStart);if(!width)continue;const current=[],delta=[];for(let c=0;c<6;c++){const values=attributes.map(v=>v[c]);current[c]=edgeValue(row.left,geometry.transformed,values);delta[c]=(edgeValue(row.right,geometry.transformed,values)-current[c])/width;}
  for(let x=row.xStart;x<row.xEndExclusive;x++){const g=geometry.fragments[cursor++];if(!g||g.x!==x||g.y!==row.y||current[0]<=0n)throw Error('Attribute/coverage correspondence differs');const uv=current.slice(1,3).map(v=>Number(v/current[0])),sample=[wrap(uv[0],texture.width,!!(texture.wrapMode&1),!!(texture.wrapMode&4)),wrap(uv[1],texture.height,!!(texture.wrapMode&2),!!(texture.wrapMode&8))],at=(sample[1]*texture.width+sample[0])*4,texel=Array.from(texture.rgba6665.slice(at,at+4)),vertexRgb6=current.slice(3).map(v=>Math.max(0,Math.min(63,Number(v/current[0])))),rgb6=texel.slice(0,3).map((v,c)=>modulate(v,vertexRgb6[c])),alpha5=modulate(expand5(texel[3]),expand5(alpha))>>1;fragments.push({...g,uv,sample,vertexRgb6,textureRgba6665:texel,rgb6,alpha5});for(let c=0;c<6;c++)current[c]=i64(current[c]+delta[c]);}
 }
 if(cursor!==geometry.fragments.length)throw Error('Attribute fragment count differs');return{ready:true,discarded:false,culled:geometry.culled,nativeEdgeSetupAbort:geometry.nativeEdgeSetupAbort??null,frontFacing:geometry.facing>=0n,clip,clippedUvFx4,clippedRgb6,fragments};
}
/** Component overlay on a known opaque/binary static subset. Unknown destination
 * cells remain unavailable. IDs are ROM POLYGON_ATTR IDs, sentinel255 is core's
 * kUnsetTranslucentPolyID; it is not an invented per-polygon ID.
 */
export function compositeTexturedTranslucentOverStaticRgb(base,inventory,participants,controls){
 const {alphaBlendEnabled,alphaTestEnabled,alphaTestRef,translucentSortMode}=controls??{};
 if(typeof alphaBlendEnabled!=='boolean'||typeof alphaTestEnabled!=='boolean'||(alphaTestEnabled&&(!Number.isInteger(alphaTestRef)||alphaTestRef<0||alphaTestRef>31))||(!alphaTestEnabled&&alphaTestRef!==null)||translucentSortMode!=='manual-source-order')throw Error('Explicit source alpha controls and manual translucent order required');
 if(!Array.isArray(inventory.basePolygons))throw Error('Original base polygon attributes required for opaque ID/fog state');
 const rgba6665=base.rgba6665.slice(),depth24=base.plane.depth24.slice(),depthOwner=base.plane.owner.slice(),colorOwner=base.plane.owner.slice(),facing=base.plane.frontFacing.slice(),translucentId=new Uint8Array(49152).fill(255),opaqueId=new Uint8Array(49152),isTranslucentPoly=new Uint8Array(49152),isFogged=new Uint8Array(49152),changedMask=new Uint8Array(49152),unavailableMask=base.rgbUnavailableMask.slice(),events=[],stats={incoming:0,depthRejected:0,alphaDiscarded:0,duplicateIdSuppressed:0,blended:0,opaqueWrites:0,unknownDestination:0,depthWrites:0};
 const baseAttributes=new Map(inventory.basePolygons.map(p=>[p.index,p.materialEvidence.polygonAttribute]));for(let i=0;i<49152;i++)if(base.plane.coverage[i]){const attr=baseAttributes.get(base.plane.owner[i]);if(!Number.isInteger(attr)||(attr>>>16&31)!==31)throw Error('Source opaque base owner attribute missing');opaqueId[i]=attr>>>24&63;isFogged[i]=attr>>>15&1;}
 for(const p of [...participants].sort((a,b)=>a.index-b.index)){const source=inventory.polygons.find(v=>v.index===p.index),attr=source?.materialEvidence.polygonAttribute,alpha=attr>>>16&31,format=source?.translucentInput.texture.format;if(!Number.isInteger(attr)||(attr>>>4&3)!==0||alpha<1||alpha>31||(attr&0x4800)||!(alpha<31||[1,6].includes(format)))throw Error('Source translucent classification/depth branch outside subset');const id=attr>>>24&63;
  for(const f of p.fragments){stats.incoming++;const at=f.y*256+f.x,off=at*4;if(!base.plane.coverage[at]||base.rgbUnavailableMask[at]){unavailableMask[at]=1;stats.unknownDestination++;continue;}const prior=Array.from(rgba6665.slice(off,off+4)),lequal=p.frontFacing&&!facing[at]&&prior[3]===31;if(lequal?f.depth24>depth24[at]:f.depth24>=depth24[at]){stats.depthRejected++;continue;}if(f.alpha5===0||(alphaTestEnabled&&f.alpha5<alphaTestRef)){stats.alphaDiscarded++;continue;}
   let output,kind;if(f.alpha5===31){kind='opaque';output=[...f.rgb6,31];opaqueId[at]=id;isTranslucentPoly[at]=1;isFogged[at]=attr>>>15&1;depth24[at]=f.depth24;depthOwner[at]=p.index;stats.opaqueWrites++;stats.depthWrites++;}
   else{if(translucentId[at]===id){stats.duplicateIdSuppressed++;continue;}translucentId[at]=id;const a=f.alpha5+1;kind='blend';output=!alphaBlendEnabled||prior[3]===0?[...f.rgb6,f.alpha5]:[...f.rgb6.map((v,c)=>(a*v+(32-a)*prior[c])>>5),Math.max(f.alpha5,prior[3])];isFogged[at]=Number(Boolean(isFogged[at])&&Boolean(attr&0x8000));stats.blended++;}
   rgba6665.set(output,off);facing[at]=Number(p.frontFacing);colorOwner[at]=p.index;changedMask[at]=1;events.push({index:p.index,x:f.x,y:f.y,polygonId:id,kind,alpha5:f.alpha5,sourceRgb6:f.rgb6,prior,output,depth24:f.depth24,retainedDepth24:depth24[at]});
  }
 }
 return{ready:true,complete:false,width:256,height:192,rgba6665,depth24,depthOwner,colorOwner,frontFacing:facing,translucentId,opaqueId,isTranslucentPoly,isFogged,changedMask,unavailableMask,stats,events,scope:'Source mode0 translucent-list subset, including opaque alpha-texture pixels and indexed textures with polygon alpha<31. Source IDs/manual order/depth writes retained. Unknown geometry, fog application, antialiasing and live framebuffer remain unresolved.'};
}
