// Prepared renderer packets. Requires caller's actual native material globals.
import {buildNativeTextureMatrix3,transformExplicitTextureCoordinate} from './native/native-texture-matrix.mjs';
import {deriveNativeMaterialResult} from './native/native-material.mjs';
export function prepareDrawPackets(scene,{materialGlobals,masks}){
 if(!materialGlobals||!Array.isArray(masks)||masks.length!==8)throw Error('Native material globals and masks required');
 const draws=[],unsupported=[],hidden=[];
 for(const instance of scene.instances)for(const draw of instance.draws){const key={instanceId:instance.id,shapeIndex:draw.shapeIndex,materialIndex:draw.materialIndex},b=draw.textureBinding;
  if(!b||b.status==='unsupported'){unsupported.push({...key,reason:b?.reason??'Texture resource not supplied'});continue;}
  try{const material=deriveNativeMaterialResult(b.material,materialGlobals,masks);if(material.hideShapes){hidden.push(key);continue;}
   const parameter=(b.material.textureParameter|(b.texture?.parameter??0))>>>0;
   let textureMatrix=null;const transformMode=parameter>>>30;
   if(transformMode===1){if(b.textureMatrixMode!==3)throw Error('Texture matrix convention not integrated: '+b.textureMatrixMode);textureMatrix=buildNativeTextureMatrix3(material);}
   else if(transformMode!==0)throw Error('Normal/vertex texture-coordinate generation not integrated');
   if(draw.normalLightingApplied!==true&&draw.vertices.some(v=>v.normalFx9!==null)&&(material.polygonAttribute&15))throw Error('Native normal/lighting not integrated');
   if(b.status==='bound'&&draw.vertices.some(v=>v.texcoord===null))throw Error('Missing explicit UV state');
   const vertices=draw.indices.flatMap(index=>{const v=draw.vertices[index];if(v.color555===null)throw Error('Missing native color state');return [...v.position,...[0,5,10].map(k=>(v.color555>>k&31)/31),...(textureMatrix?transformExplicitTextureCoordinate(v.texcoord,textureMatrix):(v.texcoord??[0,0]))];});
   draws.push({...key,vertices:new Float32Array(vertices),texture:b.status==='bound'?b.decoded:null,sampler:{repeatS:Boolean(parameter&0x10000),repeatT:Boolean(parameter&0x20000),flipS:Boolean(parameter&0x40000),flipT:Boolean(parameter&0x80000)},polygonAttribute:material.polygonAttribute,alpha:(material.polygonAttribute>>>16&31)/31,polygonMode:material.polygonAttribute>>>4&3,scope:'Preview packet, native raster/sampling/blend/depth/fog parity unverified'});
  }catch(e){unsupported.push({...key,reason:e.message});}
 }
 return {draws,unsupported,hidden};
}
