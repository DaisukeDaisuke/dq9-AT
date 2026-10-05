// ROM-owned catalog; callers never need to construct metadata JSON.
import {parseCalls,decodeMapRecords} from './vendor/call-stream.mjs';
import {minimapProjectFromRom} from './minimap-preview.mjs';
import {readArchiveRequestRules,nativeArchiveRequest} from './native-archive-request.mjs';
export function buildRomMapCatalog(project){
 const bytes=new Uint8Array(project.nfs.readFile('data/map/maplist9.bin'));
 const records=decodeMapRecords(bytes,parseCalls(bytes));
 const minimap=minimapProjectFromRom(project.nfs),rules=readArchiveRequestRules(project.sdk);
 const files=new Set(project.nfs.readDir('data/map').files);
 const maps=records.map(r=>{
  const minimapCandidates=[];
  const add=(descriptor,relation)=>{if(descriptor&&!minimapCandidates.some(x=>x.path===descriptor.path))minimapCandidates.push({path:descriptor.path,relation});};
  add(minimap.descriptors.get(r.fieldCode+'.bmmp'),'field-code');
  for(const d of minimap.descriptors.values()){
   if(d.mapBindings.some(x=>x.mapId===r.mapId))add(d,'bmmp-map-binding');
   else if(d.groups.some(g=>g.kind==='map-id-list'&&g.mapIds.includes(r.mapId)))add(d,'bmmp-map-group');
  }
  const nativeFieldCode=r.fieldCode?.slice(0,6),requests=[],unresolved=[];
  // Both documented phases are retained for dual archives; never guess a variant.
  for(const phase of (r.mapId===rules.dualMapId||r.mapId===rules.dualMapId+100?[0,1]:[0])){
   try{const q=nativeArchiveRequest({mapId:r.mapId,nativeFieldCode,phase},rules);
    if(q.supported){const name=q.path.split('/').at(-1);requests.push({...q,name,present:files.has(name)});}
    else unresolved.push(q.reason);
   }catch(e){unresolved.push(e.message);}
  }
  if(!minimapCandidates.length)unresolved.push('No source-linked minimap descriptor');
  return {key:`map:${r.callIndex}:${r.callOffset}`,mapId:r.mapId,name:r.resource0||r.fieldCode||String(r.mapId),fieldCode:r.fieldCode,nativeFieldCode,modelResource:r.rawArgs[11]?.string??null,cameraSelector:r.rawArgs[10]?.type===1?(r.rawArgs[10].value&3):null,source:{path:'data/map/maplist9.bin',callIndex:r.callIndex,callOffset:r.callOffset},minimapCandidates,archiveRequests:requests,unresolved,rendered:false};
 });
 return {maps,minimap,scope:'ROM catalog and native archive request derivation only; scene/texture/camera and click render remain separate. Generated-map variants remain explicit unknowns.'};
}
