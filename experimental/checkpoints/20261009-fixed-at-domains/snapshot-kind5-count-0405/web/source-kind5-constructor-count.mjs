// Conditional local constructor count. Unsupported contexts retain unknown.
import {ACTOR_ROM_SHA256} from './actor-rom-mining.mjs';
import {readArm9SdkImage} from './map-browser-preview/rom-arm9.mjs';
import {decodeMapEntryOverlay} from './map-entry-source-binding.mjs';
import {NitroFS} from './vendor/nitro-fs.mjs';
import {readBoundedNarcMembers} from './map-exits.mjs';
import {parseCalls} from './vendor/call-stream.mjs';
import {assertProductionATInput} from './production-at-input-policy.mjs';
import {KIND5_CONSTRUCTOR_BINDING} from './source-kind5-constructor-binding.mjs';
const owned=new WeakSet(),need=(p,m)=>{if(!p)throw Error(m);};
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
function checkedCalls(bytes){need(bytes instanceof Uint8Array&&bytes.length>=16,'Source call stream required');const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=v.getUint32(0,true),pool=v.getUint32(4,true),size=v.getUint32(8,true);need(pool>=16&&pool+size<=bytes.length&&count<=Math.floor((pool-16)/4),'Call stream bounds');const calls=parseCalls(bytes);need(calls.endOffset<=pool,'Calls overlap string pool');return calls;}
export async function createSourceKind5ConstructorCountReader({rom,romSHA256}){
 need(rom instanceof Uint8Array&&romSHA256===ACTOR_ROM_SHA256&&await sha(rom)===romSHA256,'Verified original ROM required');
 const sdk=readArm9SdkImage(rom),overlay=decodeMapEntryOverlay(rom),images=[...sdk.segments.map(s=>({address:s.address,bytes:s.bytes})),{address:overlay.base,bytes:overlay.bytes}];
 for(const binding of KIND5_CONSTRUCTOR_BINDING.sourceImages){const matching=images.filter(s=>s.address===binding.address&&s.bytes.length===binding.bytes);need(matching.length===1&&await sha(matching[0].bytes)===binding.sha256,'Kind5 constructor source image changed');}
 const nitro=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
 return function read(input){
  assertProductionATInput(input);const{scenarioPath,npcId}=input??{};need(typeof scenarioPath==='string'&&/^data\/scenario\/[A-Za-z0-9_]+\.npc$/.test(scenarioPath)&&Number.isInteger(npcId)&&npcId>=0&&npcId<=255,'Source scenario/NPC identity required');
  const archive=readBoundedNarcMembers(new Uint8Array(nitro.readFile(scenarioPath))).archive,definitions=[],places=[];
  for(let i=0;i<archive.files.length;i++){const name=archive.fnt.getFilenameOf(i),calls=checkedCalls(archive.files[i]);if(/npc\.bin$/i.test(name)){for(const c of calls)if(c.opcode===3&&c.args[0]?.type===1&&c.args[0].raw===npcId)definitions.push(c);}else if(/place\.bin$/i.test(name))places.push(...calls);else throw Error('Unclassified scenario member');}
  need(definitions.length===1,'Unique source NPC definition required');const definition=definitions[0];need(definition.argumentCount===5&&definition.args[1].type===1&&definition.args[1].raw===5&&definition.args[2].type===0&&definition.args[2].raw===0xffffffff&&definition.args[3].type===0&&definition.args[4].type===1&&[0,1].includes(definition.args[4].raw),'Unsupported kind5 definition flags/shape');
  const creators=[];
  for(const c of places){let idIndex=null;
   if(c.opcode===3){need([2,6,7].includes(c.argumentCount),'Unsupported place3 shape');idIndex=1;}
   else if(c.opcode===4){need([6,10,11].includes(c.argumentCount),'Unsupported place4 shape');idIndex=5;}
   else if(c.opcode===5){need([9,13,14].includes(c.argumentCount),'Unsupported place5 shape');idIndex=8;}
   else if(c.opcode===14){need([5,9,10].includes(c.argumentCount),'Unsupported quest placement shape');need(c.args[4]?.raw!==npcId,'Quest creator not covered for this NPC');continue;}
   else if(c.opcode===17){need([9,10].includes(c.argumentCount),'Only single-condition event placement covered');idIndex=4;}
   else if(c.opcode===18){need([2,3].includes(c.argumentCount)&&c.args[0]?.type===1&&c.args[1]?.type===1,'Visibility modifier shape');continue;}
   else if([6,8,11].includes(c.opcode)){need(c.args[0]?.type===1&&c.args[0].raw!==npcId,'Placement modifier prevents fresh-default kind5 count');continue;}
   else throw Error('Unmodeled placement opcode '+c.opcode);
   need(c.args[idIndex]?.type===1,'Placement identity type');if(c.args[idIndex].raw===npcId)creators.push({callIndex:c.index,callOffset:c.offset,opcode:c.opcode,argumentCount:c.argumentCount});
  }
  need(creators.length>0,'Source placement declarations required');
  const conditions=[
   'This source-selected kind5 NPC is present and its one descriptor reaches 0203d654; common controller and kind5 object allocations succeed',
   'Placement is freshly initialized by 0206d080 through admitted source creators; optional opcode18 changes only bits3..5 at+0a and scale+60; no other writer precedes this constructor',
   'All reached filesystem operations use admitted memory-archive/default read/write callback families; cold ROM filesystem/custom callback paths remain in the unknown alternative',
   'The standard BIOS SWI17 performs only bounded LZ77 decompression into a successfully allocated nonoverlapping buffer, without a game-code callback',
   'Fresh model configuration interpreter retains original table 020ef938, null fallback callback and the zero optional model callback argument',
   'Pool backing allocator is the original ordinary expandable/frame allocator family; graphics callbacks retain original defaults or original SDK initializer assignments',
   'Animation and VRAM dispatch tables retain original contents and valid native resource selector ranges; string conversion retains the original locale callback',
   'The reached SDK DMA calls retain their source zero callback argument',
   'Any allocator reschedule reaches 020c8eb8 with current thread equal to selected thread or selected thread null; no thread-switch hook runs in this conditional branch',
   'No interleaved interrupt, thread, actor/global consumer or seed setter occurs within the local descriptor span; native objects and buffers are valid',
  ];
  const result=freeze({schema:'source-conditional-kind5-NPC-constructor-count-v1',romSHA256,definition:{scenarioPath,npcId,callIndex:definition.index,kind:5},placementCreators:creators,
   sourceDefaults:{initializer:0x0206d080,flagsAt0c:0,optionalResource54:0,optionalResource58:0,bit7At0a:false,scope:'source initializer and admitted creator writers only; not a sampled runtime packet'},
   presentSuccessBranch:{calls:{min:'1',max:'1'},controllerCalls:1,actorInitializerCalls:0,modelAndTailCalls:0,scope:{start:0x0203d654,endExclusive:0x0203df94},conditions},
   absentBranch:{calls:{min:'0',max:'0'},condition:'Source-selected membership alternative excludes this descriptor'},
   unknownBranch:{calls:{min:'0',max:null},reason:'Runtime registration, allocation failure, other initializer/writer, or interleaving alternatives are not certified by source-only membership'},
   sourceBinding:KIND5_CONSTRUCTOR_BINDING,conditionsMeasured:false,descriptorPresentMeasured:false,sourceClockKnown:false,wholeWorldGapResolved:false,currentATRecovered:false,unknownAlternativeRetained:true});owned.add(result);return result;
 };
}
export function isPreparedKind5ConstructorCount(result){return owned.has(result);}
