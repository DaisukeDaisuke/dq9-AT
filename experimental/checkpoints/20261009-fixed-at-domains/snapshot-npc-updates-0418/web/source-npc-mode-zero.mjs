// ROM-derived persistence of the placement mode=0 gate. No story/clock guesses.
import {createSourceNPCUpdateBoundReader} from './source-npc-update-bounds.mjs';
import {decodeActorArm9} from './actor-rom-mining.mjs';
import {NitroFS} from './vendor/nitro-fs.mjs';
import {readBoundedNarcMembers} from './map-exits.mjs';
import {parseCalls} from './vendor/call-stream.mjs';
import {assertProductionATInput} from './production-at-input-policy.mjs';
const owned=new WeakSet(),need=(p,m)=>{if(!p)throw Error(m);};
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
function calls(bytes){const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),pool=d.getUint32(4,true);need(bytes.length>=16&&pool>=16&&pool+d.getUint32(8,true)<=bytes.length&&d.getUint32(0,true)<=Math.floor((pool-16)/4),'Source call bounds');const c=parseCalls(bytes);need(c.endOffset<=pool,'Source call/string overlap');return c;}
export async function createSourceNPCModeZeroReader({rom,romSHA256}){
 const ordinaryUpdate=(await createSourceNPCUpdateBoundReader({rom,romSHA256}))(),arm=decodeActorArm9(rom),sourceBindings=[];
 for(const[name,start,end]of[['fresh-mode-zero-writer',0x0206d080,0x0206d164],['opcode6-region-append',0x0206d63c,0x0206d768],['opcode11-flags-only',0x0206db90,0x0206dc2c],['opcode18-visibility-scale-only',0x0206e888,0x0206e938],['ordinary-mode-zero-skip',0x02041184,0x02041198],['model-actor-mode-zero-skip',0x020412ac,0x020412c0]])sourceBindings.push({name,address:start,bytes:end-start,sha256:await sha(arm.bytes.subarray(start-arm.base,end-arm.base))});
 const nitro=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
 return function read(input){assertProductionATInput(input);const{scenarioPath,mapId}=input??{};need(typeof scenarioPath==='string'&&/^data\/scenario\/[A-Za-z0-9_]+\.npc$/.test(scenarioPath)&&Number.isInteger(mapId)&&mapId>=0&&mapId<=65535,'Source scenario and map identity required');
  const archive=readBoundedNarcMembers(new Uint8Array(nitro.readFile(scenarioPath))).archive,definitions=new Map(),places=[],unresolved=[];
  for(let i=0;i<archive.files.length;i++){const name=archive.fnt.getFilenameOf(i),rows=calls(archive.files[i]);if(/npc\.bin$/i.test(name))for(const c of rows){need(c.opcode===3&&c.argumentCount===5&&c.args[0].type===1&&c.args[1].type===1&&!definitions.has(c.args[0].raw),'Unique NPC definitions required');definitions.set(c.args[0].raw,{npcId:c.args[0].raw,kind:c.args[1].raw,definitionCallIndex:c.index,ordinaryDefinitionSupported:c.args[1].raw!==1||(c.args[2].type===0&&c.args[2].raw===0xffffffff&&c.args[3].type===0&&c.args[3].raw===0xffffffff&&c.args[4].type===1&&c.args[4].raw===0)});}else if(/place\.bin$/i.test(name))places.push(...rows);else throw Error('Unknown scenario member');}
  const possible=new Map(),modifiers=[];
  for(const c of places){let m,id,minimum;
   if(c.opcode===3){need([2,6,7].includes(c.argumentCount),'place3 shape');[m,id,minimum]=[0,1,6];}
   else if(c.opcode===4){need([6,10,11].includes(c.argumentCount),'place4 shape');[m,id,minimum]=[4,5,10];}
   else if(c.opcode===5){need([9,13,14].includes(c.argumentCount),'place5 shape');[m,id,minimum]=[7,8,13];}
   else if(c.opcode===14){need([5,9,10].includes(c.argumentCount),'quest placement shape');[m,id,minimum]=[3,4,9];}
   else if(c.opcode===17){need([9,10].includes(c.argumentCount),'single event placement shape');[m,id,minimum]=[3,4,9];}
   else if([6,7,8,9,10,11,18].includes(c.opcode)){need(c.args[0]?.type===1,'Modifier identity type');modifiers.push(c);continue;}
   else{unresolved.push({callIndex:c.index,opcode:c.opcode,reason:'Unmodeled opcode may affect placement/mode'});continue;}
   need(c.args[m].type===1&&c.args[id].type===1,'Creator identity types');if(c.args[m].raw===mapId&&c.argumentCount>=minimum){const npcId=c.args[id].raw;need(definitions.has(npcId),'Placement has no definition');if(!possible.has(npcId))possible.set(npcId,{...definitions.get(npcId),creatorCallIndices:[],modifiers:[],modeWriterFound:false,auxiliaryFlagsKnownClear:true});possible.get(npcId).creatorCallIndices.push(c.index);}
  }
  for(const c of modifiers){const row=possible.get(c.args[0].raw);if(!row)continue;row.modifiers.push({callIndex:c.index,opcode:c.opcode});if([7,8,9,10].includes(c.opcode))row.modeWriterFound=true;
   if(c.opcode===6)need(c.argumentCount===6,'Region opcode shape');if(c.opcode===11){need(c.argumentCount>=2&&c.args.every(a=>a.type===1),'Flag opcode shape');if(c.args.slice(1).some(a=>a.raw&0x2000))row.auxiliaryFlagsKnownClear=false;}if(c.opcode===18)need([2,3].includes(c.argumentCount)&&c.args[1].type===1,'Visibility opcode shape');
  }
  const candidates=[...possible.values()].sort((a,b)=>a.npcId-b.npcId),modeZero=candidates.every(c=>!c.modeWriterFound)&&!unresolved.length,ordinary=candidates.filter(c=>c.kind===1),ordinaryZero=modeZero&&ordinary.every(c=>c.auxiliaryFlagsKnownClear&&c.ordinaryDefinitionSupported);
  const result=freeze({schema:'source-map-NPC-mode-zero-window-v1',romSHA256,scenarioPath,mapId,candidates,storyConditionsEvaluated:false,candidateUnionMayIncludeInactiveNPCs:true,unresolved,
   timerFamily:{calls:{min:'0',max:modeZero?'0':null},descriptorModeZero:modeZero,appliesToAnyNumberOfInvocations:modeZero,scope:'Timer-side movement choice and threshold reset only, for every source candidate in this map'},
   ordinaryActorFamily:{candidateCount:ordinary.length,calls:{min:'0',max:ordinaryZero?'0':null},appliesToAnyNumberOfInvocations:ordinaryZero,scope:'Source kind1 ordinary body update plus mode-zero controller tail, with no auxiliary actor'},
   modelActorBodyFamily:{npcIds:candidates.filter(c=>c.kind===2||c.kind===5).map(c=>c.npcId),calls:{min:'0',max:candidates.some(c=>c.kind===2||c.kind===5)?null:'0'},unresolvedCallbackSite:0x020bf4c4},
   conditions:['The reached NPC manager is rebuilt from these source destination placement alternatives','Admitted creators call0206d080; opcode6 appends region records at+40, opcode11 changes flags+0c, opcode18 changes bits3..5/+60, none writes mode+1f','No later script/network/other writer changes mode+1f or creates an auxiliary actor during the interval','Ordinary actor/controller objects stay valid; other consumer families are separate'],
   sourceBindings,ordinaryUpdateSource:ordinaryUpdate.sourceBinding,conditionsMeasured:false,sourceClockKnown:false,wholeWorldGapResolved:false,currentATRecovered:false,unknownAlternativeRetained:true});owned.add(result);return result;
 };
}
export function isPreparedNPCModeZero(result){return owned.has(result);}
