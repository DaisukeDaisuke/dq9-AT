// Generated synthetic call streams only. Map IDs mirror public source bindings;
// the fixture values are invented and are not extracted ROM resources.
import assert from 'node:assert/strict';
import {parseCalls} from '../web/vendor/call-stream.mjs';
import {npcDefinitionExcluded,decodeNpcDefinitions,findNpcPlacement,projectNpcDefinitions,readNpcMembershipSource,npcDefinitionDecision,projectUnconditionalNpcPlacements,projectNpcMembershipSource} from '../web/npc-membership.mjs';
let checks=0;
const equal=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const throws=(f,message)=>{checks++;assert.throws(f,message);};
function stream(records) {
  const length=16+records.reduce((s,r)=>s+((3+Math.ceil(r.args.length/4)+3)&~3)+4*r.args.length,0);
  const bytes=new Uint8Array(length),v=new DataView(bytes.buffer);v.setUint32(0,records.length,true);v.setUint32(4,length,true);
  let p=16;
  for(const r of records){const n=r.args.length,h=(3+Math.ceil(n/4)+3)&~3;v.setUint16(p,r.opcode,true);bytes[p+2]=n;
    r.args.forEach((a,i)=>{bytes[p+3+Math.floor(i/4)]|=a.type<<((i%4)*2);v.setUint32(p+h+4*i,a.raw,true);});p+=h+4*n;}
  return parseCalls(bytes);
}
const int=raw=>({type:1,raw:raw>>>0}),string=raw=>({type:0,raw:raw>>>0});
const definition=(id,kind=1,flags=0)=>({opcode:3,args:[int(id),int(kind),string(0xffffffff),string(0xffffffff),int(flags)]});
const calls=(...rows)=>stream(rows);
const project=(mapId,rows,nodes,extra={})=>projectNpcDefinitions({mapId,calls:calls(...rows),placementNodes:nodes,...extra});
for(const map of [0,50100,50101,50102,50522,50523,50524,65535])for(const id of [0,1,63,64,255,256,0x7fffffff,0x80000000,0xffffffff])
  equal(npcDefinitionExcluded(map,id),map>=50101&&map<=50523&&id>=1&&id<=63,`map ${map}, ID ${id}`);
for(const [map,id]of [[-1,1],[65536,1],[50101,-1],[50101,0x100000000],[7602,NaN],[7602,1.5]])throws(()=>npcDefinitionExcluded(map,id));
// Full definition ID is compared with the stored placement byte, before u16store.
equal(findNpcPlacement([{id:1},{id:2},{id:1}],1),0);
equal(findNpcPlacement([{id:0},{id:1}],256),-1);
equal(findNpcPlacement([{id:1}],257),-1);
equal(findNpcPlacement([],0),-1);
throws(()=>findNpcPlacement([{id:256}],256));throws(()=>findNpcPlacement([,{id:1}],1));
const decoded=decodeNpcDefinitions(calls(definition(0x10001,0x102,0x103)))[0];
equal([decoded.rawId,decoded.storedId,decoded.kind,decoded.flags],[0x10001,1,2,3]);
const d06=project(7602,[definition(1)],[{id:1}]);
equal(d06.projectionResolved,true);equal(d06.conditionalDefinitions.length,1);
equal(d06.conditionalDefinitions[0].kind,1);equal(d06.definitionDecisions[0].decision,'definition-allocation-required');
const h15=project(16500,[definition(1,0)],[{id:1}]);
equal(h15.projectionResolved,true);equal(h15.conditionalDefinitions[0].kind,0);
const duplicates=project(7602,[definition(1,0),definition(2,2),definition(1,5)],[{id:1},{id:2},{id:1}]);
equal(duplicates.conditionalDefinitions.map(d=>[d.rawId,d.kind,d.sourceCallIndex,d.placementIndex]),[[1,5,2,0],[2,2,1,1],[1,0,0,0]]);
equal(project(50101,[definition(1),definition(63),definition(64)],[{id:1},{id:63},{id:64}]).definitionDecisions.map(d=>d.decision),['skip-fixed-exclusion','skip-fixed-exclusion','definition-allocation-required']);
equal(project(7602,[definition(1),definition(257)],[{id:1}]).definitionDecisions.map(d=>d.decision),['definition-allocation-required','skip-missing-placement']);
equal(project(7602,[definition(1)],[]).definitionDecisions[0].decision,'skip-missing-placement');
const bad=definition(1);bad.opcode=4;
equal(project(7602,[definition(1),bad],[{id:1}]).projectionResolved,false);
equal(project(7602,[definition(1),bad],[{id:1}]).conditionalDefinitions,[]);
for(const type of [0,2,3]){const row=definition(1);row.args[0].type=type;equal(project(7602,[row],[{id:1}]).projectionResolved,false);}
throws(()=>decodeNpcDefinitions([,calls(definition(1))[0]]));
const malformed=calls(definition(1));malformed[0].argumentCount=4;
equal(projectNpcDefinitions({mapId:7602,calls:malformed,placementNodes:[{id:1}]}).projectionResolved,false);
// No hypothesis, allocation outcome, program counter or end-of-epoch label can
// upgrade a logical membership projection to a production AT contribution.
for(const pc of [0x0203d660,0x020409cc,0x020409d0,0x0203d66c])for(const success of [false,true]){
 const result=project(7602,[definition(1)],[{id:1}],{reached:true,conditions:{allRequiredAllocationsSucceed:success,noSeedSetter:true},allocationPointer:success?0x02300000:0,definitionAllocationSuccess:success,controllerAllocationSuccess:success,endpoint:{pc,seedEpoch:'pretend'},bootProof:true});
 equal(result.provedMinimumAT,0);equal(result.actualATConsumed,null);equal(result.runtimeMembershipResolved,false);equal(result.bootProof,false);equal(result.sessionUnchanged,true);
}
// Placement3 subprojection retains full map compare, byte ID writes, unique
// head-prepend order, and the allocation obligation even on a removal.
const place=(map,id,position=true)=>({opcode:3,args:[int(map),int(id),...(position?[int(0),int(0),int(0),int(0)]:[])]});
const placements=(...rows)=>projectUnconditionalNpcPlacements({mapId:7602,calls:calls(...rows)});
equal(npcDefinitionDecision({mapId:50101,call:calls(definition(1))[0]}).decision,'skip-fixed-exclusion');
equal(npcDefinitionDecision({mapId:7602,call:calls(definition(1))[0]}).decision,'unresolved');
equal(projectNpcDefinitions({mapId:50101,calls:calls(definition(1))}).projectionResolved,true);
equal(placements(place(7602,1),place(7602,2)).conditionalPlacementNodes.map(n=>n.id),[2,1]);
equal(placements(place(7602+65536,1)).conditionalPlacementNodes,[]);
equal(placements(place(7602+65536,1)).placementDecisions[0].allocationBytes,0);
equal(placements(place(7602,257)).conditionalPlacementNodes[0].id,1);
equal(placements(place(7602,1),place(7602,257)).projectionResolved,false);
equal(placements(place(7602,1),place(7602,257)).conditionalPlacementNodes,[]);
equal(placements(place(7602,1),place(7602,257,false)).conditionalPlacementNodes,[]);
equal(placements(place(7602,1,false)).placementDecisions[0].allocationBytes,0x78);
equal(placements(place(7602,1),place(7603,1,false)).conditionalPlacementNodes.map(n=>n.id),[1]);
equal(placements(place(7602,1),place(7602,1,false),place(7602,1)).conditionalPlacementNodes.map(n=>n.id),[1]);
const floatIdentity=place(7602,1);floatIdentity.args[1].type=2;equal(placements(floatIdentity).projectionResolved,false);
const wrongShape=place(7602,1);wrongShape.args.pop();equal(placements(wrongShape).projectionResolved,false);
const unsupportedPlace={opcode:6,args:[int(1),int(0),int(0),int(0),int(0),int(0)]};
equal(placements(unsupportedPlace).projectionResolved,false);
equal(placements(place(7602,1),unsupportedPlace).conditionalPlacementNodes,[]);
const source=(mapId,p,n)=>({source:{mapId},place:{calls:calls(...p)},npc:{calls:calls(...n)}});
const d06Shape=projectNpcMembershipSource(source(7602,[place(7602,1)],[definition(1)]));
equal(d06Shape.projectionResolved,true);equal(d06Shape.conditionalDefinitions.map(n=>n.kind),[1]);
equal(d06Shape.provedMinimumAT,0);equal(d06Shape.runtimeMembershipResolved,false);
equal(projectNpcMembershipSource(source(16500,[place(16500,1),unsupportedPlace],[definition(1,0)])).projectionResolved,false);
const many=Array.from({length:40},(_,i)=>definition(i+1));
equal(project(7602,many,many.map((_,i)=>({id:i+1}))).conditionalDefinitions.length,40);
equal(placements(...Array.from({length:40},(_,i)=>place(7602,i+1))).conditionalPlacementNodes.length,40);
const snapshot=JSON.stringify(d06Shape),restored=JSON.parse(snapshot);equal(restored.provedMinimumAT,0);equal(restored.bootProof,false);
const invalidRom=new Uint8Array(0x200);await assert.rejects(()=>readNpcMembershipSource(invalidRom,{mapId:7602,archiveCode:'D06'}),/source hash mismatch/);checks++;
await assert.rejects(()=>readNpcMembershipSource(invalidRom,{mapId:7602,archiveCode:'../D06'}),/archive code/);checks++;
console.log(JSON.stringify({passed:true,checks,fixtureOrigin:'generated synthetic D06-shape/H15-shape data',scope:'static predicates and conditional logical membership only',provedMinimumAT:0},null,2));
