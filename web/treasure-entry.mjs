// ROM source records and the measured successful-load treasure entry pass.
// Source order is verified against the C01 native parser/append path. This module
// does not claim container identity, interaction behavior, frame timing or boot proof.
import {Narc} from './vendor/narc-source.js';
import {BufferReader,Compression} from './vendor/nitro-fs.mjs';
import {parseCalls,decodeNumber,u32} from './vendor/call-stream.mjs';

export const TREASURE_ARCHIVE='data/scenario/treasure.nsarc';
const ownFlagsMask=0x007f;
const integerArg=(arg,label)=>{if(arg?.type!==1)throw Error(`${label}: integer argument required`);return arg.raw>>>0;};
const expanded=bytes=>bytes[0]===0x10?Compression.decompress(new BufferReader(bytes.buffer,bytes.byteOffset,bytes.byteLength)):bytes;
function commands(bytes){
 if(bytes.length<16||u32(bytes,4)>bytes.length||u32(bytes,0)>100000)throw Error('Invalid treasure call stream');
 return parseCalls(bytes);
}
function coordinate(arg){
 if(arg?.type===1)return (arg.raw<<12)|0;
 if(arg?.type!==2)throw Error('Unsupported treasure coordinate argument');
 const value=Math.trunc(Math.fround(decodeNumber(arg)*4096));
 if(!Number.isFinite(value)||value<-2147483648||value>2147483647)throw Error('Treasure coordinate outside measured integer range');
 return value;
}
export function decodeTreasureEntries(bytes,memberName){
 const entries=[],unknownOpcodes=[];let resourceTag=null;
 for(const call of commands(bytes)){
  if(call.opcode===100||call.opcode===101)continue;
  if(call.opcode===102){resourceTag=integerArg(call.args[0],'resource tag')&65535;continue;}
  if(call.opcode!==103){unknownOpcodes.push({opcode:call.opcode,offset:call.offset});continue;}
  const packed=integerArg(call.args[0],'entry identity/value'),sourceFlags=integerArg(call.args[1],'entry flags'),kind=(sourceFlags>>>4)&7;
  let position=null,auxiliary=null,coordinateStatus='unreconstructed-kind';
  // Kinds0/1 and their coordinate conversion are paired with actual C01 writes.
  if(kind===0||kind===1){
   const required=kind===0?6:5;if(call.args.length!==required)throw Error('Treasure entry argument count differs from measured branch');
   position=call.args.slice(2,5).map(coordinate);coordinateStatus='decoded-source';
   if(kind===0)auxiliary=(coordinate(call.args[5])<<16)>>16;
   // Kind1's offset6 is not initialized from a declared source argument.
  }
  entries.push({sourceOrder:entries.length,callIndex:call.index,callOffset:call.offset,entryId:packed>>>16,value:packed&65535,sourceFlags:sourceFlags&ownFlagsMask,knownFlagsMask:ownFlagsMask,kind,position,auxiliary,coordinateStatus,rawArguments:call.args.map(a=>({...a}))});
 }
 return {memberName,resourceTag,entries,unknownOpcodes,sourceOrder:'opcode103 order; native successful append preserves order',physicalIdentitiesKnown:false};
}
export function decodeTreasureWeights(bytes,memberName){
 const rows=[],unknownOpcodes=[];let declaredRows=null;
 for(const call of commands(bytes)){
  if(call.opcode===100||call.opcode===101)continue;
  if(call.opcode===106){declaredRows=integerArg(call.args[0],'row count')&65535;continue;}
  if(call.opcode!==105){unknownOpcodes.push({opcode:call.opcode,offset:call.offset});continue;}
  const packed=integerArg(call.args[0],'packed row'),selector=(packed>>>26)&31,type=(packed>>>23)&7,weight=packed&127,value=(packed>>>7)&65535;
  rows.push({sourceOrder:rows.length,callOffset:call.offset,selector,type,weight,value,word:((selector|(type<<5))|(weight<<8)|(value<<16))>>>0});
 }
 if(declaredRows!==rows.length)throw Error('Treasure row count differs from source declaration');
 return {memberName,declaredRows,rows,unknownOpcodes};
}
export function readTreasureSource(nitro,memberName){
 if(typeof memberName!=='string'||!/^[A-Za-z0-9_]+\.bin$/.test(memberName)||memberName.startsWith('rand'))throw Error('An explicit map treasure member is required');
 const archive=Narc.load(new Uint8Array(nitro.readFile(TREASURE_ARCHIVE)));
 const read=name=>{const id=archive.fnt.getIdOf(name);if(id<0)throw Error(`Treasure member absent: ${name}`);return expanded(archive.files[id]);};
 const map=decodeTreasureEntries(read(memberName),memberName),tbox=decodeTreasureWeights(read('randTBox.bin'),'randTBox.bin'),ttt=decodeTreasureWeights(read('randTTT.bin'),'randTTT.bin');
 return {format:'dq9-treasure-entry-source',version:1,archive:TREASURE_ARCHIVE,map,tables:{tbox,ttt},mapBinding:'explicit member; no guessed map-ID binding',origin:'user-loaded-ROM',bootProof:false};
}
export class TreasureEntryKernel {
 constructor(kernel){this.kernel=kernel;}
 consume(state,source,{loadComplete=false,initialFlags=null}={}){
  let position=BigInt(state.position??0),seed=this.kernel.seedAt(state.seed,position);const start=position,outputs=[];
  const finish=(resolved,reason)=>({format:'dq9-treasure-entry-reached-replay',version:1,resolved,reason,scope:'successful treasure resource load only',conditionalOnSuccessfulLoad:true,position:String(position),seed,consumed:Number(position-start),minimumConsumed:Number(position-start),outputs,frameTimingKnown:false,otherConsumersUnresolved:true,bootProof:false});
  if(loadComplete!==true)return finish(false,'Resource load and complete entry construction have not been established');
  if(source?.format!=='dq9-treasure-entry-source'||source.map.unknownOpcodes.length||source.tables.tbox.unknownOpcodes.length||source.tables.ttt.unknownOpcodes.length)return finish(false,'Unsupported resource commands');
  // The source shows a randTBox pass before randTTT. A reached kind4 pass has
  // not been paired here, so never jump over it to return a guessed prefix.
  if(source.map.entries.some(e=>e.kind===4))return finish(false,'Kind4 randTBox reachability/writers remain unverified');
  if(source.map.entries.some(e=>![0,1].includes(e.kind)))return finish(false,'Entry kind outside the measured0/1 scope');
  for(const entry of source.map.entries){
   const beforeFlags=Array.isArray(initialFlags)?initialFlags[entry.sourceOrder]:null;
   const known=Number.isInteger(beforeFlags)?0xffff:ownFlagsMask;
   let flags=Number.isInteger(beforeFlags)?((beforeFlags&~ownFlagsMask)|(entry.sourceFlags&ownFlagsMask))&65535:entry.sourceFlags;
   if(entry.kind===0){outputs.push({entryId:entry.entryId,sourceOrder:entry.sourceOrder,consumed:0,value:entry.value,flags,knownFlagsMask:known,reason:'kind0 skips both random passes'});continue;}
   const eligible=source.tables.ttt.rows.filter(r=>r.selector===entry.value).slice(0,32);
   let selected=null,random=null,roll=null,residual=null;
   if(eligible.length){const pair=this.kernel.generate(state.seed,position,1);seed=pair[0];random=pair[1];position++;roll=this.kernel.e.at_randint(random,100);residual=roll;for(const row of eligible){residual-=row.weight;if(residual<0){selected=row;break;}}}
   flags=(flags&~12)|((selected?.type??0)&3)<<2;
   outputs.push({entryId:entry.entryId,sourceOrder:entry.sourceOrder,selector:entry.value,eligibleCount:eligible.length,consumed:eligible.length?1:0,position:String(position),seed,random,roll,residual,selectedSourceOrder:selected?.sourceOrder??null,value:selected?.value??0,flags,knownFlagsMask:known,reason:eligible.length?(selected?'weighted row selected':'weighted roll selected no row'):'no eligible rows; draw-free source branch'});
  }
  return finish(true,'Measured kind0/1 source records resolved conditional on successful load');
 }
}
