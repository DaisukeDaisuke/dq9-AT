// Select a source ROM edge under explicit two-map/one-entry hypotheses. This
// does not certify cached labels, native entry time, allocation or scene state.
import {decodeCalls} from './map-core.mjs';
import {decodeMapRecords} from './vendor/call-stream.mjs';
import {readBoundedNarcMembers,decodeMapExitMember} from './map-exits.mjs';
import {projectConditionalFieldInvocationSpan} from './source-field-invocation-clock.mjs';
import {assertProductionATInput} from './production-at-input-policy.mjs';
const need=(x,m)=>{if(!x)throw Error(m);},copy=structuredClone,hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
export async function readSelectedOrdinaryEntryClock({project,catalog,source,input,clockBinding}){
 assertProductionATInput(input);
 const from=input?.fromMap,to=input?.map??input?.toMap,before=input?.entryWitnessFrames?.before,after=input?.entryWitnessFrames?.after,target=input?.targetFrame??after,nfs=project?.nfs??project?.nitro;
 need(from&&to&&from.recordKey!==to.recordKey&&from.mapId!==to.mapId,'Distinct selected before/after map alternatives required');
 need(input.entryTimeHypothesis?.lowerBoundKnown===true&&input.entryTimeHypothesis.min===before?.sourcePTS&&input.entryTimeHypothesis.max<=after?.sourcePTS,'Selected between-observation entry interval required');
 need(source?.romSHA256===clockBinding?.romSHA256&&source.record?.recordKey===to.recordKey&&source.record.mapId===to.mapId&&source.graph?.nodes?.length,'Bound destination static graph source required');
 need(nfs?.readFile&&Array.isArray(catalog?.maps),'Owned ROM project/catalog required');
 const select=m=>{const rows=catalog.maps.filter(r=>r.key===m.recordKey&&r.mapId===m.mapId&&r.fieldCode===m.fieldCode);need(rows.length===1,'Selected map differs from exact ROM record');return rows[0];},a=select(from),b=select(to);
 const list=new Uint8Array(nfs.readFile('data/map/maplist9.bin')),records=decodeMapRecords(list,decodeCalls(list)),raw=m=>records.filter(r=>r.mapId===m.mapId&&r.fieldCode===m.fieldCode&&`map:${r.callIndex}:${r.callOffset}`===m.key);
 need(raw(a).length===1&&raw(b).length===1,'Maplist source identity differs');need(/^[A-Za-z0-9_]+$/.test(a.fieldCode),'Unsupported source archive name');
 const archivePath=`data/map/${a.fieldCode}.ambl`,bytes=new Uint8Array(nfs.readFile(archivePath)),n=readBoundedNarcMembers(bytes),exits=[];
 for(let i=0;i<n.archive.files.length;i++){const member=n.archive.fnt.getFilenameOf(i);if(!member.endsWith('.bmbl'))continue;exits.push(...decodeMapExitMember(n.archive.files[i],{archivePath,member,memberIndex:i,memberArchiveOffset:n.offsets[i]},records).exits);}
 const ordinary=exits.filter(e=>e.kind.value===0&&e.target.firstMapId===b.mapId&&e.target.mapRecords.some(r=>r.mapId===b.mapId&&r.fieldCode===b.fieldCode));need(ordinary.length>0,'No original-ROM ordinary edge for this selected map pair');
 const clockSpan=projectConditionalFieldInvocationSpan(clockBinding,{fromFrame:before,toFrame:target,freshResetAfterStart:true});
 return {schema:'source-bound-selected-single-entry-clock-v1',entryId:input.id??null,fromMap:copy(from),toMap:copy(to),entryWitnessFrames:copy(input.entryWitnessFrames),targetFrame:copy(target),source:{romSHA256:source.romSHA256,destinationGraph:{path:source.graph.path,nodeCount:source.graph.nodes.length},dependencies:[{path:'data/map/maplist9.bin',sha256:await hash(list),bytes:list.length},{path:archivePath,sha256:await hash(bytes),bytes:bytes.length}],ordinaryExits:ordinary.map(e=>({source:e.source,opcode:e.opcode,kind:e.kind,target:e.target,destination:e.destination}))},clockSpan,
  conditions:[...clockSpan.conditions,'The selected before map and after map describe their respective source states; cached labels/camera matching remain hypotheses, not certified map identities','Exactly one ordinary traversal of a listed ROM exit starts after the earlier state and completes before the later state; preloading before the earlier endpoint is outside this branch','Destination is not already cached; the normal selected-field reset and successful ordinary graph initialization occur in this one traversal','No extra hidden reload, map return or source-clock/field-timer rewrite occurs between reset and target observation'],conditionsMeasured:false,mapIdentityCertified:false,entryCertified:false,sourceClockCertified:false,resetBetweenSelectedSourceStatesHypothesized:true,resetTimeInVideoPTSNotExact:true,infiniteCacheHitHiddenReloadOtherMapAlternativesRetained:true,wholeWorldATCalls:{min:'0',max:null},currentATRecovered:false};
}
