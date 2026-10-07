import {runSourceStepsSync,runSourceStepsAsync} from '../cooperative-source-work.mjs?v=fair-source-yield-20261007-0247';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * Automatic connection of the already-proven native1x/TexGen0 binary-alpha
 * subset. No map/material-name rules and no changes to the opaque baseline.
 */
import {projectNativePrimitiveFx} from './native-primitive-inputs.mjs';
import {rasterizeNativePositionClippedZPolygon} from './native-position-clip.mjs?v=native-raster-reuse-20261006-0637';
import {readNativeBinaryPolygonTexture,rasterizeNativeBinaryAlphaPolygon,compositeBinaryAwareDepth} from './native-binary-alpha.mjs?v=automatic-playback-source-cache-20261006-1100';
export function* classifyStaticBinaryDepthInputsSteps(project,automatic,opaqueInventory,{viewportWord,depthMode,fragmentSamplingHack,textureScalingFactor}={},sourceCache=null){
 if(automatic.plan.recordKey!==opaqueInventory.recordKey)throw Error('Same source map inventory required');
 if(viewportWord!==0xbfff0000||depthMode!=='Z'||fragmentSamplingHack!==false||textureScalingFactor!==1)throw Error('Explicit native viewport/Z/integer/native1x profile required');
 const archives=new Map(),polygons=[],counts={originalPolygons:opaqueInventory.polygons.length,existingOpaque:0,binaryEligible:0,rejected:0};
 for(const p of opaqueInventory.polygons){yield 'native-source-binary-classification';
  const row={...p,originalRejection:p.rejection,classification:null,binaryRejection:null};
  if(p.eligible){row.classification='opaque';counts.existingOpaque++;polygons.push(row);continue;}
  try{
   const material=p.materialEvidence;if(!material||!Number.isInteger(material.polygonAttribute))throw Error('Effective native material unavailable');
   if((material.polygonAttribute>>>16&31)!==31)throw Error('Polygon alpha below31 or wireframe remains unsupported');
   if((material.polygonAttribute>>>4&3)!==0)throw Error('Polygon mode outside0 remains unsupported');
   if(material.polygonAttribute&0x4000)throw Error('Equal-depth tolerance mode remains unsupported');
   const scene=automatic.scenes[p.sceneIndex];if(!scene||scene.archiveName!==p.archive||scene.streamName!==p.stream)throw Error('Source scene correspondence changed');
   const instance=scene.instances.find(i=>i.id===p.instanceId),draw=instance?.draws.find(d=>d.sbcOffset===p.sbcOffset);if(!draw||instance.modelName!==p.model||draw.materialIndex!==p.materialIndex)throw Error('Source instance/draw correspondence changed');
   if(!archives.has(p.archive))archives.set(p.archive,project.archive(p.archive));const bytes=archives.get(p.archive).get(p.model);
   if(draw.textureBinding?.decoded?.pixels.some((v,i)=>i%4===3&&v!==0&&v!==255))throw Error('Intermediate texture alpha remains unsupported');
   const texture=readNativeBinaryPolygonTexture(bytes,p,draw.textureBinding,{sourceCache}),position=projectNativePrimitiveFx(p.primitive,p.positionMatrixFx,p.projectionFx);
   row.classification='binary';row.textureInput=texture;row.args={clipVerticesFx:position.clipVerticesFx,polygonAttribute:material.polygonAttribute,primitiveMode:p.primitive.primitiveMode,viewportWord,depthMode,fragmentSamplingHack};counts.binaryEligible++;
  }catch(e){row.classification='rejected';row.binaryRejection=e.message;counts.rejected++;}
  polygons.push(row);
 }
 return{recordKey:opaqueInventory.recordKey,snapshot:opaqueInventory.snapshot,counts,polygons,unresolved:opaqueInventory.unresolved.slice(),textureScalingFactor,scope:'Automatic source predicates only. Existing opaque inventory/rejection records are retained; no selector names or manually authored material tables.'};
}
export function* renderClassifiedStaticBinaryDepthSteps(inventory){
 const participants=[],rows=[],stats={...inventory.counts,rasterized:0,culled:0,clippedAway:0,rasterRejected:0,zeroFragmentRasterized:0,opaqueGeometricFragments:0,binaryGeometricFragments:0,binaryOpaqueFragments:0,binaryTransparentFragments:0};
 for(const p of inventory.polygons){yield 'native-depth-polygon';const row={index:p.index,classification:p.classification,originalRejection:p.originalRejection,binaryRejection:p.binaryRejection};rows.push(row);if(p.classification==='rejected')continue;
  try{
   const r=p.classification==='opaque'?rasterizeNativePositionClippedZPolygon(p.args):rasterizeNativeBinaryAlphaPolygon(p.args,p.textureInput,{textureScalingFactor:inventory.textureScalingFactor});if(!r.ready)throw Error(r.reason);
   row.discarded=Boolean(r.discarded);row.culled=Boolean(r.culled);row.outputVertexCount=r.clip.outputVertexCount;row.fragments=r.fragments.length;row.clipIntersections=r.clip.intersections.length;
   if(r.discarded)stats.clippedAway++;else if(r.culled)stats.culled++;else{stats.rasterized++;if(r.fragments.length===0)stats.zeroFragmentRasterized++;}
   const binary=p.classification==='binary',fragments=binary?r.fragments:r.fragments.map(f=>({...f,alpha5:31}));if(binary){stats.binaryGeometricFragments+=r.fragments.length;stats.binaryOpaqueFragments+=r.opaqueFragments.length;stats.binaryTransparentFragments+=r.transparentFragments.length;row.opaqueFragments=r.opaqueFragments.length;row.transparentFragments=r.transparentFragments.length;}else stats.opaqueGeometricFragments+=r.fragments.length;
   participants.push({index:p.index,classification:p.classification,clipVerticesFx:p.args.clipVerticesFx,frontFacing:binary?Boolean(r.frontFacing):r.facing>=0n,fragments});
  }catch(e){row.rasterRejection=e.message;stats.rasterRejected++;}
 }
 const plane=compositeBinaryAwareDepth(participants);
 return{ready:true,complete:stats.rejected===0&&stats.rasterRejected===0&&inventory.unresolved.length===0,recordKey:inventory.recordKey,snapshot:inventory.snapshot,stats,polygons:rows,unresolved:inventory.unresolved,participants,plane,scope:'Only classified static opaque and binary source polygons. Rejections and unknown dynamic counts remain explicit; no native clear/background, RGB/fog/translucency or final framebuffer completeness.'};
}

export function renderClassifiedStaticBinaryDepth(inventory){return runSourceStepsSync(renderClassifiedStaticBinaryDepthSteps(inventory));}
export function renderClassifiedStaticBinaryDepthAsync(inventory,options){return runSourceStepsAsync(renderClassifiedStaticBinaryDepthSteps(inventory),options);}

export function classifyStaticBinaryDepthInputs(project,automatic,opaqueInventory,profile={},sourceCache=null){return runSourceStepsSync(classifyStaticBinaryDepthInputsSteps(project,automatic,opaqueInventory,profile,sourceCache));}
