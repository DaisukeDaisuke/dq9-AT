// Missing map/table/area references only. Monster distributions remain the existing enc.json.
export const ENCOUNTER_CONTEXT_PATH='data/prm/encfld.bin';
export function decodeEncounterContexts(calls){
 const groups=[],warnings=[];let group=null,row=null;
 for(const c of calls){const a=c.values;
  if(c.opcode===105){group={mapId:Number(a[0]),condition:a.slice(1),rows:[],source:{path:ENCOUNTER_CONTEXT_PATH,callOffset:c.offset}};groups.push(group);row=null;}
  else if(c.opcode===104&&group){row={tableId:Number(a[0]),flags:null,sourceOffset:c.offset};group.rows.push(row);}
  else if(c.opcode===102&&row)row.flags=Number(a[0])>>>0;
  else if(c.opcode===103){/* Existing enc.json owns monster IDs, weights and ranges. Do not re-mine. */}
  else if(c.opcode!==100&&c.opcode!==101)warnings.push({opcode:c.opcode,offset:c.offset});
 }
 for(const g of groups)for(const r of g.rows)if(r.flags===null)warnings.push({mapId:g.mapId,tableId:r.tableId,error:'Missing table flags; do not select this row'});
 return {format:'dq9-at-encounter-contexts',version:1,source:ENCOUNTER_CONTEXT_PATH,groups,warnings,summary:{maps:new Set(groups.map(g=>g.mapId)).size,groups:groups.length,rows:groups.reduce((n,g)=>n+g.rows.length,0)},distributionSource:'existing web/data/enc.json, unchanged'};
}
export function contextsForMap(contexts,mapId){return contexts.groups.filter(g=>g.mapId===Number(mapId));}
export function contextRows(groups){
 // Conditional story variants stay separate. The inspected JP ROM uses all-zero conditions.
 const unconditional=groups.filter(g=>g.condition.every(x=>x===0));
 return {rows:unconditional.flatMap(g=>g.rows).filter(r=>r.flags!==null),conditional:groups.filter(g=>g.condition.some(x=>x!==0)),resolved:groups.length>0&&unconditional.length===groups.length};
}
