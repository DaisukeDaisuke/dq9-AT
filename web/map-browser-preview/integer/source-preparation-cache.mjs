/* SPDX-License-Identifier: GPL-2.0-or-later
 * Ephemeral per-preparation cache. No frame, lighting, transform or polygon
 * results persist across jobs. Keys are actual source object identities.
 */
import {readNativeModelInfo} from '../native/native-model-info.mjs';
import {readNativeShapes,decodePackedGx,decodeLocalVertices} from '../native/native-sbc-gx.mjs';
export function createSourcePreparationCache(project){
 const archives=new Map(),models=new WeakMap(),alpha=new WeakMap();
 const stats={archiveLoads:0,archiveHits:0,shapeDecodes:0,shapeHits:0,alphaDecodes:0,alphaHits:0};
 return {stats,litInstances:new WeakMap(),project:{...project,archive(name){if(archives.has(name)){stats.archiveHits++;return archives.get(name);}stats.archiveLoads++;const value=project.archive(name);archives.set(name,value);return value;}},
 shape(bytes,modelIndex,shapeIndex){let byModel=models.get(bytes);if(!byModel){byModel=new Map();models.set(bytes,byModel);}let entry=byModel.get(modelIndex);if(!entry){const model=readNativeModelInfo(bytes).models[modelIndex];entry={shapes:readNativeShapes(bytes,model),decoded:new Map()};byModel.set(modelIndex,entry);}if(entry.decoded.has(shapeIndex)){stats.shapeHits++;return entry.decoded.get(shapeIndex);}const shape=entry.shapes[shapeIndex];if(!shape)throw Error('Original native shape absent');const gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes),local=decodeLocalVertices(gx.commands),value={shape,gx,local};stats.shapeDecodes++;entry.decoded.set(shapeIndex,value);return value;},
 alpha(decoded){let value=alpha.get(decoded);if(value){stats.alphaHits++;return value;}const {width,height,pixels}=decoded;if(!(pixels instanceof Uint8Array)||pixels.length!==width*height*4||width<8||height<8||(width&(width-1))||(height&(height-1)))throw Error('Native decoded power-of-two texture required');const alpha5=new Uint8Array(width*height),counts={transparent:0,opaque:0};for(let i=0;i<alpha5.length;i++){const a=pixels[4*i+3];if(a!==0&&a!==255)throw Error('Intermediate texture alpha remains unsupported');alpha5[i]=a===255?31:0;counts[a===255?'opaque':'transparent']++;}value={alpha5,counts};stats.alphaDecodes++;alpha.set(decoded,value);return value;}
 };
}
