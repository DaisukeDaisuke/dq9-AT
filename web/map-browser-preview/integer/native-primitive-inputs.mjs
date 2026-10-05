// Original GX polygon topology for bounded native-depth diagnostics.
// Uses the existing decoder and existing FX32 draw matrices, never triangle packets.
// Primitive ordering follows DeSmuME535f676 gfx3d.cpp:AddCurrentVertexToList.
import {readNativeModelInfo} from '../native/native-model-info.mjs';
import {readNativeShapes,decodePackedGx,decodeLocalVertices} from '../native/native-sbc-gx.mjs';
const fxMatrix=m=>Array.isArray(m)&&m.length===16&&m.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
/** geometry is buildMode2LitGeometry(...).geometry / buildLightingGeometry output.
 * Its full position matrix must be passed through intact, not a float screen matrix.
 */
export function retainNativePrimitiveInputs(modelBytes,geometry,{modelIndex=0}={}){
 const model=readNativeModelInfo(modelBytes).models[modelIndex];if(!model||!geometry||geometry.modelIndex!==modelIndex)throw Error('Matching native model/geometry required');const shapes=readNativeShapes(modelBytes,model),draws=[];
 for(const draw of geometry.draws){if(!fxMatrix(draw.matrix))throw Error('Complete source FX32 position matrix required');const shape=shapes[draw.shapeIndex];if(!shape)throw Error('Source shape absent');const gx=decodePackedGx(modelBytes,shape.displayListOffset,shape.displayListBytes),local=decodeLocalVertices(gx.commands);if(gx.unresolved.length||local.unresolved.length||local.vertices.length!==draw.vertices.length)throw Error('Original GX vertex correspondence unresolved');
  const polygons=[];let open=null;
  for(const b of local.boundaries){if(b.type==='begin'){if(open)throw Error('Nested native primitive');open=b;continue;}if(!open)throw Error('END without native BEGIN');const start=open.vertexIndex,count=b.vertexIndex-start,mode=open.primitive,emit=ids=>polygons.push({primitiveMode:mode,beginCommand:open.command,endCommand:b.command,vertexIndices:ids.map(i=>start+i),vertexCommands:ids.map(i=>local.vertices[start+i].command),localPositionFx:ids.map(i=>local.vertices[start+i].positionFx12.slice())});
   if(mode===0){if(count%3)throw Error('Incomplete native triangles');for(let i=0;i<count;i+=3)emit([i,i+1,i+2]);}
   else if(mode===1){if(count%4)throw Error('Incomplete native quads');for(let i=0;i<count;i+=4)emit([i,i+1,i+2,i+3]);}
   else if(mode===2){if(count<3)throw Error('Incomplete native triangle strip');for(let i=0;i<count-2;i++)emit(i%2?[i+1,i,i+2]:[i,i+1,i+2]);}
   else if(mode===3){if(count<4||count%2)throw Error('Incomplete native quad strip');for(let i=0;i<count-3;i+=2)emit([i,i+1,i+3,i+2]);}
   else throw Error('Unsupported native primitive mode');open=null;
  }if(open)throw Error('Unterminated native primitive');
  draws.push({sbcOffset:draw.sbcOffset,shapeIndex:draw.shapeIndex,materialIndex:draw.materialIndex,positionMatrixFx:draw.matrix.slice(),displayListOffset:shape.displayListOffset,displayListBytes:shape.displayListBytes,polygons});
 }
 return {modelIndex,draws,scope:'Source GX polygon order and local signed FX12 vertices retained before triangle expansion. No native visibility, framebuffer/depth or clipping claim.'};
}
// GPL-2.0-or-later, DeSmuME535f676 matrix.cpp scalar transform saturation.
// Keep the position and projection transformations separate as in gfx3d.cpp:1559.
function transformCoreVertexFx(v,m){
 if(!fxMatrix(m)||!Array.isArray(v)||v.length!==4||v.some(x=>!Number.isInteger(x)||x< -2147483648||x>2147483647))throw Error('Signed FX32 transform inputs required');
 return [0,1,2,3].map(r=>{let n=0n;for(let c=0;c<4;c++)n+=BigInt(m[c*4+r])*BigInt(v[c]);if(n< -(1n<<63n)||n>=(1n<<63n))throw Error('Signed64 overflow outside connected source subset');if(n>0x7ffffffffffn)return 2147483647;if(n< -0x80000000000n)return -2147483648;return Number(n>>12n);});
}
export function projectNativePrimitiveFx(primitive,positionMatrixFx,projectionFx){
 if(!Array.isArray(primitive?.localPositionFx)||![3,4].includes(primitive.localPositionFx.length))throw Error('Preserved original native polygon required');
 const cameraVerticesFx=primitive.localPositionFx.map(v=>{if(v.length!==3)throw Error('Local signed FX12 vertex required');return transformCoreVertexFx([...v,4096],positionMatrixFx);});
 return {cameraVerticesFx,clipVerticesFx:cameraVerticesFx.map(v=>transformCoreVertexFx(v,projectionFx))};
}
