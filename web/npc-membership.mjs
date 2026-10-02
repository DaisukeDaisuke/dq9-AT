// Source-local NPC membership projection, Japanese revision 0 only. This is not
// a heap simulator, loader reachability certificate or ATSession proof producer.
import {NitroFS} from './vendor/nitro-fs.mjs';
import {readBoundedNarcMembers} from './map-exits.mjs';
import {parseCalls, decodeNumber, decodeMapRecords, u32} from './vendor/call-stream.mjs';

export const NPC_MEMBERSHIP_ROM_SHA256 = '3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7';
const uint = (n, max=0xffffffff) => Number.isInteger(n) && n >= 0 && n <= max;
const check = (ok, message) => { if (!ok) throw Error(message); };
const dense = a => Array.isArray(a) && Array.from({length:a.length}, (_,i) => Object.hasOwn(a,i) && a[i] != null).every(Boolean);
const argsOf = call => {
  check(call && uint(call.opcode,65535) && uint(call.index) && uint(call.offset), 'Call identity required');
  check(dense(call.args) && uint(call.argumentCount,255) && call.args.length === call.argumentCount, 'Complete argument list required');
  check(call.args.every(a => a && [0,1,2].includes(a.type) && uint(a.raw)), 'Malformed source argument');
  return call.args.map(a => a.raw);
};

// Current map has already been read with LDRH. Do not normalize invalid inputs.
// 02099e34 ignores its state argument; literals at 02099e58/5c are fixed.
// 02099eb8 tests the full signed integer returned by 02030644, before any store.
export function npcDefinitionExcluded(mapId, rawNpcId) {
  check(uint(mapId,65535), 'Current map ID must be uint16');
  check(uint(rawNpcId), 'Raw NPC ID must be uint32');
  return mapId >= 50101 && mapId <= 50523 && (rawNpcId | 0) > 0 && (rawNpcId | 0) < 64;
}

export function decodeNpcDefinitions(calls) {
  check(dense(calls) && calls.length <= 100000, 'Complete bounded NPC call stream required');
  return calls.map(call => {
    const a = argsOf(call);
    check(call.opcode === 3 && a.length === 5 && call.args.every((arg,i) => arg.type === [1,1,0,0,1][i]), 'Unsupported NPC definition opcode or argument shape');
    return {rawId:a[0], storedId:a[0]&65535, kind:a[1]&255, flags:a[4]&255,
      hasModelName:a[2]!==0xffffffff, hasSecondName:a[3]!==0xffffffff,
      sourceCallIndex:call.index, sourceCallOffset:call.offset};
  });
}

// 0206ec74 compares the stored byte against the full raw argument, then follows
// +0x68. An ordered logical list is a hypothetical input, never heap evidence.
export function findNpcPlacement(placementNodes, rawNpcId) {
  check(dense(placementNodes) && placementNodes.length <= 100000, 'Complete bounded placement-node order required');
  check(uint(rawNpcId), 'Raw NPC ID must be uint32');
  check(placementNodes.every(n => uint(n.id,255)), 'Stored placement ID must be uint8');
  return placementNodes.findIndex(n => n.id === rawNpcId);
}

// One source handler decision. The fixed exclusion precedes placement lookup,
// so that known skip remains available even when the list is unavailable.
export function npcDefinitionDecision({mapId, call, placementNodes}={}) {
  const base={actualATConsumed:null, runtimeMembershipResolved:false, provedMinimumAT:0, bootProof:false};
  try {
    const definition=decodeNpcDefinitions([call])[0];
    if(npcDefinitionExcluded(mapId,definition.rawId))return {...base,...definition,decision:'skip-fixed-exclusion',placementIndex:null};
    const placementIndex=findNpcPlacement(placementNodes,definition.rawId);
    return {...base,...definition,decision:placementIndex<0?'skip-missing-placement':'definition-allocation-required',placementIndex:placementIndex<0?null:placementIndex};
  } catch(error) { return {...base,decision:'unresolved',reason:error.message}; }
}

// Unique-ID opcode3 subset only. All list results are conditional on successful
// 0x78 placement allocations and completed interpreter calls. Insertion with a
// duplicate byte ID uses a ranked alternate chain, deliberately not modeled.
export function projectUnconditionalNpcPlacements({mapId,calls}={}) {
  const base={projectionResolved:false,initialPlacementList:'empty-hypothesis',conditionalPlacementNodes:[],placementDecisions:[],...unproved()};
  try {
    check(uint(mapId,65535),'Current map ID must be uint16');
    check(dense(calls)&&calls.length<=100000,'Complete bounded placement call stream required');
    const nodes=[],decisions=[];
    for(const call of calls) {
      const a=argsOf(call);
      check(call.opcode===3&&[2,6,7].includes(a.length),'Unsupported placement opcode or argument shape');
      check(call.args[0].type===1&&call.args[1].type===1,'Integer placement map/ID required');
      if(a[0]!==mapId) {decisions.push({sourceCallIndex:call.index,decision:'skip-other-map',allocationBytes:0});continue;}
      const id=a[1]&255,existing=nodes.findIndex(n=>n.id===id);
      if(a.length===2) {
        if(existing>=0)nodes.splice(existing,1);
        decisions.push({sourceCallIndex:call.index,id,decision:'conditional-remove',allocationBytes:0x78});
      } else {
        check(call.args.slice(2,6).every(arg=>[1,2].includes(arg.type)&&Number.isFinite(decodeNumber(arg)))&&(a.length===6||call.args[6].type===1),'Unsupported position/heading argument');
        check(existing<0,'Duplicate byte placement ID needs unmodeled ranked alternate chain');
        nodes.unshift({id,rawId:a[1],sourceCallIndex:call.index,sourceCallOffset:call.offset});
        decisions.push({sourceCallIndex:call.index,id,decision:'conditional-prepend',allocationBytes:0x78});
      }
    }
    return {...base,projectionResolved:true,conditionalPlacementNodes:nodes,placementDecisions:decisions,
      reason:'Unique-ID unconditional membership under completed successful placement allocations; original runtime list remains unknown'};
  } catch(error) {return {...base,reason:error.message};}
}

const uncertainty = [
  'native archive selection and reached placement/definition interpreter',
  'original placement heap, list links and valid disjoint allocations',
  'definition-node allocation outcomes and interpreter continuation',
  'constructor traversal and separate controller allocation outcomes',
  'closed after-draw endpoint and uninterrupted seed epoch'
];
const unproved = () => ({runtimeMembershipResolved:false, constructorReached:null,
  actualATConsumed:null, provedMinimumAT:0, maximumAT:null, bootProof:false,
  sessionUnchanged:true, unresolved:[...uncertainty]});

// Conditional definition list if the supplied placement order is actual, every
// relevant handler executes, and every required definition allocation succeeds.
// These conditions remain unknown; caller-supplied true flags do not prove them.
export function projectNpcDefinitions({mapId, calls, placementNodes}={}) {
  const result = {schema:'dq9-npc-definition-projection-v1', mapId,
    projectionResolved:false, initialDefinitionList:'empty-hypothesis', conditionalDefinitions:[], definitionDecisions:[], ...unproved()};
  try {
    check(uint(mapId,65535), 'Current map ID must be uint16');
    const definitions = decodeNpcDefinitions(calls);
    const conditionalDefinitions = [], definitionDecisions = [];
    for (let i=0;i<definitions.length;i++) {
      const decision=npcDefinitionDecision({mapId,call:calls[i],placementNodes});
      check(decision.decision!=='unresolved',decision.reason);
      definitionDecisions.push(decision);
      if(decision.decision==='definition-allocation-required') {
        // 02066034 always prepends; equal IDs are not deduplicated.
        conditionalDefinitions.unshift({...definitions[i],placementIndex:decision.placementIndex});
      }
    }
    return {...result, projectionResolved:true, conditionalDefinitions, definitionDecisions,
      reason:'Static skip/lookup predicates resolved under the supplied logical placement list; runtime membership remains unknown'};
  } catch (error) {
    return {...result, reason:error.message};
  }
}

export function projectNpcMembershipSource(source) {
  const placement=projectUnconditionalNpcPlacements({mapId:source?.source?.mapId,calls:source?.place?.calls});
  if(!placement.projectionResolved)return {...placement,reason:'Placement membership unresolved: '+placement.reason,conditionalDefinitions:[]};
  const definitions=projectNpcDefinitions({mapId:source.source.mapId,calls:source.npc?.calls,placementNodes:placement.conditionalPlacementNodes});
  return {...definitions,initialPlacementList:placement.initialPlacementList,conditionalPlacementNodes:placement.conditionalPlacementNodes,placementDecisions:placement.placementDecisions,source:source.source,loaderBindingResolved:false};
}

function checkedCalls(bytes) {
  check(bytes instanceof Uint8Array && bytes.length >= 16 && bytes.length <= 4*1024*1024, 'Bounded call bytes required');
  const count=u32(bytes,0),pool=u32(bytes,4),size=u32(bytes,8);
  check(count <= 100000 && count <= Math.floor((bytes.length-16)/4) && pool >= 16 && pool+size <= bytes.length, 'Invalid call header');
  const calls=parseCalls(bytes);
  check(calls.endOffset <= pool, 'Calls overlap string pool');
  for (const call of calls) for (const a of call.args) {
    check(a.type !== 3, 'Unsupported argument type');
    if (a.type === 0 && a.raw !== 0xffffffff) {
      check(a.raw < size, 'String offset outside pool');
      let p=pool+a.raw;while(p<pool+size && bytes[p])p++;
      check(p<pool+size, 'Unterminated pool string');
    }
    if(a.type===2)check(Number.isFinite(decodeNumber(a)), 'Nonfinite numeric argument');
  }
  return calls;
}
const sha256 = async bytes => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');

// Reads original user-supplied ROM bytes, not checked-in extracted assets. The
// explicit archive name selects a resource for analysis, not a native loader.
export async function readNpcMembershipSource(input, {mapId, archiveCode}={}) {
  const rom=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
  check(rom && rom.length >= 0x200, 'Original ROM bytes required');
  check(uint(mapId,65535), 'Current map ID must be uint16');
  check(typeof archiveCode==='string' && /^[A-Z](?:[0-9]{2})?$/.test(archiveCode), 'Exact ordinary NPC archive code required');
  const romSHA256=await sha256(rom);
  check(romSHA256===NPC_MEMBERSHIP_ROM_SHA256, 'Original Japanese revision 0 source hash mismatch');
  const nitro=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
  const mapBytes=new Uint8Array(nitro.readFile('data/map/maplist9.bin'));
  const maps=decodeMapRecords(mapBytes,checkedCalls(mapBytes)).filter(m=>m.mapId===mapId);
  check(maps.length===1, 'Unique maplist source binding required');
  const archivePath=`data/scenario/${archiveCode}.npc`,data=new Uint8Array(nitro.readFile(archivePath));
  const {archive,offsets}=readBoundedNarcMembers(data);
  const members=archive.files.map((bytes,index)=>({bytes,index,name:archive.fnt.getFilenameOf(index),archiveOffset:offsets[index]}));
  check(members.length===2, 'Complete ordinary place/npc archive required');
  const select = suffix => {
    const found=members.filter(m=>m.name===archiveCode+suffix+'.bin');
    check(found.length===1, 'Exact NPC archive member missing or ambiguous');
    return found[0];
  };
  const place=select('place'),npc=select('npc'),map=maps[0];
  const member = async m => ({name:m.name,index:m.index,archiveOffset:m.archiveOffset,sha256:await sha256(m.bytes),calls:checkedCalls(m.bytes)});
  return {schema:'dq9-npc-membership-source-v1',source:{romSHA256,archivePath,archiveSHA256:await sha256(data),
    maplistSHA256:await sha256(mapBytes),mapId,fieldCode:map.fieldCode,maplistCallIndex:map.callIndex,maplistCallOffset:map.callOffset},
    place:await member(place),npc:await member(npc),loaderBindingResolved:false,...unproved()};
}
