// ROM-only default-material binding. FUN02014228 prepends AMBL textures;
// FUN02014b4c traverses that list. SDK020b4c50/020b4ebc bind each exact
// 16-byte name only while its mapping's boundFlags bit0 is clear.
// Model-local TEX0 is bound first by FUN0207f1cc -> SDK020b5048.
import {fxDiv} from './native/native-camera-fx.mjs';
import {readNativeModelInfo} from './native/native-model-info.mjs';
import {readNativeMaterials} from './native/native-material.mjs';
import {readNativeTextureResource} from './native/native-tex0.mjs';
import {unpackNativeTexture} from './native/native-texture-unpack.mjs';

export function bindAutomaticTextures(modelBytes,orderedExternalResources,{modelIndex=0}={}){
 if(!Array.isArray(orderedExternalResources))throw Error('AMBL-ordered external texture resources required');
 const model=readNativeModelInfo(modelBytes).models[modelIndex];if(!model)throw Error('Missing model');
 const materials=readNativeMaterials(modelBytes,model),sources=[],cache=new Map();
 const addSource=(bytes,source)=>{const resource=readNativeTextureResource(bytes);if(resource.textureSection)sources.push({bytes,resource,source});};
 addSource(modelBytes,{kind:'embedded-model',name:null,externalIndex:null});
 for(let i=orderedExternalResources.length-1;i>=0;i--){
  const input=orderedExternalResources[i];
  if(!input||typeof input.name!=='string'||!input.name.length||!(input.bytes instanceof Uint8Array))throw Error('Each external resource requires a name and Uint8Array bytes');
  addSource(input.bytes,{kind:'ambl-member',name:input.name,externalIndex:i});
 }
 const authored=(rows,id)=>rows?.filter(row=>row.materialIndices.includes(id))??[];
 const resolve=(kind,mapping)=>{
  if(mapping.boundFlags&1)throw Error('Initial '+kind+' mapping is already bound; source provenance unresolved');
  for(let order=0;order<sources.length;order++){
   const source=sources[order],matches=source.resource[kind==='texture'?'textures':'palettes'].filter(row=>row.nameHex===mapping.nameHex);
   if(!matches.length)continue;
   if(matches.length!==1)throw Error('Ambiguous exact '+kind+' name inside resource');
   const entry=matches[0];return {source,entry,evidence:{...source.source,bindingOrder:order,nameHex:mapping.nameHex,entryIndex:entry.index}};
  }
  throw Error('No exact '+kind+' resource name in native binding order');
 };
 return materials.materials.map((material,id)=>{
  const evidence={rule:'embedded-model-then-reverse-ambl-first-exact16-per-mapping',texture:null,palette:null};
  try{
   const names=authored(materials.textureMappings?.rows,id),pnames=authored(materials.paletteMappings?.rows,id);
   if(!names.length)return {textureMatrixMode:model.rawInfo14[2],materialIndex:id,status:'untextured',material,selectionEvidence:evidence};
   if(names.length!==1)throw Error('Ambiguous authored texture binding');
   const selectedTexture=resolve('texture',names[0]);evidence.texture=selectedTexture.evidence;
   const texture=selectedTexture.entry;let selectedPalette=null,palette=null;
   if(texture.format!==7){
    if(pnames.length!==1)throw Error('Missing or ambiguous authored palette binding');
    selectedPalette=resolve('palette',pnames[0]);palette=selectedPalette.entry;evidence.palette=selectedPalette.evidence;
   }
   const key=selectedTexture.evidence.bindingOrder+':'+texture.nameHex+':'+(selectedPalette?selectedPalette.evidence.bindingOrder+':'+palette.nameHex:'direct');
   if(!cache.has(key))cache.set(key,unpackNativeTexture(selectedTexture.source.bytes,selectedTexture.source.resource,texture,palette,'8888',selectedPalette?{paletteBytes:selectedPalette.source.bytes,paletteResource:selectedPalette.source.resource}:{}));
   const sourceWidth=texture.extraParameter&0x7ff,sourceHeight=(texture.extraParameter>>>11)&0x7ff;
   const boundMaterial={...material,bindingScaleS:sourceWidth===material.originalWidth?4096:fxDiv(sourceWidth*4096,material.originalWidth*4096),bindingScaleT:sourceHeight===material.originalHeight?4096:fxDiv(sourceHeight*4096,material.originalHeight*4096)};
   return {textureMatrixMode:model.rawInfo14[2],materialIndex:id,status:'bound',material:boundMaterial,texture,palette,decoded:cache.get(key),limitations:material.textureSrt?['Texture matrix not yet integrated']:[],selectionEvidence:evidence};
  }catch(error){
   // SDK020b4c50 leaves this material untouched when every name lookup misses;
   // model caller0207f80c ignores the combined bind return. Format0 remains
   // explicitly untextured, not a fabricated replacement texture.
   if(error.message==='No exact texture resource name in native binding order'&&((material.textureParameter>>>26)&7)===0)return {textureMatrixMode:model.rawInfo14[2],materialIndex:id,status:'untextured',material,selectionEvidence:evidence,nativeBindingFailure:error.message};
   return {textureMatrixMode:model.rawInfo14[2],materialIndex:id,status:'unsupported',reason:error.message,material,selectionEvidence:evidence};}
 });
}
