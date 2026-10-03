// Static source-name associations for choosing preview inputs, not runtime loading proof.
export function previewBindingsFromSavedMetadata(metadata,placementMembers){
 if(metadata.format!=='dq9-at-map-metadata'||!Array.isArray(metadata.records)||!Array.isArray(metadata.descriptors))throw Error('Existing mined metadata required');
 const descriptors=new Map(metadata.descriptors.map(d=>[d.path,d])),byName=new Map();
 for(const m of placementMembers){const key=m.member.toUpperCase();if(!byName.has(key))byName.set(key,[]);byName.get(key).push(m);}
 return metadata.records.map(record=>{const model=record.modelResource;if(model!==null&&typeof model!=='string')throw Error('Invalid saved model resource');const requested=model?model+'.bmdj':null,matches=requested?byName.get(requested.toUpperCase())??[]:[];const maps=(record.candidates??[]).map(c=>({...c,descriptorPresent:descriptors.has(c.path)}));
 return {mapId:record.mapId,source:record.source,fullFieldCode:record.fieldCode,modelResource:model,requestedPlacementMember:requested,placementCandidates:matches,minimapCandidates:maps,status:matches.length===1&&maps.length===1&&maps[0].descriptorPresent?'unique-static-candidate':'unresolved-or-ambiguous',scope:'Source-name preview candidates only. Native resource selection, variant flags, camera overrides, texture binding and ground remain separate.'};});
}
