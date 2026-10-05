/* SPDX-License-Identifier: GPL-2.0-or-later
 * Depth-only port of DeSmuME 535f676, Copyright DeSmuME contributors.
 * Source: rasterize.cpp edge_fx_fl, Interpolant, Step, _sort_verts,
 * _shape_engine, _runscanlines and _drawscanline; gfx3d.cpp viewport/culling.
 * Retains the original triangle/quad. No triangulation, clipper, shader,
 * texture-alpha test, scene depth test, framebuffer compositing or fog.
 */
const S=65536n, I64_MIN=-(1n<<63n), I64_MAX=(1n<<63n)-1n;
const ceil=x=>Number((x+S-1n)/S);
const i64=x=>{if(x<I64_MIN||x>I64_MAX)throw Error('Native signed64 overflow outside validated path');return x;};
function floorDiv(a,b){if(b<=0n)throw Error('Native edge has nonpositive denominator');let q=a/b,r=a%b;if(r<0n){q--;r+=b;}return[q,r];}
function viewport(v,index){const[x,y,z,w]=v.map(BigInt);if(w<=0n||[x,y,z].some(a=>a < -w||a>w))return null;const zz=(z+w)*(1n<<31n)/(2n*w);return{index,x:(x+w)*(256n*S)/(2n*w),y:192n*S-(y+w)*(192n*S)/(2n*w),z:zz>0x7fffffffn?0x7fffffffn:zz,w};}
function edge(a,b){
 let x=BigInt(ceil(a.x)),y=ceil(a.y),height=ceil(b.y)-y,width=ceil(b.x)-Number(x),xStep=1n,errorTerm=0n,numerator=0n,denominator=1n,z=a.z*4096n,zStep=0n;
 if(height<0)throw Error('Nonmonotone native edge outside convex polygon path');
 if(height!==0||width!==0){
  let dn=b.y-a.y;const dm=b.x-a.x;
  if(dn!==0n){denominator=dn*S;[x,errorTerm]=floorDiv(i64(dm*S*BigInt(y)-dm*a.y+dn*a.x-1n+dn*S),denominator);[xStep,numerator]=floorDiv(dm*S,denominator);}
  else{xStep=BigInt(width);dn=1n;}
  // Interpolant::initialize: dx is exactly zero, including stepExtra.
  zStep=i64(S*((b.z-a.z)*4096n))/dn;
  z=i64(z+i64((BigInt(y)*S-a.y)*zStep)/S);
 }
 return{x,y,height,xStep,errorTerm,numerator,denominator,z,zStep,topIndex:a.index,bottomIndex:b.index};
}
function step(e){e.x+=e.xStep;e.y++;e.height--;e.z=i64(e.z+e.zStep);e.errorTerm+=e.numerator;if(e.errorTerm>=e.denominator){e.x++;e.errorTerm-=e.denominator;}}
const edgeState=e=>({...e});
/** Incoming geometric coverage/depth for one explicitly unclipped opaque polygon.
 * fragmentSamplingHack must be an explicit false source profile. It is not
 * inferred from Z mode. textureAllAlpha255 describes the decoded ROM texture,
 * not a substituted alpha. Uncovered depth array entries have no meaning.
 */
export function rasterizeUnclippedNativeZPolygon(args){return rasterizeNativeZPolygon(args,false);}
/** Entry for the exact output order of the position-only native clipper.
 * No second six-plane cyclic rotation; no triangle conversion. Original GX
 * primitiveMode stays explicit although clipping may change the vertex count.
 */
export function rasterizePositionClippedNativeZPolygon(args){return rasterizeNativeZPolygon(args,true);}
/** Binary-alpha callers need incoming coverage BEFORE texel discard. This
 * separate entry requires a proven binary domain, never a false all-opaque flag.
 */
export function rasterizeBinaryCoverageNativeZPolygon(args){return rasterizeNativeZPolygon(args,true,true);}
/** Incoming coverage only for real A3I5/TexGen0 mode0 alpha1..30 inputs.
 * Coverage does not shade or claim opacity. Existing opaque/binary guards stay
 * unchanged; no polygon alpha or format is replaced to enter this path.
 */
export function rasterizeA3I5TranslucentCoverageNativeZPolygon(args){
 if(args.textureFormat!==1||!Number.isInteger(args.textureParameter)||args.textureParameter>>>30!==0||(args.textureParameter>>>26&7)!==1)throw Error('Explicit A3I5 TexGen0 parameter required');
 const alpha=args.polygonAttribute>>>16&31;if(alpha<1||alpha>30)throw Error('Explicit translucent polygon alpha1..30 required');
 return rasterizeNativeZPolygon(args,true,false,true);
}
/** Same incoming geometric path for actual A5I3/TexGen0 alpha1..30 inputs.
 * No alpha/format substitution, and no change to the earlier entry guards.
 */
export function rasterizeA5I3TranslucentCoverageNativeZPolygon(args){
 if(args.textureFormat!==6||!Number.isInteger(args.textureParameter)||args.textureParameter>>>30!==0||(args.textureParameter>>>26&7)!==6)throw Error('Explicit A5I3 TexGen0 parameter required');
 const alpha=args.polygonAttribute>>>16&31;if(alpha<1||alpha>30)throw Error('Explicit translucent polygon alpha1..30 required');
 return rasterizeNativeZPolygon(args,true,false,true);
}
/** Source translucent-list mode0: alpha1..30, or alpha31 A3I5/A5I3.
 * Connected real formats1/3/6 and TexGen0 only. A pixel's sampled alpha may
 * still be31; this entry emits geometry before the compositor classifies it.
 */
export function rasterizeTexturedTranslucentCoverageNativeZPolygon(args){
 const format=args.textureParameter>>>26&7,alpha=args.polygonAttribute>>>16&31;
 if(!Number.isInteger(args.textureParameter)||args.textureParameter>>>30!==0||![1,3,6].includes(format)||format!==args.textureFormat)throw Error('Explicit connected native TexGen0 texture required');
 if(alpha<1||alpha>31||!(alpha<31||format===1||format===6))throw Error('Native translucent-list polygon required');
 return rasterizeNativeZPolygon(args,true,false,true);
}
function rasterizeNativeZPolygon({clipVerticesFx,polygonAttribute,viewportWord,depthMode,primitiveMode,textureFormat,textureAllAlpha255,textureBinaryAlpha,fragmentSamplingHack},postClip,binaryCoverage=false,translucentCoverage=false){
 if(viewportWord!==0xbfff0000)throw Error('Explicit full native viewport required');
 if(depthMode!=='Z')throw Error('Explicit source/observed Z mode required');
 if(fragmentSamplingHack!==false)throw Error('Explicit integer fragment sampling profile required');
 if(!Number.isInteger(polygonAttribute)||(!translucentCoverage&&(polygonAttribute>>>16&31)!==31)||(polygonAttribute>>>4&3)!==0||(polygonAttribute&0x4000))throw Error('Ordinary opaque mode0 non-equal-depth polygon required');
 if(!Number.isInteger(primitiveMode)||primitiveMode<0||primitiveMode>3)throw Error('Original GX primitive mode required');
 if(!translucentCoverage&&(![0,2,3,4,7].includes(textureFormat)||(binaryCoverage?textureBinaryAlpha!==true:(textureFormat!==0&&textureAllAlpha255!==true))))throw Error(binaryCoverage?'Proven binary texture alpha required':'Opaque native texture format and proven all-opaque texels required');
 if(!Array.isArray(clipVerticesFx)||(postClip?(clipVerticesFx.length<3||clipVerticesFx.length>=10):(![3,4].includes(clipVerticesFx.length)||clipVerticesFx.length!==(primitiveMode%2?4:3)))||clipVerticesFx.some(v=>!Array.isArray(v)||v.length!==4||v.some(x=>!Number.isInteger(x)||x< -2147483648||x>2147483647)))throw Error('Original triangle/quad clip-space FX32 vertices required');
 if(postClip&&textureFormat===0)throw Error('Post-clip untextured line classification is outside connected scope');
 const originalTransformed=clipVerticesFx.map(viewport);
 if(originalTransformed.some(v=>v===null))return{ready:false,reason:'Requires clipping or nonpositive W; unclipped path only'};
 if(textureFormat===0){const[a,b,c]=clipVerticesFx;if((a[0]===b[0]&&a[1]===b[1])||(b[0]===c[0]&&b[1]===c[1])||(a[1]===b[1]&&b[1]===c[1])||(a[0]===b[0]&&b[0]===c[0]))return{ready:false,reason:'Source line-segment special path unsupported'};}
 // ClipperPlane::clipSegmentVsPlane forwards vtx1 when both endpoints are
 // inside. Each of the six native planes rotates the sequence once. Keep
 // that cyclic order even though this path never creates clipped vertices.
 const rotation=postClip?0:6%originalTransformed.length;
 const vertices=[...originalTransformed.slice(rotation),...originalTransformed.slice(0,rotation)];
 const facing=vertices.reduce((s,v,j)=>{const p=vertices[(j+vertices.length-1)%vertices.length];return s+(v.y+p.y)*(v.x-p.x);},0n),back=facing<0n,cullingMode=polygonAttribute>>>6&3;
 if(facing===0n)return{ready:false,reason:'Degenerate polygon outside ordinary polygon path'};
 const result={ready:true,width:256,height:192,coverage:new Uint8Array(256*192),depth24:new Uint32Array(256*192),fragments:[],scanlines:[],edgeRuns:[],originalTransformed,transformed:vertices,clipOutputVertexIndices:vertices.map(v=>v.index),facing,cullingMode,culled:![[false,false,true,true],[false,true,false,true]][Number(back)][cullingMode],primitiveVertexCount:vertices.length,scope:'Incoming original-polygon geometric coverage and integer Z. No scene occlusion, final framebuffer, texture sampling or fog.'};
 if(result.culled)return result;
 // _sort_verts: reverse front-facing winding, then rotate to minimum Y.
 const vs=back?[...vertices]:[...vertices].reverse();
 for(let rotations=0;vs.some(v=>v.y<vs[0].y);rotations++){if(rotations>=vs.length)throw Error('Sort did not converge');vs.push(vs.shift());}
 for(let rotations=0;vs[0].y===vs[1].y&&vs[0].x>vs[1].x;rotations++){if(rotations>=vs.length)throw Error('Tie sort did not converge');vs.push(vs.shift());}
 result.sortedVertexIndices=vs.map(v=>v.index);
 // Preserve the native left/right edge walk. Never re-sort intersections or
 // split a quad along an invented diagonal.
 let lv=vs.length,rv=0,left,right,stepLeft=true,stepRight=true;
 for(let runs=0;;runs++){
  if(runs>=2*vs.length)throw Error('Native edge walk did not converge');
  if(stepLeft)left=edge(vs[lv===vs.length?0:lv],vs[lv-1]);
  if(stepRight)right=edge(vs[rv],vs[rv+1]);
  stepLeft=stepRight=false;
  const count=Math.min(left.height,right.height);result.edgeRuns.push({left:edgeState(left),right:edgeState(right),scanlineCount:count});
  for(let row=0;row<count;row++){
   if(left.y!==right.y)throw Error('Native edge Y mismatch');
   const width=right.x-left.x;if(width<0n)throw Error('Negative native span outside convex polygon path');
   const rowInfo={y:left.y,xStart:Number(left.x),xEndExclusive:Number(right.x),left:edgeState(left),right:edgeState(right),fragmentCount:0};
   result.scanlines.push(rowInfo);
   if(width!==0n){
    if(left.y<0||left.y>=192||left.x<0n||right.x>256n)throw Error('Unexpected out-of-frame span in unclipped native path');
    const dz=(right.z-left.z)/width;let z=left.z;rowInfo.zStep=dz;
    for(let x=left.x;x<right.x;x++,z=i64(z+dz)){
     const depth=Number(BigInt.asUintN(32,z/(1n<<19n))&0xfffffffen);if(depth>0xffffff)throw Error('Native depth outside24-bit domain');
     const xx=Number(x),offset=left.y*256+xx;if(result.coverage[offset])throw Error('Duplicate fragment in original polygon walk');
     result.coverage[offset]=1;result.depth24[offset]=depth;result.fragments.push({x:xx,y:left.y,depth24:depth});rowInfo.fragmentCount++;
    }
   }
   step(left);step(right);
  }
  if(right.height===0){stepRight=true;rv++;}if(left.height===0){stepLeft=true;lv--;}
  if(lv<=rv+1)break;
 }
 return result;
}
