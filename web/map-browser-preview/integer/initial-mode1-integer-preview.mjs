import {runSourceStepsSync} from '../cooperative-source-work.mjs?v=native-body-20261006-0212';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * ROM-initial mode1 adapter into the existing DeSmuME535f676-derived integer
 * polygon components. Those components retain their source/license notices.
 * No captured environment, Float64 position/color inversion, or live defaults.
 */
import {buildCameraGeometry} from '../camera-geometry.mjs';
import {makeNativeTrig} from '../native/native-map-records.mjs';
import {readNativeModelInfo} from '../native/native-model-info.mjs';
import {decodeNativeSbc,readNativeShapes,decodePackedGx,decodeLocalVertices} from '../native/native-sbc-gx.mjs';
import {deriveNativeMaterialResult} from '../native/native-material.mjs';
import {isSupportedMode1ColorEnvironment,replayZeroLightShapeColors,transformNativeEnvironmentColor555} from '../automatic-material-environment.mjs?v=native-body-20261006-0212';
import {readArm9Overlay} from '../rom-overlay.mjs';
import {retainNativePrimitiveInputs,projectNativePrimitiveFx} from './native-primitive-inputs.mjs';
import {readNativeBinaryPolygonTexture} from './native-binary-alpha.mjs?v=destination-reuse-20261006-0501';
import {renderClassifiedStaticBinaryDepthSteps} from './static-binary-depth.mjs?v=destination-reuse-20261006-0501';
import {renderStaticMode0RgbSteps,presentStaticRgb} from './static-mode0-rgb.mjs?v=destination-reuse-20261006-0501';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fx=m=>Array.isArray(m)&&m.length===16&&m.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
const i32=n=>Number(BigInt.asIntN(32,n));
const multiply=(a,b)=>Array.from({length:16},(_,k)=>{let n=0n;for(let j=0;j<4;j++)n+=BigInt(a[j*4+k%4])*BigInt(b[(k>>2)*4+j]);return i32(n>>12n);});
/** Initial SDK viewport and the mode of a submitted normal field pass.
 * The integer/native1x settings select this diagnostic component, not a claim
 * about emulator configuration or the game's current retained GPU state.
 */
export function readInitialMode1RasterProfile(project,rom){
 const word=(source,a)=>{const b=source.read(a,4);return new DataView(b.buffer,b.byteOffset,b.length).getUint32(0,true);},expect=(source,a,value)=>{if(word(source,a)!==value)throw Error('Initial raster source differs at '+a.toString(16));};
 expect(project.sdk,0x020b51e0,0xe59f30dc);expect(project.sdk,0x020b5214,0xe2432809);expect(project.sdk,0x020b521c,0xe58120a0);
 const viewportWord=(word(project.sdk,0x020b52c4)-0x90000)>>>0;
 const overlay=readArm9Overlay(rom,17);expect(overlay,0x0218d398,0xe3a00001);expect(overlay,0x0218d39c,0xe3a01000);expect(overlay,0x0218d3a0,0xebfd3323);expect(project.sdk,0x020da060,0x04000540);
 if(viewportWord!==0xbfff0000)throw Error('Initial SDK viewport outside connected full-screen path');
 return{viewportWord,depthMode:'Z',fragmentSamplingHack:false,textureScalingFactor:1,source:{viewportInitializer:0x020b521c,viewportLiteral:0x020b52c4,fieldSwapCall:0x0218d3a0,swapWriter:0x020da034},scope:'ROM initial viewport and source Z mode when the normal field pass submits. Native1x/integer sampling is an explicit component profile; no current pass/skip flag or retained GPU state is inferred.'};
}
function worldMatrix(world,trig){
 const {sin,cos}=trig(world.yaw),[x,y,z]=world.scale,product=(a,b)=>i32(BigInt(a)*BigInt(b)>>12n);
 return [product(cos,x),0,product(-sin,x),0,0,y,0,0,product(sin,z),0,product(cos,z),0,...world.position,4096];
}
function nativeRgba6665(decoded){
 const alphabet=new Map(Array.from({length:32},(_,n)=>[(n<<3)|(n>>>2),n===0?0:2*n+1])),out=new Uint8Array(decoded.pixels.length);
 for(let i=0;i<out.length;i++){const value=decoded.pixels[i];if(i%4===3){if(value!==0&&value!==255)throw Error('Intermediate texture alpha remains unsupported');out[i]=value===255?31:0;}else{const channel=alphabet.get(value);if(channel===undefined)throw Error('ROM texture is outside exact native RGB555 expansion alphabet');out[i]=channel;}}
 return out;
}
// Independently match each supplied color to the existing source event replay.
// This checks command/index order; matching vertex counts alone is insufficient.
function verifySourceColors(bytes,model,sbc,instance,sourceModel,environment,masks){
 if(!sourceModel?.nativeBranch.startsWith('static-model'))throw Error('Static source model color branch required');
 const shapes=readNativeShapes(bytes,model),byOffset=new Map(instance.draws.map(d=>[d.sbcOffset,d])),bindings=new Map(instance.draws.map(d=>[d.materialIndex,d.textureBinding])),proof=new Map();let color=null,material=null,visible=true;
 for(const c of sbc.commands){if(c.opcode===1)break;if(c.opcode===2)visible=c.nodeVisibility.visible;
  if(c.opcode===4){const b=bindings.get(c.materialIndex);material=b?deriveNativeMaterialResult(b.material,environment.materialGlobals,masks):null;if(material?.diffuseAmbient&0x8000)color=material.diffuseAmbient&32767;}
  if(c.opcode!==5||!visible)continue;const draw=byOffset.get(c.offset),shape=shapes[c.shape.index];if(!draw||!shape||!material)throw Error('Source color replay draw/material missing');
  const gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes),local=decodeLocalVertices(gx.commands);if(gx.unresolved.length||local.unresolved.length||local.vertices.length!==draw.vertices.length)throw Error('Source color vertex correspondence unresolved');
  const flags=new DataView(bytes.buffer,bytes.byteOffset,bytes.length).getUint32(shape.offset+4,true),t=environment.tintRules,enabled=t.initialLoadGate<0&&!(sourceModel.nativeFlags&t.modelSkipMask)&&Boolean(flags&t.shapeRequiredMask),replay=replayZeroLightShapeColors(gx,material,color,{transformColor:enabled?(rgb=>transformNativeEnvironmentColor555(rgb,environment.staticColorRecord,t)):null});color=replay.finalColor;
  for(let i=0;i<local.vertices.length;i++){const v=local.vertices[i],provided=draw.vertices[i];if(provided.color555!==replay.atCommand.get(v.command)||!eq(provided.normalFx9,v.normalFx9)||!eq(provided.texcoord,v.texcoordFx4?.map(x=>x/16)??null))throw Error('Source COLOR/NORMAL/UV command-index correspondence differs');}
  proof.set(c.offset,local.vertices.map(v=>v.command));
 }
 if(proof.size!==instance.draws.length)throw Error('Source color draw order/count differs');return proof;
}
/** Takes exactly the output of loadAutomaticScene -> automaticBillboardScenes
 * -> applyAutomaticMaterialEnvironment, with its calculated initial FX camera.
 * Non-BB draw.matrix is node-local in the old preview: replay source operations
 * with view*world as the initial matrix instead of treating it as camera-space.
 * BB/BBY draw.matrix is already the emitted source callback/stack result.
 * Explicit raster profile selects the same bounded component as prior probes;
 * it does not assert a running game's retained viewport/swap/hack settings.
 */
export function* collectInitialMode1IntegerInputsSteps(project,record,automatic,camera,{viewportWord,depthMode,fragmentSamplingHack,textureScalingFactor}={}){
 if(automatic?.plan?.recordKey!==record?.key||automatic.environmentApplied!==true||automatic.environment?.profile!=='ROM-initial-ordinary-environment'||!isSupportedMode1ColorEnvironment(automatic.environment,record.key))throw Error('Source-proven matching time-independent initial mode1 environment required');
 if(automatic.environment.normalLighting?.kind!=='source-zero-light-colors'||automatic.environment.normalLighting.lightColorWords.some((x,i)=>x!==(i<<30)>>>0))throw Error('Source mode1 zero-light proof required');
 if(!fx(camera?.viewFx)||!fx(camera?.projectionFx))throw Error('Calculated source FX32 initial camera required');
 if(viewportWord!==0xbfff0000||depthMode!=='Z'||fragmentSamplingHack!==false||textureScalingFactor!==1)throw Error('Explicit full native viewport/Z/integer/native1x diagnostic profile required');
 const trig=makeNativeTrig(project.sdk.read(0x020e955c,16384),25736),pivot=project.sdk.read(0x020e936c,36),polygons=[],unresolved=automatic.unresolved.map(reason=>({scope:'scene-plan',reason,polygonCount:null})),textureCache=new Map();
 const counts={originalPolygons:0,existingOpaque:0,binaryEligible:0,rejected:0},colorCounts={sourcePolygons:0,priorEligible:0,priorRejected:0,colorEligible:0,colorRejected:0},geometryCounts={sourcePlacements:0,sourceStaticInstances:0,sourceDraws:0,billboardInstances:0,replayedNonBillboardInstances:0};
 const snapshot={profile:automatic.environment.discreteOrdinaryHypothesis?'ROM-initial-discrete-ordinary-mode1':'ROM-initial-time-independent-mode1',recordKey:record.key,viewFx:camera.viewFx.slice(),projectionFx:camera.projectionFx.slice()},profile={viewportWord,depthMode,fragmentSamplingHack,textureScalingFactor};
 for(const [sceneIndex,scene] of automatic.scenes.entries()){
  if(scene.coordinateSpace!=='camera')throw Error('automaticBillboardScenes camera-space result required');
  geometryCounts.sourcePlacements+=scene.placementCount;
  unresolved.push(...scene.unsupported.map(value=>({...value,sceneIndex,scope:'source-instance',polygonCount:null})));
  const members=project.archive(scene.archiveName),instances=new Map(scene.instances.map(instance=>[instance.id,instance]));
  // Source placement order, rather than the presentation array's BB append order.
  for(const [instanceOrder,placement] of scene.sourcePlacements.entries()){yield 'native-source-instance';
   const instance=instances.get(placement.id);if(!instance)continue;geometryCounts.sourceStaticInstances++;
   const identity={sceneIndex,instanceOrder,archive:scene.archiveName,stream:scene.streamName,instanceId:instance.id,model:instance.modelName};
   try{
    const bytes=members.get(instance.modelName),model=readNativeModelInfo(bytes).models[0],sbc=decodeNativeSbc(bytes,model);if(sbc.unresolved.length||!sbc.terminated)throw Error('Original native SBC unresolved');
    const commandProof=verifySourceColors(bytes,model,sbc,instance,scene.sourceModels.find(m=>m.id===placement.modelId),automatic.environment,automatic.masks);
    const billboard=sbc.commands.some(c=>c.opcode===7||c.opcode===8);
    let geometry;
    if(billboard){geometry={modelIndex:0,draws:instance.draws};geometryCounts.billboardInstances++;}
    else{geometry=buildCameraGeometry(bytes,pivot,{viewFx:multiply(camera.viewFx,worldMatrix(instance.world,trig))});geometryCounts.replayedNonBillboardInstances++;}
    const preserved=retainNativePrimitiveInputs(bytes,geometry),sourceByOffset=new Map(instance.draws.map(d=>[d.sbcOffset,d]));
    if(preserved.draws.length!==instance.draws.length)throw Error('Source draw count differs');
    for(const [drawOrder,draw] of preserved.draws.entries()){
     geometryCounts.sourceDraws++;const source=sourceByOffset.get(draw.sbcOffset),binding=source?.textureBinding;
     if(!source||source.materialIndex!==draw.materialIndex||source.shapeIndex!==draw.shapeIndex)throw Error('Source mode1 draw correspondence differs');
     const material=binding?.material?deriveNativeMaterialResult(binding.material,automatic.environment.materialGlobals,automatic.masks):null;
     const materialEvidence={polygonAttribute:material?.polygonAttribute??null,materialTextureParameter:binding?.material?.textureParameter??null,resourceTextureParameter:binding?.texture?.parameter??null,textureFormat:binding?.texture?.format??null};
     let rejection=null,allOpaque=false;
     if(!material)rejection='Effective source material unavailable';
     else if(material.hideShapes)rejection='Native material hides this source shape';
     else if((material.polygonAttribute>>>16&31)!==31)rejection='Polygon alpha below31 or wireframe remains unsupported';
     else if((material.polygonAttribute>>>4&3)!==0)rejection='Polygon mode outside0 remains unsupported';
     else if(material.polygonAttribute&0x4000)rejection='Equal-depth tolerance mode remains unsupported';
     else if(binding?.status!=='bound'||binding.selectionEvidence?.rule!=='embedded-model-then-reverse-ambl-first-exact16-per-mapping'||!binding.decoded)rejection='Exact ROM decoded texture binding required';
     else if((((binding.material.textureParameter|binding.texture.parameter)^binding.texture.parameter)&0x3ff00000)!==0)rejection='Effective texture dimensions/format/color0 alpha differ from decoded resource';
     else if(![2,3,4,7].includes(binding.texture.format))rejection='Texture format outside connected opaque/binary path';
     else if(binding.decoded.pixels.some((v,i)=>i%4===3&&v!==0&&v!==255))rejection='Intermediate texture alpha remains unsupported';
     else allOpaque=!binding.decoded.pixels.some((v,i)=>i%4===3&&v!==255);
     for(const [polygonIndex,primitive] of draw.polygons.entries()){yield 'native-source-polygon';
      const row={index:polygons.length,...identity,drawOrder,sbcOffset:draw.sbcOffset,shapeIndex:draw.shapeIndex,materialIndex:draw.materialIndex,materialName:binding?.material?.name??null,polygonIndex,primitive,positionMatrixFx:draw.positionMatrixFx.slice(),projectionFx:camera.projectionFx.slice(),materialEvidence,classification:'rejected',originalRejection:rejection,binaryRejection:rejection,colorInput:null,colorRejection:null};
      polygons.push(row);if(rejection)continue;
      try{
       const position=projectNativePrimitiveFx(primitive,row.positionMatrixFx,row.projectionFx);
       row.args={clipVerticesFx:position.clipVerticesFx,polygonAttribute:material.polygonAttribute,primitiveMode:primitive.primitiveMode,viewportWord,depthMode,fragmentSamplingHack};
       if(allOpaque){row.classification='opaque';Object.assign(row.args,{textureFormat:binding.texture.format,textureAllAlpha255:true});}
       else{row.textureInput=readNativeBinaryPolygonTexture(bytes,row,binding);row.classification='binary';}
       try{
        if(!primitive.vertexIndices.every((index,k)=>commandProof.get(draw.sbcOffset)[index]===primitive.vertexCommands[k]))throw Error('Original polygon GX command/index correspondence differs');
        const rgb555=primitive.vertexIndices.map(i=>source.vertices[i]?.color555);
        if(rgb555.some(x=>!Number.isInteger(x)||x<0||x>32767))throw Error('Source event-ordered RGB555 unavailable');
        const texture=row.textureInput??readNativeBinaryPolygonTexture(bytes,row,binding);
        if(!textureCache.has(binding.decoded))textureCache.set(binding.decoded,nativeRgba6665(binding.decoded));
        row.colorInput={rgb555,texture:{...texture,rgba6665:textureCache.get(binding.decoded)},source:{rule:automatic.environment.discreteOrdinaryHypothesis?'initial-mode1-discrete-source-GX-COLOR-NORMAL-tint':'initial-mode1-time-independent-source-GX-COLOR-NORMAL-tint',sbcOffset:draw.sbcOffset,shapeIndex:draw.shapeIndex,vertexCommands:primitive.vertexCommands.slice(),normalLightingApplied:source.normalLightingApplied===true,positionMatrix:billboard?'source-emitted-BB/BBY-matrix':'source-view-world-node-replay'}};
       }catch(e){row.colorRejection=e.message;}
      }catch(e){row.classification='rejected';row.binaryRejection=e.message;}
     }
    }
   }catch(e){unresolved.push({...identity,scope:'initial-mode1-primitive-connection',reason:e.message,polygonCount:null});}
  }
 }
 counts.originalPolygons=polygons.length;colorCounts.sourcePolygons=polygons.length;
 for(const p of polygons){if(p.classification==='rejected'){counts.rejected++;colorCounts.priorRejected++;}else{counts[p.classification==='opaque'?'existingOpaque':'binaryEligible']++;colorCounts.priorEligible++;colorCounts[p.colorInput?'colorEligible':'colorRejected']++;}}
 return{recordKey:record.key,snapshot,polygons,unresolved,counts,colorCounts,geometryCounts,textureScalingFactor,rasterProfile:profile,environmentEvidence:{source:automatic.environment.source,ordinaryTimeIndependent:automatic.environment.ordinaryTimeIndependent,discreteOrdinaryHypothesis:automatic.environment.discreteOrdinaryHypothesis??null,normalLighting:automatic.environment.normalLighting,materialGlobals:automatic.environment.materialGlobals,colorTransformIdentity:automatic.environment.colorTransformIdentity,normalDraws:automatic.environmentNormalDraws,colorDraws:automatic.environmentColorDraws},scope:'Initial ROM mode1 default static pose at caller-selected geometric floor/heading. Integer source original polygons and event-ordered RGB; retained live visibility, dynamic models, fog, translucent paths and native framebuffer acceptance are unresolved.'};
}
export function* renderInitialMode1IntegerPreviewSteps(project,record,automatic,camera,profile){
 const inventory=yield*collectInitialMode1IntegerInputsSteps(project,record,automatic,camera,profile),depth=yield*renderClassifiedStaticBinaryDepthSteps(inventory),rgb=yield*renderStaticMode0RgbSteps(inventory,depth);
 return{ready:true,complete:false,inventory,depth,rgb,present(options){return presentStaticRgb(rgb,options);}};
}

export function collectInitialMode1IntegerInputs(project,record,automatic,camera,profile={}){return runSourceStepsSync(collectInitialMode1IntegerInputsSteps(project,record,automatic,camera,profile));}
export function renderInitialMode1IntegerPreview(project,record,automatic,camera,profile){return runSourceStepsSync(renderInitialMode1IntegerPreviewSteps(project,record,automatic,camera,profile));}
