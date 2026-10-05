/* SPDX-License-Identifier: GPL-2.0-or-later
 * DeSmuME535f676 integer attribute preparation. Existing source clip/edge
 * functions are reused; packed pixel work is consumed by WebGPU without floats.
 */
import{clipNativePositionPolygon}from'./integer/native-position-clip.mjs';
import{prepareBinaryNativeZScanlines,prepareTexturedTranslucentNativeZScanlines}from'./integer/native-polygon-depth.mjs';
import{nativeOpaqueSortBounds,compareNativeOpaqueOrder}from'./integer/static-opaque-depth.mjs';
import{buildFogTable,rgb555To6665}from'./native/fog-raster.mjs';
const need=(x,m)=>{if(!x)throw Error(m);},i64=x=>{need(x>=-(1n<<63n)&&x<(1n<<63n),'Active signed64 interpolation overflow');return x;};
const pack=v=>(v[0]|v[1]<<8|v[2]<<16|v[3]<<24)>>>0;
const put64=(a,at,v)=>{v=i64(v);a[at]=Number(BigInt.asUintN(32,v));a[at+1]=Number(BigInt.asUintN(32,v>>32n));};
function edgeValue(e,vs,values){const a=vs[e.topIndex],b=vs[e.bottomIndex],dn=b.y-a.y;need(dn>0n,'Nonascending active edge');const top=values[e.topIndex],bottom=values[e.bottomIndex],y0=(a.y+65535n)/65536n,dy=i64(65536n*(bottom-top))/dn;return i64(top+i64((y0*65536n-a.y)*dy)/65536n+i64((BigInt(e.y)-y0)*dy));}
/** Explicit first subset: every participating depth polygon must have source
 * color inputs. Unsupported/dynamic records stay in evidence, never disappear.
 * Exact scanline-only edge entry avoids CPU per-pixel depth materialization;
 * source clip/edge/attribute preparation remains CPU work.
 */
export function prepareNativeIntegerCompute(inventory,translucent,controls,fogParameters){
 const started=performance.now();need(inventory?.recordKey===translucent?.recordKey&&JSON.stringify(inventory.snapshot)===JSON.stringify(translucent.snapshot),'Same scene/snapshot required');
 need(inventory.textureScalingFactor===1,'Native1x profile required');
 need(typeof controls?.alphaBlendEnabled==='boolean'&&typeof controls.alphaTestEnabled==='boolean'&&controls.translucentSortMode==='manual-source-order','Explicit alpha controls required');
 need(controls.alphaTestEnabled?Number.isInteger(controls.alphaTestRef)&&controls.alphaTestRef>=0&&controls.alphaTestRef<=31:controls.alphaTestRef===null,'Alpha threshold contract differs');
 const opaque=inventory.polygons.filter(p=>p.classification!=='rejected');need(opaque.every(p=>p.colorInput),'GPU subset cannot conceal a depth owner without RGB');
 const ordered=[...opaque.map(p=>({...p,sort:nativeOpaqueSortBounds(p.args.clipVerticesFx),gpuTranslucent:false})).sort(compareNativeOpaqueOrder),...translucent.polygons.map(p=>({...p,gpuTranslucent:true})).sort((a,b)=>a.index-b.index)];
 const rows=[],textureWords=[],textureCache=new Map(),counts=new Uint32Array(49152),ledger=[];
 for(const p of ordered){
  const input=p.gpuTranslucent?p.translucentInput:p.colorInput,t=input.texture,args=p.args,attr=args.polygonAttribute,alpha=attr>>>16&31;
  need(args.viewportWord===0xbfff0000&&args.depthMode==='Z'&&args.fragmentSamplingHack===false,'Full viewport/Z/integer sampling required');
  need((attr>>>4&3)===0&&!(attr&0x4000)&&alpha>0&&alpha<=31,'Mode0 ordinary depth required');
  need(p.gpuTranslucent?!(attr&0x800)&&[1,3,6].includes(t.format)&&(alpha<31||[1,6].includes(t.format)):alpha===31&&[2,3,4,7].includes(t.format),'Source opaque/translucent classification differs');
  need(t.parameter>>>30===0&&t.uvFx4.length===args.clipVerticesFx.length&&input.rgb555.length===args.clipVerticesFx.length,'Source TexGen0 position/UV/RGB required');
  need(t.width>=8&&t.height>=8&&!(t.width&(t.width-1))&&!(t.height&(t.height-1))&&t.rgba6665?.length===t.width*t.height*4,'Source texture dimensions differ');
  let textureOffset=textureCache.get(t.rgba6665);if(textureOffset===undefined){textureOffset=textureWords.length;for(let i=0;i<t.rgba6665.length;i+=4){const v=t.rgba6665.subarray(i,i+4);need(v[0]<=63&&v[1]<=63&&v[2]<=63&&v[3]<=31,'RGBA6665 texture required');if(!p.gpuTranslucent)need(v[3]===0||v[3]===31,'Opaque-list texture alpha must be binary');textureWords.push(pack(v));}textureCache.set(t.rgba6665,textureOffset);}
  const clip=clipNativePositionPolygon(args.clipVerticesFx),uvs=new Map(t.uvFx4.map((v,i)=>[i,v.slice()])),rgb=new Map(input.rgb555.map((v,i)=>{need(Number.isInteger(v)&&v>=0&&v<=32767,'Source RGB555 required');return[i,[0,5,10].map(s=>{const n=v>>>s&31;return n?2*n+1:0;})];}));
  for(const q of clip.intersections){const a=uvs.get(q.insideId),b=uvs.get(q.outsideId),c=rgb.get(q.insideId),d=rgb.get(q.outsideId);uvs.set(q.id,a.map((v,k)=>Number(i64(BigInt(v)*4096n+i64(BigInt(b[k]-v)*BigInt(q.ratioFx)))/4096n)));rgb.set(q.id,c.map((v,k)=>Number(BigInt.asUintN(8,BigInt.asUintN(64,(BigInt(v)<<12n)+BigInt.asUintN(64,BigInt(d[k]-v))*BigInt(q.ratioFx))>>12n))));}
  const entry={index:p.index,translucent:p.gpuTranslucent,clipDiscarded:clip.discarded,rows:0};ledger.push(entry);if(clip.discarded)continue;
  const geometry=(p.gpuTranslucent?prepareTexturedTranslucentNativeZScanlines:prepareBinaryNativeZScanlines)({...args,textureFormat:t.format,textureBinaryAlpha:true,clipVerticesFx:clip.positionsFx});need(geometry.ready,geometry.reason);entry.culled=geometry.culled;entry.nativeEdgeSetupAbort=geometry.nativeEdgeSetupAbort??null;
  const attributes=clip.vertices.map(v=>{const w=BigInt(v.positionFx[3]);need(w>0n,'Positive perspective W required');return[(1n<<44n)/w,...uvs.get(v.id).map(u=>i64(BigInt(u)*(1n<<40n))/w),...rgb.get(v.id).map(c=>i64(BigInt(c)*(1n<<44n))/w)];});
  for(const row of geometry.scanlines){const width=row.xEndExclusive-row.xStart;if(!width)continue;const values=new Uint32Array(40);values.set([Number(p.gpuTranslucent),p.index,attr,textureOffset,t.width,t.height,t.wrapMode,row.xStart,width,row.y,Number(geometry.facing>=0n),0]);put64(values,12,row.left.z);put64(values,14,row.zStep);i64(row.left.z+row.zStep*BigInt(width));
   for(let c=0;c<6;c++){const v=attributes.map(a=>a[c]),current=edgeValue(row.left,geometry.transformed,v),delta=(edgeValue(row.right,geometry.transformed,v)-current)/BigInt(width);i64(current+delta*BigInt(width));if(c===0)need(current>0n&&current+delta*BigInt(width-1)>0n,'Positive active inverse W required');put64(values,16+c*4,current);put64(values,18+c*4,delta);}
   rows.push(values);entry.rows++;for(let x=row.xStart;x<row.xEndExclusive;x++)counts[row.y*256+x]++;
  }
 }
 const starts=new Uint32Array(49153);for(let i=0;i<49152;i++)starts[i+1]=starts[i]+counts[i];const references=new Uint32Array(starts.length+starts[49152]),cursor=starts.slice(0,49152);references.set(starts);
 rows.forEach((r,i)=>{for(let x=r[7];x<r[7]+r[8];x++)references[49153+cursor[r[9]*256+x]++]=i;});
 const packedRows=new Uint32Array(rows.length*40);rows.forEach((r,i)=>packedRows.set(r,i*40));const texels=Uint32Array.from(textureWords),fogTable=Uint32Array.from(buildFogTable(fogParameters));
 const config=Uint32Array.from([256,192,rows.length,0,Number(controls.alphaBlendEnabled),Number(controls.alphaTestEnabled),controls.alphaTestEnabled?controls.alphaTestRef:0,0,Number(fogParameters.enabled),Number(fogParameters.alphaOnly),pack(rgb555To6665(fogParameters.color)),0,40,texels.length,49153,0]);
 return{config,rows:packedRows,references,texels,fogTable,evidence:{recordKey:inventory.recordKey,snapshot:inventory.snapshot,controls,sourcePolygons:inventory.polygons.length,participatingPolygons:ordered.length,scanlines:rows.length,incomingReferences:starts[49152],textureCount:textureCache.size,unresolved:inventory.unresolved,excluded:translucent.rejected,ledger,preparationMs:performance.now()-started,scope:'CPU clip/edge/NORMAL, GPU integer perspective/sample/depth/ID/blend/fog. No full native framebuffer or all-map claim.'}};
}
