// Preserve the enc.json species -> map/group/table relation. Model aliases are
// appearances, not a Cartesian product with every encounter row for that model.
const copy=x=>structuredClone(x),validId=x=>Number.isInteger(x)&&x>=0&&x<=65535;
const originKey=o=>JSON.stringify([o.mapId,o.groupIndex,o.tableId,o.tableFlags,o.condition,o.trapRuleUnresolved,o.tableRowIndex??null,o.entryIndex??null]);
export function encounterModelCandidates(plan,modelId,{mapId=null,speciesCandidates=null}={}){
 const models=(plan?.models??[]).filter(m=>m.modelId===modelId),model=models.length===1?models[0]:null;
 const aliases=model?.speciesCandidates??[],allowed=new Set((speciesCandidates??aliases).map(a=>a.monsterId).filter(validId)),aliasIds=new Set(aliases.map(a=>a.monsterId).filter(validId));
 const origins=[],unresolvedOrigins=[],pairs=new Map(),seen=new Set();
 for(const origin of model?.origins??[]){
  if(mapId!==null&&origin.mapId!==mapId)continue;
  if(!validId(origin.mapId)||!validId(origin.tableId)){unresolvedOrigins.push(copy(origin));continue;}
  // Saved v1 plans retain the exact relationship under plan.species[].origins.
  // Missing legacy joins stay unknown; matchedSpeciesIds alone cannot recover
  // which alias belonged to which map, conditional group or area/time row.
  const ids=Object.hasOwn(origin,'monsterId')?[origin.monsterId]:(plan?.species??[]).filter(s=>(s.origins??[]).some(o=>originKey(o)===originKey(origin))).map(s=>s.monsterId);
  const joined=ids.filter(id=>validId(id)&&aliasIds.has(id));
  if(!joined.length){unresolvedOrigins.push(copy(origin));continue;}
  for(const monsterId of joined){if(!allowed.has(monsterId))continue;
   const row={...copy(origin),monsterId},key=JSON.stringify([originKey(row),monsterId]);
   if(!seen.has(key)){seen.add(key);origins.push(row);}
   pairs.set(`${origin.tableId}/${monsterId}`,{tableId:origin.tableId,monsterId});
  }
 }
 const ids=new Set(origins.map(o=>o.monsterId));
 return{schema:'conditional-encounter-model-candidates-v1',modelId,mapId,speciesCandidates:copy(aliases.filter(a=>ids.has(a.monsterId))),tableSpeciesAlternatives:[...pairs.values()].sort((a,b)=>a.tableId-b.tableId||a.monsterId-b.monsterId),origins,unresolvedOrigins,modelAliases:copy(aliases),otherSpawnRoutesUnknown:true,timeAndAreaKnown:false,identityCertified:false,noEventPossible:true,minimumProvenATCalls:0};
}
