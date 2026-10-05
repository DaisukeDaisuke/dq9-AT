/* SPDX-License-Identifier: GPL-2.0-or-later
 * Integer RGB connection derived from DeSmuME contributors, 535f676:
 * gfx3d.cpp SetVertexColor/AddCurrentVertexToList, GFX3D_LerpUnsigned;
 * rasterize.cpp precalculation, edge_fx_fl::Interpolant, _drawscanline, _shade.
 * Reuses source GX COLOR/NORMAL/material replay and existing original-polygon
 * position/UV/alpha/depth components. No preview floating colors are consumed.
 */
import {makeNativeTrig} from '../native/native-map-records.mjs';
import {buildMode2LitGeometry} from './mode2-lighting-adapter.mjs';
import {retainNativePrimitiveInputs} from './native-primitive-inputs.mjs';
import {readNativeBinaryPolygonTexture,rasterizeNativeBinaryAlphaPolygon,compositeBinaryAwareDepth} from './native-binary-alpha.mjs';
import {rasterizeBinaryCoverageNativeZPolygon} from './native-polygon-depth.mjs';
const expand5=n=>n===0?0:n*2+1,expand8=n=>(n<<3)|(n>>>2);
const alphabet=new Map(Array.from({length:32},(_,n)=>[expand8(n),expand5(n)]));
const eq=(a,b)=>a.length===b.length&&a.every((v,i)=>Array.isArray(v)?eq(v,b[i]):v===b[i]);
const mul=(a,b)=>Array.from({length:16},(_,k)=>{let v=0n;for(let j=0;j<4;j++)v+=BigInt(a[j*4+k%4])*BigInt(b[(k>>2)*4+j]);return Number(BigInt.asIntN(32,v>>12n));});
const i64=v=>{if(v<-(1n<<63n)||v>=(1n<<63n))throw Error('RGB signed64 arithmetic outside connected scope');return v;};
/** Replays the existing explicit mode2 inputs and retains original polygon vertex
 * colors by GX command/index. Prior depth eligibility does not imply UV readiness:
 * opaque textures must also pass the source TexGen0/native1x predicate here.
 */
export function collectStaticMode0ColorInputs(project,automatic,input,depthInventory,sourceCache=null){
 if(input?.ready!==true||!['current-buffer-default-static-map-flush','ROM-initial-mode2-slot-hypothesis'].includes(input.profile)||input.record.key!==automatic.plan.recordKey||input.record.key!==depthInventory.recordKey||JSON.stringify(input.snapshot)!==JSON.stringify(depthInventory.snapshot))throw Error('Matching coherent map/frame inputs required');
 if(input.profile==='ROM-initial-mode2-slot-hypothesis'&&(input.hypothesis?.kind!==input.profile||input.hypothesis.recordKey!==input.record.key||input.snapshot?.profile!==input.profile||input.snapshot.timeIndex!==input.hypothesis.timeIndex||input.mode2Evaluation?.selection.index!==input.hypothesis.timeIndex||input.mode2Evaluation.selection.coefficient!==0))throw Error('Initial mode2 source slot/snapshot mismatch');
 if(depthInventory.textureScalingFactor!==1)throw Error('Explicit native1x profile required');
 const trig=makeNativeTrig(project.sdk.read(0x020e955c,16384),25736),cache=new Map(),textureCache=new Map(),polygons=[],counts={sourcePolygons:depthInventory.polygons.length,priorEligible:0,priorRejected:0,colorEligible:0,colorRejected:0};
 for(const p of depthInventory.polygons){const row={...p,colorInput:null,colorRejection:null};polygons.push(row);if(p.classification==='rejected'){counts.priorRejected++;continue;}counts.priorEligible++;
  try{
   const scene=automatic.scenes[p.sceneIndex],instance=scene?.instances.find(i=>i.id===p.instanceId);if(!instance||scene.archiveName!==p.archive||scene.streamName!==p.stream||instance.modelName!==p.model)throw Error('Source instance correspondence changed');
   const key=JSON.stringify([p.sceneIndex,p.instanceId]);const shared=sourceCache?.litInstances.get(instance);let value=cache.get(key)??(shared?.input===input?shared:null);
   if(!value){const bytes=project.archive(p.archive).get(p.model),{sin,cos}=trig(instance.world.yaw),rotation=[cos,0,-sin,0,0,4096,0,0,sin,0,cos,0,0,0,0,4096],world=rotation.slice();for(let c=0;c<3;c++)for(let r=0;r<3;r++)world[c*4+r]=Number(BigInt.asIntN(32,BigInt(rotation[c*4+r])*BigInt(instance.world.scale[c])>>12n));world.splice(12,3,...instance.world.position);
    const lit=buildMode2LitGeometry(bytes,project.sdk,{mode2Evaluation:input.mode2Evaluation,materialGlobals:input.materialGlobals,viewFx:mul(input.viewFx,world),normalViewFx:mul(input.viewFx,rotation),lightMatrixFx:input.lightMatrixFx,retainedLights:input.retainedLights,shininessTable:input.shininessTable});value={bytes,lit,preserved:retainNativePrimitiveInputs(bytes,lit.geometry)};cache.set(key,value);}
   const draw=value.lit.geometry.draws.find(d=>d.sbcOffset===p.sbcOffset),preserved=value.preserved.draws.find(d=>d.sbcOffset===p.sbcOffset),source=instance.draws.find(d=>d.sbcOffset===p.sbcOffset),primitive=preserved?.polygons[p.polygonIndex];
   if(!draw||draw.shapeIndex!==p.shapeIndex||draw.materialIndex!==p.materialIndex||!primitive||!eq(primitive.localPositionFx,p.primitive.localPositionFx)||!eq(primitive.vertexCommands,p.primitive.vertexCommands)||!eq(primitive.vertexIndices,p.primitive.vertexIndices)||!eq(draw.matrix,p.positionMatrixFx))throw Error('Source GX color/position correspondence differs');
   if(value.lit.materialResult.materials[p.materialIndex].polygonAttribute!==p.materialEvidence.polygonAttribute)throw Error('Effective material correspondence differs');
   const rgb555=primitive.vertexIndices.map(i=>draw.vertices[i].color555);if(rgb555.some(v=>!Number.isInteger(v)||v<0||v>32767))throw Error('Explicit replayed GX RGB555 required');
   const texture=readNativeBinaryPolygonTexture(value.bytes,p,source?.textureBinding,{sourceCache}),decoded=source.textureBinding.decoded;let rgba6665=textureCache.get(decoded);
   if(!rgba6665){rgba6665=new Uint8Array(decoded.pixels.length);for(let i=0;i<rgba6665.length;i++){const v=decoded.pixels[i];if(i%4===3){if(v!==0&&v!==255)throw Error('Intermediate texture alpha unsupported');rgba6665[i]=v===255?31:0;}else{const c=alphabet.get(v);if(c===undefined)throw Error('ROM decoded texture RGB is outside exact RGB555 expansion alphabet');rgba6665[i]=c;}}textureCache.set(decoded,rgba6665);}
   row.colorInput={rgb555,texture:{...texture,rgba6665},source:{rule:'existing-mode2-material-normal-and-GX-COLOR-event-order',sbcOffset:p.sbcOffset,shapeIndex:p.shapeIndex,vertexCommands:primitive.vertexCommands.slice(),normalLightingApplied:draw.normalLightingApplied}};counts.colorEligible++;
  }catch(e){row.colorRejection=e.message;counts.colorRejected++;}
 }
 return{...depthInventory,polygons,colorCounts:counts,scope:'Explicit same-frame source material/NORMAL/COLOR replay, original GX vertex order and source TexGen0 textures. All original rejected rows remain present.'};
}
function edgeValue(e,vertices,values){const a=vertices[e.topIndex],b=vertices[e.bottomIndex],dn=b.y-a.y;if(dn<=0n)throw Error('Nonascending active RGB edge unsupported');const top=values[e.topIndex],bottom=values[e.bottomIndex],y0=(a.y+65535n)/65536n,dy=i64(65536n*(bottom-top))/dn;return i64(top+i64((y0*65536n-a.y)*dy)/65536n+i64((BigInt(e.y)-y0)*dy));}
/** Color RGB6 is expanded before unsigned clip interpolation, then perspective
 * interpolated with the same fixed44 reciprocal W and signed truncation as core.
 * UV/sample/depth/alpha are supplied by the unchanged binary component.
 */
export function rasterizeNativeMode0Rgb(args,colorInput,{textureScalingFactor}={}){
 if(!colorInput||colorInput.rgb555.length!==args.clipVerticesFx.length)throw Error('Original source polygon color inputs required');
 const result=rasterizeNativeBinaryAlphaPolygon(args,colorInput.texture,{textureScalingFactor});if(!result.ready) return result;
 const byId=new Map(colorInput.rgb555.map((v,i)=>{if(!Number.isInteger(v)||v<0||v>32767)throw Error('Native RGB555 required');return[i,[0,5,10].map(s=>expand5(v>>>s&31))];}));
 for(const q of result.clip.intersections){const a=byId.get(q.insideId),b=byId.get(q.outsideId);if(!a||!b||q.ratioFx<0||q.ratioFx>4096)throw Error('Unsigned RGB clip dependency/ratio unsupported');byId.set(q.id,a.map((v,c)=>Number(BigInt.asUintN(8,BigInt.asUintN(64,(BigInt(v)<<12n)+BigInt.asUintN(64,BigInt(b[c]-v))*BigInt(q.ratioFx))>>12n))));}
 const clippedRgb6=result.clip.vertices.map(v=>byId.get(v.id));if(result.discarded||result.culled||result.fragments.length===0)return{...result,clippedRgb6};
 const geometry=rasterizeBinaryCoverageNativeZPolygon({...args,textureFormat:colorInput.texture.format,textureBinaryAlpha:true,clipVerticesFx:result.clip.positionsFx});if(!geometry.ready)throw Error(geometry.reason);
 const attributes=result.clip.positionsFx.map((v,i)=>{const w=BigInt(v[3]);if(w<=0n)throw Error('Nonpositive RGB perspective W unsupported');return[(1n<<44n)/w,...clippedRgb6[i].map(c=>i64(BigInt(c)*(1n<<44n))/w)];});let cursor=0;const fragments=[];
 for(const row of geometry.scanlines){const width=BigInt(row.xEndExclusive-row.xStart);if(width===0n)continue;const current=[],delta=[];for(let c=0;c<4;c++){const values=attributes.map(v=>v[c]);current[c]=edgeValue(row.left,geometry.transformed,values);delta[c]=(edgeValue(row.right,geometry.transformed,values)-current[c])/width;}
  for(let x=row.xStart;x<row.xEndExclusive;x++){const f=result.fragments[cursor++];if(!f||f.x!==x||f.y!==row.y||current[0]<=0n)throw Error('RGB/geometry/UV fragment correspondence differs');const vertexRgb6=current.slice(1).map(v=>Number((v/current[0])>63n?63n:(v/current[0])<0n?0n:v/current[0])),at=(f.sample[1]*colorInput.texture.width+f.sample[0])*4,textureRgb6=Array.from(colorInput.texture.rgba6665.slice(at,at+3));if(colorInput.texture.rgba6665[at+3]!==f.alpha5)throw Error('Source texture color/alpha correspondence differs');const rgb6=textureRgb6.map((v,c)=>((v+1)*(vertexRgb6[c]+1)-1)>>6);fragments.push({...f,vertexRgb6,textureRgb6,rgb6});for(let c=0;c<4;c++)current[c]=i64(current[c]+delta[c]);}
 }
 if(cursor!==result.fragments.length)throw Error('RGB fragment count differs');return{...result,clippedRgb6,fragments,opaqueFragments:fragments.filter(f=>f.alpha5===31),transparentFragments:fragments.filter(f=>f.alpha5===0),scope:'Source integer RGB clip/perspective/sample/mode0 only. No fog/translucent shader, framebuffer completeness or live retained texture state claim.'};
}
export function renderStaticMode0Rgb(inventory,referenceDepth){
 if(referenceDepth?.recordKey!==inventory.recordKey||JSON.stringify(referenceDepth.snapshot)!==JSON.stringify(inventory.snapshot)||referenceDepth.stats?.originalPolygons!==inventory.polygons.length||!(referenceDepth.plane?.owner instanceof Int32Array)||referenceDepth.plane.owner.length!==49152)throw Error('Preserved same-frame full eligible depth reference required');
 const participants=[],rows=[];for(const p of inventory.polygons){const row={index:p.index,classification:p.classification,priorRejection:p.binaryRejection,colorRejection:p.colorRejection};rows.push(row);if(!p.colorInput)continue;
  try{const r=rasterizeNativeMode0Rgb(p.args,p.colorInput,{textureScalingFactor:inventory.textureScalingFactor});if(!r.ready)throw Error(r.reason);row.discarded=Boolean(r.discarded);row.culled=Boolean(r.culled);row.fragments=r.fragments.length;participants.push({index:p.index,clipVerticesFx:p.args.clipVerticesFx,frontFacing:Boolean(r.frontFacing),fragments:r.fragments});}catch(e){row.rasterRejection=e.message;}
 }
 const plane=compositeBinaryAwareDepth(participants),rgba6665=new Uint8Array(49152*4),written=new Uint8Array(49152);for(const p of participants)for(const f of p.fragments){const at=f.y*256+f.x;if(f.alpha5===31&&plane.coverage[at]&&plane.owner[at]===p.index&&plane.depth24[at]===f.depth24){if(written[at])throw Error('Repeated winning source polygon fragment unsupported');rgba6665.set([...f.rgb6,31],at*4);written[at]=1;}}
 if(!eq(written,plane.coverage))throw Error('RGB owner coverage differs');
 const subsetRgba6665=rgba6665.slice(),rgbUnavailableMask=new Uint8Array(49152),ownerDifferenceMask=new Uint8Array(49152),availability={referenceCovered:0,subsetCovered:0,available:0,unavailable:0,ownerDifferences:0,depthDifferences:0,subsetMissing:0};
 for(let i=0;i<49152;i++){const ref=referenceDepth.plane;availability.subsetCovered+=Number(Boolean(plane.coverage[i]));if(plane.coverage[i]&&!ref.coverage[i])throw Error('RGB subset claims coverage outside full depth reference');if(!ref.coverage[i])continue;availability.referenceCovered++;const ownerDiff=!plane.coverage[i]||ref.owner[i]!==plane.owner[i],depthDiff=!plane.coverage[i]||ref.depth24[i]!==plane.depth24[i];if(ownerDiff){ownerDifferenceMask[i]=1;availability.ownerDifferences++;}if(depthDiff)availability.depthDifferences++;if(!plane.coverage[i])availability.subsetMissing++;if(ownerDiff||depthDiff){rgbUnavailableMask[i]=1;availability.unavailable++;rgba6665.fill(0,i*4,i*4+4);}else availability.available++;}
 return{ready:true,complete:false,width:256,height:192,snapshot:inventory.snapshot,recordKey:inventory.recordKey,counts:inventory.colorCounts,polygons:rows,unresolved:inventory.unresolved,participants,plane,rgba6665,subsetRgba6665,rgbUnavailableMask,ownerDifferenceMask,availability,scope:'Isolated source-static opaque/binary mode0 subset image. Full depth reference owner is retained: RGB unavailable at an unsupported frontmost owner is masked transparent, never filled with a known background color. Remaining polygons, dynamic models, fog and native final framebuffer remain unresolved.'};
}
/** Explicit diagnostic display only. Native RGB6665 retained independently. */
export function presentStaticRgb(result,{profile}={}){if(!['rgb666-expanded','rgb555-expanded'].includes(profile))throw Error('Explicit display precision profile required');const rgba=new Uint8Array(result.rgba6665.length);for(let i=0;i<rgba.length;i++){const v=result.rgba6665[i];rgba[i]=i%4===3?expand8(v):profile==='rgb666-expanded'?(v<<2)|(v>>>4):expand8(v>>>1);}return{width:result.width,height:result.height,rgba,profile,scope:result.scope};}
