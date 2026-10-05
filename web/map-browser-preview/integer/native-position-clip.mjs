/* SPDX-License-Identifier: GPL-2.0-or-later
 * Position-only port of DeSmuME 535f676, Copyright DeSmuME contributors.
 * gfx3d.cpp:GFX3D_LerpSigned, GFX3D_ClipPoint, ClipperPlane and six stages.
 * This preserves native N-gon order. It does not interpolate texture/color,
 * implement shadow/translucent rendering, or accept full-frame pixel parity.
 */
import {rasterizePositionClippedNativeZPolygon} from './native-polygon-depth.mjs';
const PLANES=[[0,-1],[0,1],[1,-1],[1,1],[2,-1],[2,1]];
const i64=x=>{if(x<-(1n<<63n)||x>=(1n<<63n))throw Error('Native clip signed64 overflow outside connected scope');return x;};
const s32=x=>{if(x< -2147483648n||x>2147483647n)throw Error('Native clip signed32 overflow outside connected scope');return Number(x);};
/** Six-plane native integer POSITION clip. Input is one original GX polygon.
 * All interpolation is signed truncation toward zero, including both ratio
 * divisions. Vertex traces describe geometry only, not attribute interpolation.
 */
export function clipNativePositionPolygon(clipVerticesFx){
 if(!Array.isArray(clipVerticesFx)||![3,4].includes(clipVerticesFx.length)||clipVerticesFx.some(v=>!Array.isArray(v)||v.length!==4||v.some(x=>!Number.isInteger(x)||x< -2147483648||x>2147483647)))throw Error('Original triangle/quad signed FX32 positions required');
 if(clipVerticesFx.some(v=>v[3]===-2147483648))throw Error('Native signed W negation overflow outside connected scope');
 let vertices=clipVerticesFx.map((positionFx,index)=>({id:index,sourceIndex:index,positionFx:positionFx.slice()})),nextId=vertices.length,scratchCount=0;
 const stages=[],intersections=[];
 for(let stage=0;stage<PLANES.length;stage++){
  const[coordinate,side]=PLANES[stage],input=vertices,output=[];
  const outside=v=>side===-1?v.positionFx[coordinate]<-v.positionFx[3]:v.positionFx[coordinate]>v.positionFx[3];
  const intersect=(inside,out)=>{
   const a=inside.positionFx.map(BigInt),b=out.positionFx.map(BigInt),ci=a[coordinate],co=b[coordinate],wi=BigInt(side)*a[3],wo=BigInt(side)*b[3],den=(wo-wi)-(co-ci);
   if(den===0n)throw Error('Native clip ratio denominator is zero');
   const ratio=i64((ci-wi)*65536n)/den/16n;
   if(ratio<0n||ratio>4096n)throw Error('Native clip ratio outside connected segment domain');
   const positionFx=a.map((x,j)=>s32(i64(x*4096n+i64((b[j]-x)*ratio))/4096n));
   positionFx[coordinate]=s32(BigInt(side)*BigInt(positionFx[3]));
   if(++scratchCount>64)throw Error('Native clip scratch bound reached');
   const v={id:nextId++,sourceIndex:null,positionFx};intersections.push({id:v.id,stage,coordinate,side,insideId:inside.id,outsideId:out.id,ratioFx:Number(ratio),positionFx:positionFx.slice()});return v;
  };
  // clipVert defers the first vertex. Each successive segment emits vtx1
  // when both inside; finish adds last->first. This also retains the native
  // one-step cyclic rotation on planes that cut no vertex.
  for(let i=0;i<input.length;i++){
   const a=input[i],b=input[(i+1)%input.length],oa=outside(a),ob=outside(b);
   if(!oa&&!ob)output.push(b);
   else if(!oa&&ob)output.push(intersect(a,b));
   else if(oa&&!ob){output.push(intersect(b,a));output.push(b);}
  }
  stages.push({stage,coordinate,side,inputIds:input.map(v=>v.id),outputIds:output.map(v=>v.id),outputPositionsFx:output.map(v=>v.positionFx.slice())});vertices=output;
 }
 if(vertices.length>=10)throw Error('Native output exceeds asserted MAX_CLIPPED_VERTS subset');
 return{ready:true,discarded:vertices.length<3,originalVertexCount:clipVerticesFx.length,outputVertexCount:vertices.length,positionsFx:vertices.map(v=>v.positionFx),vertices,stages,intersections,scope:'Native six-plane integer positions and N-gon order only; no texture/color attributes.'};
}
/** Connect clipped positions to the existing integer polygon edge walk. */
export function rasterizeNativePositionClippedZPolygon(args){
 // Enforce the same opaque source profile even when the clipper discards all
 // vertices; a clipped-away unsupported material is not a successful draw.
 if(args.depthMode!=='Z'||args.viewportWord!==0xbfff0000||args.fragmentSamplingHack!==false)throw Error('Explicit full native viewport/Z/integer sampling profile required');
 if(!Number.isInteger(args.polygonAttribute)||(args.polygonAttribute>>>16&31)!==31||(args.polygonAttribute>>>4&3)!==0||(args.polygonAttribute&0x4000))throw Error('Ordinary opaque mode0 non-equal-depth polygon required');
 if(![2,3,4,7].includes(args.textureFormat)||args.textureAllAlpha255!==true)throw Error('Proven opaque texture required for connected clipped path');
 if(!Number.isInteger(args.primitiveMode)||args.primitiveMode<0||args.primitiveMode>3||args.clipVerticesFx?.length!==(args.primitiveMode%2?4:3))throw Error('Matching original GX primitive required');
 const clip=clipNativePositionPolygon(args.clipVerticesFx);
 if(clip.discarded)return{ready:true,discarded:true,clip,width:256,height:192,coverage:new Uint8Array(49152),depth24:new Uint32Array(49152),fragments:[],scanlines:[]};
 const depth=rasterizePositionClippedNativeZPolygon({...args,clipVerticesFx:clip.positionsFx});
 return{...depth,discarded:false,clip,originalVertexCount:args.clipVerticesFx.length,scope:'Integer position clipping and incoming N-gon coverage/Z only. No interpolated texture/color, scene depth test, final framebuffer or fog.'};
}
