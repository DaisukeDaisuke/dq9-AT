// Source-derived configuration facts, never a complete kind2 draw total.
import {ACTOR_ROM_SHA256,decodeActorArm9} from './actor-rom-mining.mjs';
import {NitroFS} from './vendor/nitro-fs.mjs';
import {readBoundedNarcMembers} from './map-exits.mjs';
import {parseCalls,readPoolString} from './vendor/call-stream.mjs';
import {assertProductionATInput} from './production-at-input-policy.mjs';
import {LOADER_NO_DRAW_BINDINGS as bindings} from './source-kind2-model-bindings.mjs';
const owned=new WeakSet(),need=(p,m)=>{if(!p)throw Error(m);};
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
function checkedCalls(b){need(b instanceof Uint8Array&&b.length>=16&&b.length<=2*1024*1024,'Bounded source call stream required');const d=new DataView(b.buffer,b.byteOffset,b.byteLength),count=d.getUint32(0,true),pool=d.getUint32(4,true),n=d.getUint32(8,true);need(pool>=16&&pool+n<=b.length&&count<=Math.floor((pool-16)/4),'Source call header bounds');const calls=parseCalls(b);need(calls.length===count&&calls.endOffset<=pool,'Source calls overlap pool');for(const c of calls)for(const a of c.args)if(a.type===0&&a.raw!==0xffffffff&&a.raw!==0xfffffffe)need(a.raw<n&&b.subarray(pool+a.raw,pool+n).includes(0),'Source string bounds');return {calls,pool};}
export async function createSourceKind2ModelComponentReader({rom,romSHA256}){
 need(rom instanceof Uint8Array&&romSHA256===ACTOR_ROM_SHA256&&await sha(rom)===romSHA256,'Verified original ROM required');
 const arm=decodeActorArm9(rom),view=new DataView(arm.bytes.buffer,arm.bytes.byteOffset,arm.bytes.byteLength),u=pc=>view.getUint32(pc-arm.base,true),string=pc=>{const offset=pc-arm.base,end=arm.bytes.indexOf(0,offset);need(offset>=0&&end>=offset,'Source string extent');return new TextDecoder('ascii').decode(arm.bytes.subarray(offset,end));};
 for(const b of bindings)for(const r of b.ranges)need(await sha(arm.bytes.subarray(r.address-arm.base,r.address-arm.base+r.bytes))===r.sha256,'Kind2 source closure changed');
 const format=string(u(0x0203dfc4)),suffix=string(u(0x020367d4));need(format==='data/chara_sub/%s.chr'&&suffix==='.bcfg','Kind2 source resource dispatch changed');
 // 02034078 creates a fresh interpreter and installs this original source
 // table. 0203016c sets fallback+8=0; absent opcodes take the no-callback path.
 const table=new Map();for(let pc=0x020ef938;pc<0x020ef990;pc+=8){const op=u(pc),target=u(pc+4);if(!op){need(pc===0x020ef988&&target===0,'Model table terminator changed');break;}need(!table.has(op),'Duplicate model opcode');table.set(op,{opcode:op,target,tableAddress:pc});}
 need(table.get(100)?.target===0x02033dfc&&table.get(101)?.target===0x02033e24&&table.get(102)?.target===0x02033e2c,'Model handler table changed');
 const nitro=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
 return async function read(input){
  assertProductionATInput(input);const{scenarioPath,npcId}=input??{};need(typeof scenarioPath==='string'&&/^data\/scenario\/[A-Za-z0-9_]+\.npc$/.test(scenarioPath)&&Number.isInteger(npcId)&&npcId>=0&&npcId<=65535,'ROM scenario identity required');
  const scenarioBytes=new Uint8Array(nitro.readFile(scenarioPath)),scenario=readBoundedNarcMembers(scenarioBytes).archive,definitions=[];
  for(let i=0;i<scenario.files.length;i++)if(/npc\.bin$/i.test(scenario.fnt.getFilenameOf(i))){const bytes=scenario.files[i],{calls,pool}=checkedCalls(bytes);for(const c of calls)if(c.opcode===3&&c.args[0]?.type===1&&c.args[0].raw===npcId)definitions.push({c,bytes,pool,member:scenario.fnt.getFilenameOf(i)});}
  need(definitions.length===1,'Unique source NPC definition required');const{c,bytes,pool,member}=definitions[0];need(c.argumentCount===5&&c.args[1].type===1&&c.args[1].raw===2&&c.args[3].type===0,'Kind2 source definition required');
  const modelName=readPoolString(bytes,pool,c.args[3]);need(typeof modelName==='string'&&/^[A-Za-z0-9_]+$/.test(modelName),'Supported source model name required');const modelPath=format.replace('%s',modelName),modelBytes=new Uint8Array(nitro.readFile(modelPath)),archive=readBoundedNarcMembers(modelBytes).archive;
  const configurations=[];for(let i=0;i<archive.files.length;i++)if(archive.fnt.getFilenameOf(i).endsWith(suffix))configurations.push({name:archive.fnt.getFilenameOf(i),bytes:archive.files[i]});need(configurations.length===1,'Unique model configuration required');
  const config=configurations[0],calls=checkedCalls(config.bytes).calls,closedCommands=[],allocationRequests=[],unresolved=[];
  for(const call of calls){const handler=table.get(call.opcode),source={callIndex:call.index,callOffset:call.offset,opcode:call.opcode};
   if(!handler){closedCommands.push({...source,ATCalls:{min:'0',max:'0'},reason:'opcode absent from original handler table; fresh fallback callback remains zero'});continue;}
   if(call.opcode===101){need(call.argumentCount===0,'Unsupported configuration end shape');closedCommands.push({...source,handler:handler.target,ATCalls:{min:'0',max:'0'}});}
   else if(call.opcode===102){need(call.argumentCount===4&&call.args[0].type===0&&call.args.slice(1).every(a=>a.type===2),'Unsupported animation descriptor shape');closedCommands.push({...source,handler:handler.target,ATCalls:{min:'0',max:'0'}});}
   else if(call.opcode===100){need(call.argumentCount===1&&call.args[0].type===1&&call.args[0].raw<=0x7fffffff,'Unsupported allocation declaration');allocationRequests.push({...source,handler:handler.target,allocationCall:0x02034130,capacity:call.args[0].raw,bytes:((BigInt(call.args[0].raw)*36n)&0xffffffffn).toString(),calls:{min:'0',max:null},reason:'One pool allocation; backing allocator source graphs are zero-draw, while pool scheduling is separate'});}
   else unresolved.push({...source,handler:handler.target,reason:'Source handler not modeled by this configuration reader'});
  }
  const result=freeze({schema:'source-kind2-model-configuration-components-v1',romSHA256,definition:{scenarioPath,member,npcId,callIndex:c.index,kind:2,modelName,scenarioSHA256:await sha(scenarioBytes)},model:{path:modelPath,sha256:await sha(modelBytes),configuration:config.name,configurationSHA256:await sha(config.bytes)},sourceHandlers:[...table.values()],closedCommands,allocationRequests,unresolved,modelConfigurationCommandsFullyClassified:unresolved.length===0,
   componentCalls:{nonAllocationHandlers:{min:'0',max:unresolved.length?null:'0'},allocationAndScheduling:{min:'0',max:null}},ordinaryPoolAllocatorFunctions:bindings.filter(b=>[0x020b1894,0x020b18b8].includes(b.root)).map(b=>({entry:b.root,calls:{min:'0',max:'0'},sourceBindings:b.ranges})),
   conditions:['Reached model initialization for this exact ROM NPC definition','Fresh 02034078 interpreter retains source handler table and initialized null fallback','Valid native buffers and normal returns; source configuration stays unchanged during interpretation','Other loader calls, model graphics initialization and interleaved thread/global consumers are outside this component'],
   sourceBindings:bindings,wholeKind2Calls:{min:'0',max:null},conditionsMeasured:false,nativeRuntimePacketConstructed:false,currentATRecovered:false,unknownAlternativeRetained:true});owned.add(result);return result;
 };
}
export function isPreparedKind2ModelComponents(result){return owned.has(result);}
