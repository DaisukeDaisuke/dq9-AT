// Read-only original-ROM regression, exports sanitized counts/provenance only.
// Usage: node scripts/inspect-npc-membership.mjs /path/to/original.nds
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readNpcMembershipSource,projectNpcMembershipSource} from '../web/npc-membership.mjs';
if(!process.argv[2])throw Error('Original ROM path required');
const rom=await readFile(process.argv[2]),results=[];
for(const [mapId,archiveCode]of [[7602,'D06'],[16500,'H15']]) {
 const source=await readNpcMembershipSource(rom,{mapId,archiveCode}),r=projectNpcMembershipSource(source);
 assert.equal(r.provedMinimumAT,0);assert.equal(r.bootProof,false);assert.equal(r.runtimeMembershipResolved,false);
 if(mapId===7602){assert.equal(r.projectionResolved,true);assert.equal(r.conditionalDefinitions.length,1);assert.equal(r.conditionalDefinitions[0].kind,1);}
 else {assert.equal(r.projectionResolved,false);assert.match(r.reason,/Unsupported placement opcode/);}
 results.push({source:source.source,place:{name:source.place.name,sha256:source.place.sha256,callCount:source.place.calls.length},npc:{name:source.npc.name,sha256:source.npc.sha256,callCount:source.npc.calls.length},
  projectionResolved:r.projectionResolved,reason:r.reason,conditionalDefinitionCount:r.projectionResolved?r.conditionalDefinitions.length:null,provedMinimumAT:r.provedMinimumAT,loaderBindingResolved:false,runtimeMembershipResolved:r.runtimeMembershipResolved});
}
console.log(JSON.stringify({passed:true,results,scope:'Original ROM resource predicates; no native runtime or all-map AT proof'},null,2));
