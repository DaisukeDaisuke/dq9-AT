/* SPDX-License-Identifier: GPL-2.0-or-later
 * Isolated static-scene depth subset. Native sort/depth rules derive from
 * DeSmuME535f676 gfx3d.cpp:GFX3D_GenerateRenderLists/gfx3d_ysort_compare and
 * rasterize.cpp:RasterizerUnit::_pixel. Existing ROM, matrix and clip modules
 * are reused. This is not a native framebuffer or a scene completeness claim.
 */
import {makeNativeTrig} from '../native/native-map-records.mjs';
import {buildMode2LitGeometry} from './mode2-lighting-adapter.mjs';
import {retainNativePrimitiveInputs,projectNativePrimitiveFx} from './native-primitive-inputs.mjs';
import {rasterizeNativePositionClippedZPolygon} from './native-position-clip.mjs';
const mul=(a,b)=>Array.from({length:16},(_,k)=>{let v=0n;for(let j=0;j<4;j++)v+=BigInt(a[j*4+k%4])*BigInt(b[(k>>2)*4+j]);return Number(BigInt.asIntN(32,v>>12n));});
/** Native opaque sort uses ORIGINAL pre-clip homogeneous positions, then
 * maximumY, minimumY, and original emission order. No float screen estimates.
 */
export function nativeOpaqueSortBounds(clipVerticesFx){
 const ys=clipVerticesFx.map(v=>{let y=BigInt(v[1]),w=BigInt(v[3]);if(w!==0n)y=(y*4096n+w*4096n)/(2n*w);return 4096n-y;});
 return{minimumY:ys.reduce((a,b)=>a<b?a:b),maximumY:ys.reduce((a,b)=>a>b?a:b)};
}
export function compareNativeOpaqueOrder(a,b){return a.sort.maximumY<b.sort.maximumY?-1:a.sort.maximumY>b.sort.maximumY?1:a.sort.minimumY<b.sort.minimumY?-1:a.sort.minimumY>b.sort.minimumY?1:a.index-b.index;}
/** Both input and destination are proven opaque pixels. Ordinary LESS except
 * front-on-back opaque LEQUAL. The separate POLY_ATTR equal-test bit remains
 * rejected upstream rather than silently treated as this case.
 */
export function testNativeOpaqueDepth(depth24,frontFacing,previousDepth24,previousFrontFacing){
 if(![depth24,previousDepth24].every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffff)||typeof frontFacing!=='boolean'||typeof previousFrontFacing!=='boolean')throw Error('Explicit opaque depth/facing required');
 const comparison=frontFacing&&!previousFrontFacing?'LEQUAL-front-on-back':'LESS';return{pass:comparison==='LESS'?depth24<previousDepth24:depth24<=previousDepth24,comparison,equal:depth24===previousDepth24};
}
/** Rebuild the complete supported static draw inventory from an explicit
 * coherent mode2 bridge input. Preserve rejected instances and every source
 * polygon in the returned inventory; unavailable polygon counts remain null.
 */
export function collectStaticOpaqueDepthInputs(project,automatic,input,{viewportWord,depthMode,fragmentSamplingHack}={},sourceCache=null){
 if(input?.ready!==true||!['current-buffer-default-static-map-flush','ROM-initial-mode2-slot-hypothesis'].includes(input.profile)||automatic.plan.recordKey!==input.record.key)throw Error('Matching explicit current-buffer static map input required');
 if(input.profile==='ROM-initial-mode2-slot-hypothesis'&&(input.hypothesis?.kind!==input.profile||input.hypothesis.recordKey!==input.record.key||input.snapshot?.profile!==input.profile||input.snapshot.timeIndex!==input.hypothesis.timeIndex||input.mode2Evaluation?.selection.index!==input.hypothesis.timeIndex||input.mode2Evaluation.selection.coefficient!==0))throw Error('Initial mode2 source slot/snapshot mismatch');
 if(viewportWord!==0xbfff0000||depthMode!=='Z'||fragmentSamplingHack!==false)throw Error('Explicit full viewport/Z/integer sampling profile required');
 const trig=makeNativeTrig(project.sdk.read(0x020e955c,16384),25736),polygons=[],unresolved=[...automatic.unresolved.map(reason=>({scope:'scene-plan',reason,polygonCount:null}))],counts={sourcePlacements:0,sourceStaticInstances:0,sourceDraws:0,sourcePolygons:0,opaqueEligible:0,rejectedPolygons:0};
 for(const[sceneIndex,scene]of automatic.scenes.entries()){
  counts.sourcePlacements+=scene.placementCount;
  unresolved.push(...scene.unsupported.map(v=>({...v,sceneIndex,scope:'source-instance',polygonCount:null})));
  const members=project.archive(scene.archiveName);
  for(const[instanceOrder,instance]of scene.instances.entries()){
   counts.sourceStaticInstances++;const identity={sceneIndex,instanceOrder,archive:scene.archiveName,stream:scene.streamName,instanceId:instance.id,model:instance.modelName};
   try{
    const bytes=members.get(instance.modelName),{sin,cos}=trig(instance.world.yaw),rotation=[cos,0,-sin,0,0,4096,0,0,sin,0,cos,0,0,0,0,4096],world=rotation.slice();
    for(let c=0;c<3;c++)for(let r=0;r<3;r++)world[c*4+r]=Number(BigInt.asIntN(32,BigInt(rotation[c*4+r])*BigInt(instance.world.scale[c])>>12n));world.splice(12,3,...instance.world.position);
    const lit=buildMode2LitGeometry(bytes,project.sdk,{mode2Evaluation:input.mode2Evaluation,materialGlobals:input.materialGlobals,viewFx:mul(input.viewFx,world),normalViewFx:mul(input.viewFx,rotation),lightMatrixFx:input.lightMatrixFx,retainedLights:input.retainedLights,shininessTable:input.shininessTable}),preserved=retainNativePrimitiveInputs(bytes,lit.geometry),byOffset=new Map(instance.draws.map(d=>[d.sbcOffset,d]));
    if(sourceCache)sourceCache.litInstances.set(instance,{input,bytes,lit,preserved});
    for(const[drawOrder,draw]of preserved.draws.entries()){
     counts.sourceDraws++;const original=byOffset.get(draw.sbcOffset),binding=original?.textureBinding,material=lit.materialResult.materials[draw.materialIndex];let reason=null;
     if(!material)reason='Effective native material missing';
     else if((material.polygonAttribute>>>16&31)!==31)reason='Polygon alpha is not31';
     else if((material.polygonAttribute>>>4&3)!==0)reason='Polygon mode is not0';
     else if(material.polygonAttribute&0x4000)reason='Native tolerance equal-depth mode not connected';
     else if(!binding?.texture||!binding.decoded)reason='Decoded source texture unavailable; opaque texels unproven';
     else if(binding.selectionEvidence?.rule!=='embedded-model-then-reverse-ambl-first-exact16-per-mapping')reason='ROM source texture binding provenance unproven';
     else if((((binding.material.textureParameter|binding.texture.parameter)^binding.texture.parameter)&0x3ff00000)!==0)reason='Effective texture dimensions/format/color0-alpha differ from decoded resource';
     else if(![2,3,4,7].includes(binding.texture.format))reason='Texture format classified outside opaque subset';
     else if(binding.decoded.pixels.some((v,i)=>i%4===3&&v!==255))reason='Texture contains nonopaque texels';
     const materialEvidence={polygonAttribute:material?.polygonAttribute??null,materialTextureParameter:binding?.material?.textureParameter??null,resourceTextureParameter:binding?.texture?.parameter??null,textureFormat:binding?.texture?.format??null,decodedTexels:binding?.decoded?binding.decoded.pixels.length/4:null,nonOpaqueTexels:binding?.decoded?binding.decoded.pixels.reduce((n,v,i)=>n+Number(i%4===3&&v!==255),0):null};
     for(const[polygonIndex,primitive]of draw.polygons.entries()){
      const row={index:polygons.length,...identity,drawOrder,sbcOffset:draw.sbcOffset,shapeIndex:draw.shapeIndex,materialIndex:draw.materialIndex,materialName:binding?.material?.name??null,polygonIndex,primitive,positionMatrixFx:draw.positionMatrixFx.slice(),projectionFx:input.projectionFx.slice(),materialEvidence,eligible:reason===null,rejection:reason};counts.sourcePolygons++;
      if(reason)counts.rejectedPolygons++;
      else{const p=projectNativePrimitiveFx(primitive,draw.positionMatrixFx,input.projectionFx);row.args={clipVerticesFx:p.clipVerticesFx,polygonAttribute:material.polygonAttribute,viewportWord,depthMode,primitiveMode:primitive.primitiveMode,textureFormat:binding.texture.format,textureAllAlpha255:true,fragmentSamplingHack};row.opacityEvidence={decodedTexels:binding.decoded.width*binding.decoded.height,allAlpha255:true,resourceParameter:binding.texture.parameter,materialParameter:binding.material.textureParameter,effectiveParameter:(binding.material.textureParameter|binding.texture.parameter)>>>0,formatDimensionsColor0Mask:0x3ff00000,sourceBinding:binding.selectionEvidence.rule};row.sort=nativeOpaqueSortBounds(p.clipVerticesFx);counts.opaqueEligible++;}
      polygons.push(row);
     }
    }
   }catch(e){unresolved.push({...identity,scope:'instance-depth-reconstruction',reason:e.message,polygonCount:null});}
  }
 }
 return{recordKey:input.record.key,snapshot:input.snapshot,polygons,unresolved,counts,scope:'ROM source stream/placement/SBC/GX order retained; current live visibility and native traversal outside this static reconstruction remain unresolved.'};
}
/** Empty cells have no depth, rather than a fabricated native clear value.
 * First coverage seeds the isolated opaque subset; only subsequent overlaps
 * invoke native opaque depth tests. No renderer clear/background is simulated.
 */
export function compositeStaticOpaqueDepth(inventory){
 const coverage=new Uint8Array(49152),depth24=new Uint32Array(49152),frontFacing=new Uint8Array(49152),owner=new Int32Array(49152),rows=inventory.polygons.map(p=>({index:p.index,eligible:p.eligible,rejection:p.rejection})),stats={...inventory.counts,rasterizedPolygons:0,culledPolygons:0,clippedAwayPolygons:0,rasterRejectedPolygons:0,incomingFragments:0,firstCoverage:0,overlapTests:0,passedOverlaps:0,rejectedOverlaps:0,equalOverlapTests:0,equalAccepted:0,equalRejected:0,lequalTests:0},overlapExamples={first:null,firstPassed:null,firstEqual:null,firstLequal:null};
 owner.fill(-1);const rowByIndex=new Map(rows.map(r=>[r.index,r]));const sorted=inventory.polygons.filter(p=>p.eligible).sort(compareNativeOpaqueOrder);
 for(const p of sorted){const row=rowByIndex.get(p.index);let raster;try{raster=rasterizeNativePositionClippedZPolygon(p.args);if(!raster.ready)throw Error(raster.reason);}catch(e){row.rasterRejection=e.message;stats.rasterRejectedPolygons++;continue;}
  row.outputVertexCount=raster.clip.outputVertexCount;row.intersections=raster.clip.intersections.length;row.culled=Boolean(raster.culled);row.discarded=raster.discarded;row.fragments=raster.fragments.length;
  if(raster.discarded){stats.clippedAwayPolygons++;continue;}if(raster.culled){stats.culledPolygons++;continue;}stats.rasterizedPolygons++;const front=raster.facing>=0n;row.frontFacing=front;
  for(const f of raster.fragments){stats.incomingFragments++;const offset=f.y*256+f.x;let pass=true;if(coverage[offset]){
    const test=testNativeOpaqueDepth(f.depth24,front,depth24[offset],Boolean(frontFacing[offset])),event={x:f.x,y:f.y,incomingIndex:p.index,previousIndex:owner[offset],incomingDepth24:f.depth24,previousDepth24:depth24[offset],incomingFrontFacing:front,previousFrontFacing:Boolean(frontFacing[offset]),...test};stats.overlapTests++;if(test.pass)stats.passedOverlaps++;else stats.rejectedOverlaps++;if(test.equal){stats.equalOverlapTests++;if(test.pass)stats.equalAccepted++;else stats.equalRejected++;}if(test.comparison==='LEQUAL-front-on-back')stats.lequalTests++;if(!overlapExamples.first)overlapExamples.first=event;if(test.pass&&!overlapExamples.firstPassed)overlapExamples.firstPassed=event;if(test.equal&&!overlapExamples.firstEqual)overlapExamples.firstEqual=event;if(test.comparison==='LEQUAL-front-on-back'&&!overlapExamples.firstLequal)overlapExamples.firstLequal=event;pass=test.pass;
   }else stats.firstCoverage++;
   if(pass){coverage[offset]=1;depth24[offset]=f.depth24;frontFacing[offset]=Number(front);owner[offset]=p.index;}
  }
 }
 return{ready:true,complete:inventory.unresolved.length===0&&stats.rejectedPolygons===0&&stats.rasterRejectedPolygons===0,width:256,height:192,coverage,depth24,frontFacing,owner,stats,polygons:rows,sortOrder:sorted.map(p=>p.index),overlapExamples,unresolved:inventory.unresolved,scope:'Isolated source-static opaque coverage/depth. Empty cells are unknown, not native clear depth. No native framebuffer, omitted polygon success, texture/color interpolation, dynamic objects, fog or full-scene acceptance.'};
}
