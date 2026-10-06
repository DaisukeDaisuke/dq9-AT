// ROM-only preparation shared with the existing replay factory. No runtime
// packet, reached loader phase, current table, timer, pool or seed is inferred.
import {decodeEncounterStream} from './encounter-distribution.mjs';
import {convertCreatorScale} from './f06-creator.mjs';
const copy=structuredClone;
export function prepareFieldSpawnTables(nitro,mapId){
 if(!Number.isInteger(mapId)||mapId<0||mapId>65535||typeof nitro?.readFile!=='function')throw Error('Source NitroFS and native map ID required');
 const path='data/prm/encfld.bin',bytes=new Uint8Array(nitro.readFile(path)),decoded=decodeEncounterStream(bytes),groups=decoded.groups.filter(g=>g.mapId===mapId).map(g=>copy(g)),ids=new Set(groups.flatMap(g=>g.tableIds));
 const tables=decoded.tables.filter(t=>ids.has(t.tableId)).map(t=>{
  const scaleRows=t.rows.map(row=>{try{return{sourceOffset:row.sourceOffset,scaleArgument:copy(row.scaleArgument),convertedScale:convertCreatorScale(row.scaleArgument),supported:true};}catch(error){return{sourceOffset:row.sourceOffset,scaleArgument:copy(row.scaleArgument),convertedScale:null,supported:false,reason:error.message};}}),scalesReady=scaleRows.every(r=>r.supported);
  return {...copy(t),schedulerRow:{tableId:t.tableId,flags:t.flagsRaw},distribution:{maxRand:t.totalWeight,data:t.rows.map(r=>({monsterId:r.speciesId,start:r.start,end:r.end}))},scaleRows,creatorTable:scalesReady?{id:t.tableId,declaredCount:t.rows.length,items:t.rows.map((r,i)=>({speciesWord:r.packedRaw,scale:scaleRows[i].convertedScale}))}:null};
 });
 return {source:{path,bytes:bytes.length,header:copy(decoded.sourceHeader)},mapId,groups,tables,sourceOnly:true,runtimeInitialized:false,currentGroupSelected:false,currentTableSelected:false,missingRuntimeInputs:['Reached loader/reset and successful allocation branches','Active/story/current field and carried spawn timer','Effective party position/facing/current node and ordered reached clocks','Complete pool occupancy, runtime node flags and time category','Creator allocation/template/serial/terrain bindings','Initial AT state and intervening consumers'],unsupported:groups.length?tables.flatMap(t=>t.scaleRows.filter(r=>!r.supported).map(r=>({tableId:t.tableId,...copy(r)}))):[{reason:'No source encounter group for this map; runtime creation/absence is not established'}],minimumProvenATCalls:0};
}
