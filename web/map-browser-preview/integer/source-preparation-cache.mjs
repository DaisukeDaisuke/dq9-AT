/* SPDX-License-Identifier: GPL-2.0-or-later
 * Ephemeral per-preparation cache. No frame, lighting, transform or polygon
 * results persist across jobs. Keys are actual source object identities.
 */
import {readNativeModelInfo} from '../native/native-model-info.mjs';
import {readNativeShapes,decodePackedGx,decodeLocalVertices} from '../native/native-sbc-gx.mjs';
// Ordinary ArrayBuffers are checked byte-for-byte before a hit. Shared or
// resizable sources bypass reuse; no hash or object identity alone proves bytes.
const cacheableBytes=b=>b instanceof Uint8Array&&b.byteLength>0&&b.buffer instanceof ArrayBuffer&&b.buffer.resizable!==true;
const sameBytes=(a,b)=>{if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;};
const MAX_SNAPSHOT_BYTES=8*1024*1024,MAX_SOURCE_OBJECTS=128;
export function createSourcePreparationCache(project){
 const archives=new Map();let models=new WeakMap(),alpha=new WeakMap(),litInstances=new WeakMap(),sourceObjects=0,disposed=false;
 const stats={archiveLoads:0,archiveHits:0,shapeDecodes:0,shapeHits:0,alphaDecodes:0,alphaHits:0,sourceInvalidations:0,cacheBypasses:0,snapshotBytes:0,disposed:false};
 const check=()=>{if(disposed)throw Error('Source preparation cache disposed');};
 const release=entry=>{stats.snapshotBytes-=entry.size;sourceObjects--;stats.sourceInvalidations++;};
 const admit=size=>sourceObjects<MAX_SOURCE_OBJECTS&&stats.snapshotBytes+size<=MAX_SNAPSHOT_BYTES;
 const decodedShape=(bytes,modelIndex,shapeIndex,entry=null)=>{let model=entry?.byModel.get(modelIndex);if(!model){const info=readNativeModelInfo(bytes).models[modelIndex];model={shapes:readNativeShapes(bytes,info),decoded:new Map()};entry?.byModel.set(modelIndex,model);}if(model.decoded.has(shapeIndex)){stats.shapeHits++;return model.decoded.get(shapeIndex);}const shape=model.shapes[shapeIndex];if(!shape)throw Error('Original native shape absent');const gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes),local=decodeLocalVertices(gx.commands),value={shape,gx,local};stats.shapeDecodes++;if(entry)model.decoded.set(shapeIndex,value);return value;};
 return {stats,get litInstances(){check();return litInstances;},project:{...project,archive(name){check();if(archives.has(name)){stats.archiveHits++;return archives.get(name);}stats.archiveLoads++;const value=project.archive(name);archives.set(name,value);return value;}},
 shape(bytes,modelIndex,shapeIndex){check();if(!cacheableBytes(bytes)){const prior=models.get(bytes);if(prior){models.delete(bytes);release(prior);}stats.cacheBypasses++;return decodedShape(bytes,modelIndex,shapeIndex);}let entry=models.get(bytes);if(entry&&!sameBytes(bytes,entry.snapshot)){models.delete(bytes);release(entry);entry=null;}if(!entry){if(!admit(bytes.byteLength)){stats.cacheBypasses++;return decodedShape(bytes,modelIndex,shapeIndex);}entry={snapshot:Uint8Array.from(bytes),byModel:new Map(),size:bytes.byteLength};models.set(bytes,entry);stats.snapshotBytes+=entry.size;sourceObjects++;}return decodedShape(bytes,modelIndex,shapeIndex,entry);},
 alpha(decoded){check();const {width,height,pixels}=decoded;if(!(pixels instanceof Uint8Array)||pixels.length!==width*height*4||width<8||height<8||(width&(width-1))||(height&(height-1)))throw Error('Native decoded power-of-two texture required');
  const stable=cacheableBytes(pixels)&&[['width',width],['height',height],['pixels',pixels]].every(([k,v])=>Object.getOwnPropertyDescriptor(decoded,k)?.value===v);let entry=alpha.get(decoded);
  if(entry&&(!stable||entry.width!==width||entry.height!==height||entry.pixels!==pixels||!sameBytes(pixels,entry.snapshot))){alpha.delete(decoded);release(entry);entry=null;}
  if(entry){stats.alphaHits++;return entry.value;}
  const alpha5=new Uint8Array(width*height),counts={transparent:0,opaque:0};for(let i=0;i<alpha5.length;i++){const a=pixels[4*i+3];if(a!==0&&a!==255)throw Error('Intermediate texture alpha remains unsupported');alpha5[i]=a===255?31:0;counts[a===255?'opaque':'transparent']++;}
  const value={alpha5,counts},size=pixels.byteLength+alpha5.byteLength;stats.alphaDecodes++;
  if(stable&&admit(size)){entry={width,height,pixels,snapshot:Uint8Array.from(pixels),value,size};alpha.set(decoded,entry);stats.snapshotBytes+=size;sourceObjects++;}else stats.cacheBypasses++;return value;
 },
 dispose(){if(disposed)return;disposed=true;archives.clear();models=new WeakMap();alpha=new WeakMap();litInstances=new WeakMap();sourceObjects=0;stats.snapshotBytes=0;stats.disposed=true;}
 };
}
