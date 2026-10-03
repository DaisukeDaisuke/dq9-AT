// Exact authored name bindings only. The caller selects the actual texture resource.
import {readNativeModelInfo} from './native/native-model-info.mjs';
import {readNativeMaterials} from './native/native-material.mjs';
import {readNativeTextureResource} from './native/native-tex0.mjs';
import {unpackNativeTexture} from './native/native-texture-unpack.mjs';
export function bindStaticTextures(modelBytes,textureBytes,{modelIndex=0}={}){
 const model=readNativeModelInfo(modelBytes).models[modelIndex];if(!model)throw Error('Missing model');const materials=readNativeMaterials(modelBytes,model),resource=readNativeTextureResource(textureBytes),cache=new Map();
 const authored=(rows,id)=>rows?.filter(r=>r.materialIndices.includes(id))??[];
 const exact=(rows,name)=>{const matches=rows.filter(r=>r.nameHex===name);if(matches.length!==1)throw Error('No unique exact resource name');return matches[0];};
 return materials.materials.map((material,id)=>{try{
  const names=authored(materials.textureMappings?.rows,id),pnames=authored(materials.paletteMappings?.rows,id);
  if(names.length===0)return {materialIndex:id,status:'untextured',material};if(names.length!==1)throw Error('Ambiguous authored texture binding');
  const texture=exact(resource.textures,names[0].nameHex);let palette=null;
  if(texture.format!==7){if(pnames.length!==1)throw Error('Missing or ambiguous authored palette binding');palette=exact(resource.palettes,pnames[0].nameHex);}
  const key=texture.nameHex+':'+(palette?.nameHex??'direct');if(!cache.has(key))cache.set(key,unpackNativeTexture(textureBytes,resource,texture,palette,'8888'));
  return {materialIndex:id,status:'bound',material,texture,palette,decoded:cache.get(key),limitations:material.textureSrt?['Texture matrix not yet integrated']:[]};
 }catch(e){return {materialIndex:id,status:'unsupported',reason:e.message,material};}});
}
