/* SPDX-License-Identifier: GPL-2.0-or-later
 * Position/UV/alpha subset derived from DeSmuME535f676 gfx3d.cpp and
 * rasterize.cpp. Copyright DeSmuME contributors. No RGB shader, fog, normal
 * TexGen, SRT replay, translucent composition or native framebuffer claim.
 */
import {readNativeModelInfo} from '../native/native-model-info.mjs';
import {readNativeShapes,decodePackedGx,decodeLocalVertices} from '../native/native-sbc-gx.mjs';
import {clipNativePositionPolygon} from './native-position-clip.mjs';
import {rasterizeBinaryCoverageNativeZPolygon} from './native-polygon-depth.mjs';
import {nativeOpaqueSortBounds,compareNativeOpaqueOrder,testNativeOpaqueDepth} from './static-opaque-depth.mjs';
const S=65536n;
const i64=x=>{if(x<-(1n<<63n)||x>=(1n<<63n))throw Error('Native UV signed64 overflow outside connected scope');return x;};
const s32=x=>{if(x< -2147483648n||x>2147483647n)throw Error('Native UV signed32 overflow outside connected scope');return Number(x);};
/** Read integer GX TEXCOORD state directly, not converted preview Float64 UV.
 * Only explicit TexGen0 is connected. All input texture alpha is verified here.
 */
export function readNativeBinaryPolygonTexture(modelBytes,sourcePolygon,binding,{modelIndex=0,sourceCache=null}={}){
 if(binding?.status!=='bound'||binding.selectionEvidence?.rule!=='embedded-model-then-reverse-ambl-first-exact16-per-mapping')throw Error('Exact ROM source texture binding required');
 const parameter=(binding.material.textureParameter|binding.texture.parameter)>>>0,format=parameter>>>26&7;
 if(parameter>>>30!==0)throw Error('Binary alpha path currently requires explicit GX TexGen0');
 if(((parameter^binding.texture.parameter)&0x3ff00000)!==0)throw Error('Effective texture format/dimensions/color0 alpha differs from decoded resource');
 if(![2,3,4,7].includes(format))throw Error('Texture format outside connected binary opaque-class path');
 const {width,height,pixels}=binding.decoded;if(!(pixels instanceof Uint8Array)||pixels.length!==width*height*4||width<8||height<8||(width&(width-1))||(height&(height-1)))throw Error('Native decoded power-of-two texture required');
 let alpha5,counts;if(sourceCache){({alpha5,counts}=sourceCache.alpha(binding.decoded));}else{alpha5=new Uint8Array(width*height);counts={transparent:0,opaque:0};for(let i=0;i<alpha5.length;i++){const a=pixels[4*i+3];if(a!==0&&a!==255)throw Error('Intermediate texture alpha remains unsupported');alpha5[i]=a===255?31:0;counts[a===255?'opaque':'transparent']++;}}
 let shape,gx,local;if(sourceCache){({shape,gx,local}=sourceCache.shape(modelBytes,modelIndex,sourcePolygon.shapeIndex));}else{const model=readNativeModelInfo(modelBytes).models[modelIndex];shape=readNativeShapes(modelBytes,model)[sourcePolygon.shapeIndex];if(!shape)throw Error('Original native shape absent');gx=decodePackedGx(modelBytes,shape.displayListOffset,shape.displayListBytes);local=decodeLocalVertices(gx.commands);}const allowed=new Set([0,0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x40,0x41]);if(gx.unresolved.length||local.unresolved.length||gx.commands.some(c=>!allowed.has(c.opcode)))throw Error('Shape changes unsupported native state');
 const p=sourcePolygon.primitive,uvFx4=p.vertexIndices.map((index,k)=>{const v=local.vertices[index];if(!v||v.command!==p.vertexCommands[k]||v.positionFx12.some((n,j)=>n!==p.localPositionFx[k][j]))throw Error('Original GX vertex correspondence differs');if(!v.texcoordFx4||v.texcoordFx4.some(n=>!Number.isInteger(n)||n< -32768||n>32767))throw Error('Explicit signed GX TEXCOORD state required');return v.texcoordFx4.slice();});
 return{kind:'source-binary-texgen0',uvFx4,width,height,alpha5,counts,parameter,format,wrapMode:parameter>>>16&15,source:{shapeIndex:shape.index,displayListOffset:shape.displayListOffset,displayListBytes:shape.displayListBytes,vertexCommands:p.vertexCommands.slice(),binding:binding.selectionEvidence}};
}
function wrap(v,size,repeat,flip){if(!repeat)return Math.min(size-1,Math.max(0,v));if(!flip)return v&(size-1);v&=(size*2-1);return v>=size?size*2-v-1:v;}
function interpolantOnEdge(rowEdge,vertices,attributes,key){
 const a=vertices[rowEdge.topIndex],b=vertices[rowEdge.bottomIndex],top=attributes[rowEdge.topIndex][key],bottom=attributes[rowEdge.bottomIndex][key],dn=b.y-a.y;
 if(dn<=0n)throw Error('Nonascending UV edge outside connected path');
 const y0=(a.y+S-1n)/S,dy=i64(S*(bottom-top))/dn,start=i64(top+i64((y0*S-a.y)*dy)/S);
 return i64(start+i64((BigInt(rowEdge.y)-y0)*dy));
}
/** Produces all incoming geometric fragments with exact sampled alpha, then
 * exposes transparent-discard and opaque lists separately. No alpha blending.
 */
export function rasterizeNativeBinaryAlphaPolygon(args,texture,{textureScalingFactor}={}){
 if(args.viewportWord!==0xbfff0000||args.depthMode!=='Z'||args.fragmentSamplingHack!==false)throw Error('Explicit full viewport/Z/integer sampling profile required');
 if(!Number.isInteger(args.polygonAttribute)||(args.polygonAttribute>>>16&31)!==31||(args.polygonAttribute>>>4&3)!==0||(args.polygonAttribute&0x4000))throw Error('Opaque mode0 polygon alpha31 and ordinary depth mode required');
 if(!Number.isInteger(args.primitiveMode)||args.primitiveMode<0||args.primitiveMode>3||args.clipVerticesFx?.length!==(args.primitiveMode%2?4:3))throw Error('Matching original GX primitive required');
 if(texture?.kind!=='source-binary-texgen0'||textureScalingFactor!==1)throw Error('Source binary texture and explicit native1x sampling profile required');
 if(texture.uvFx4.length!==args.clipVerticesFx.length)throw Error('Original UV/position counts differ');
 const clip=clipNativePositionPolygon(args.clipVerticesFx),uvById=new Map(texture.uvFx4.map((v,i)=>[i,v.slice()]));
 for(const x of clip.intersections){const a=uvById.get(x.insideId),b=uvById.get(x.outsideId);if(!a||!b)throw Error('Clip UV dependency absent');uvById.set(x.id,a.map((v,k)=>s32(i64(BigInt(v)*4096n+i64(BigInt(b[k]-v)*BigInt(x.ratioFx)))/4096n)));}
 const clippedUvFx4=clip.vertices.map(v=>uvById.get(v.id));
 if(clip.discarded)return{ready:true,discarded:true,clip,clippedUvFx4,fragments:[],opaqueFragments:[],transparentFragments:[]};
 const geometry=rasterizeBinaryCoverageNativeZPolygon({...args,textureFormat:texture.format,textureAllAlpha255:texture.counts.transparent===0,textureBinaryAlpha:true,clipVerticesFx:clip.positionsFx});
 if(!geometry.ready)return{...geometry,clip,clippedUvFx4};
 const attributes=clip.positionsFx.map((v,i)=>{const w=BigInt(v[3]);if(w<=0n)throw Error('Nonpositive perspective W is unsupported');return{invW:(1n<<44n)/w,s:i64(BigInt(clippedUvFx4[i][0])*(1n<<40n))/w,t:i64(BigInt(clippedUvFx4[i][1])*(1n<<40n))/w};}),fragments=[],opaqueFragments=[],transparentFragments=[];
 for(const row of geometry.scanlines){const width=BigInt(row.xEndExclusive-row.xStart);if(width===0n)continue;const current={},delta={};for(const key of['invW','s','t']){current[key]=interpolantOnEdge(row.left,geometry.transformed,attributes,key);const end=interpolantOnEdge(row.right,geometry.transformed,attributes,key);delta[key]=(end-current[key])/width;}
  let z=row.left.z;for(let x=row.xStart;x<row.xEndExclusive;x++,z=i64(z+row.zStep)){
   if(current.invW<=0n)throw Error('Interpolated inverse W outside connected positive domain');const uv=[s32(current.s/current.invW),s32(current.t/current.invW)],sample=[wrap(uv[0],texture.width,Boolean(texture.wrapMode&1),Boolean(texture.wrapMode&4)),wrap(uv[1],texture.height,Boolean(texture.wrapMode&2),Boolean(texture.wrapMode&8))],alpha=texture.alpha5[sample[1]*texture.width+sample[0]];
   if(alpha!==0&&alpha!==31)throw Error('Intermediate sampled alpha remains unsupported');
   // With polygon alpha31, core modulate_table[expand5(alpha)][63] >>1
   // returns the same binary alpha. No RGB/color default is introduced.
   const fragment={x,y:row.y,depth24:Number(BigInt.asUintN(32,z/(1n<<19n))&0xfffffffen),uv,sample,alpha5:alpha};fragments.push(fragment);(alpha?opaqueFragments:transparentFragments).push(fragment);for(const key of['invW','s','t'])current[key]=i64(current[key]+delta[key]);
  }
 }
 if(fragments.length!==geometry.fragments.length||fragments.some((f,i)=>f.x!==geometry.fragments[i].x||f.y!==geometry.fragments[i].y||f.depth24!==geometry.fragments[i].depth24))throw Error('UV walk lost native position/depth correspondence');
 return{ready:true,discarded:false,culled:geometry.culled,frontFacing:geometry.facing>=0n,clip,clippedUvFx4,fragments,opaqueFragments,transparentFragments,scope:'Native integer position/UV clip, perspective, nearest wrap/sample and binary alpha only. No RGB/fog/translucent shader or framebuffer acceptance.'};
}
/** Add a proven binary polygon to an explicitly supplied ordered fragment set.
 * Depth rules are reused; alpha0 never claims coverage or changes depth.
 * Caller supplies all participating polygons so native Y-sort is respected.
 */
export function compositeBinaryAwareDepth(polygons){
 const sorted=polygons.map(p=>({...p,sort:nativeOpaqueSortBounds(p.clipVerticesFx)})).sort(compareNativeOpaqueOrder),coverage=new Uint8Array(49152),depth24=new Uint32Array(49152),owner=new Int32Array(49152),frontFacing=new Uint8Array(49152),stats={incoming:0,alphaDiscarded:0,opaque:0,firstCoverage:0,overlapPassed:0,overlapRejected:0};owner.fill(-1);
 for(const p of sorted)for(const f of p.fragments){stats.incoming++;if(f.alpha5===0){stats.alphaDiscarded++;continue;}if(f.alpha5!==31)throw Error('Only explicit opaque/binary fragment alpha may be composed');stats.opaque++;const at=f.y*256+f.x;let pass=true;if(coverage[at]){pass=testNativeOpaqueDepth(f.depth24,p.frontFacing,depth24[at],Boolean(frontFacing[at])).pass;stats[pass?'overlapPassed':'overlapRejected']++;}else stats.firstCoverage++;if(pass){coverage[at]=1;depth24[at]=f.depth24;owner[at]=p.index;frontFacing[at]=Number(p.frontFacing);}}
 return{coverage,depth24,owner,frontFacing,stats,sortOrder:sorted.map(p=>p.index),scope:'Isolated participating opaque/binary source fragments only; no native clear/background or complete framebuffer.'};
}
