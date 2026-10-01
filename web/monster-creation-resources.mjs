// Static values from the ordinary JP field loader. Allocation addresses and
// complete list topology remain runtime inputs; successful loading is not guessed.
import {parseCalls,u32} from './vendor/call-stream.mjs';
const need=(ok,why)=>{if(!ok)throw Error(why);};
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const short=n=>(n<<16)>>16;
function stream(bytes,version){
 need(bytes instanceof Uint8Array&&bytes.length>=16&&bytes.length<=2*1024*1024,'invalid creator resource byte stream');
 const count=u32(bytes,0),pool=u32(bytes,4),size=u32(bytes,8);
 need(count<=10000&&pool>=16&&pool<=bytes.length&&size<=bytes.length-pool&&u32(bytes,12)===version,'invalid creator resource header');
 const lastZero=bytes.subarray(pool,pool+size).lastIndexOf(0);
 const calls=parseCalls(bytes.subarray(0,pool));need(calls.endOffset<=pool&&pool-calls.endOffset<16&&bytes.subarray(calls.endOffset,pool).every(b=>b===255),'creator call region has unsupported padding');
 for(const c of calls)for(const a of c.args){need(a.type<=2,'unsupported creator argument type');if(a.type===0){need(a.raw<size,'creator string outside pool');need(a.raw<=lastZero,'unterminated creator string');}if(a.type===2){const v=new DataView(new ArrayBuffer(4));v.setUint32(0,a.raw,true);need(Number.isFinite(v.getFloat32(0,true)),'non-finite creator argument');}}
 return calls;
}
const shape=(c,types)=>need(c.args.length===types.length&&c.args.every((a,i)=>(Array.isArray(types[i])?types[i]:[types[i]]).includes(a.type)),'unsupported creator opcode shape');

/** 0209dc50 selects the ordinary encmons map row. Nonzero story ranges and
 * additional loader members require their separate runtime interpretation. */
export function decodeCreatorMapSpecies(bytes,mapId){
 need(uint(mapId,65535),'invalid creator map ID');let selected=null;
 for(const c of stream(bytes,0)){
  need(c.opcode===102&&c.args.length>=2&&c.args.every(a=>a.type===1),'unsupported encmons record');
  if(c.args[0].raw!==mapId)continue;
  need(selected===null&&c.args[1].raw===0,'conditional or ambiguous creator species list');
  selected=[];
  for(const a of c.args.slice(2))for(const id of [a.raw>>>16,a.raw&65535])if(id&&selected.length<12)selected.push(short(id));
 }
 need(selected!==null&&selected.length>0,'creator map species list absent');return selected;
}

/** 02070374 copies selected 20-byte mons_data2 records in sorted unique order.
 * Only the first two string pointers are relocated; +8/+c/+e remain signed16. */
export function decodeCreatorModelRecords(bytes){
 need(bytes instanceof Uint8Array&&bytes.length>=4&&bytes.length<=2*1024*1024,'invalid model resource bytes');
 const word=u32(bytes,0),count=word&4095,poolBytes=(word&0x7fffffff)>>>12,pool=4+count*20;
 need((word>>>31)===0&&pool<=bytes.length&&poolBytes===bytes.length-pool,'invalid model array/pool extent');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),records=[],lastZero=bytes.subarray(pool).lastIndexOf(0);let previous=-32769;
 for(let i=0;i<count;i++){
  const at=4+i*20,speciesKey=v.getInt16(at+8,true);need(speciesKey>previous,'model keys are not strictly ordered');previous=speciesKey;
  for(const o of [0,4]){const offset=v.getInt32(at+o,true);if(offset===-1)continue;need(offset>=0&&offset<poolBytes,'model string offset outside pool');need(offset<=lastZero,'unterminated model string');}
  records.push({speciesKey,widthShort:v.getInt16(at+12,true),heightShort:v.getInt16(at+14,true),sourceOffset:at});
 }
 return records;
}

/** 0206fe98 stores the integer low bytes and flags, then 02070040 prepends.
 * Speed mode zero clears route mode bits before the descriptor is inserted. */
export function decodeCreatorAIRecords(bytes){
 const records=[];let declared=null;
 for(const c of stream(bytes,2)){
  if(c.opcode===102||c.opcode===103){shape(c,[0]);need(declared===null,'late AI resource metadata');continue;}
  if(c.opcode===100){shape(c,[1]);need(declared===null&&c.args[0].raw<=4095,'invalid AI count');declared=c.args[0].raw;continue;}
  need(c.opcode===101&&declared!==null,'unsupported AI resource command');shape(c,[1,1,1,1,[1,2],1,1]);
  const species=short(c.args[0].raw),byte2=c.args[1].raw&255,signedByte3=(c.args[2].raw<<24)>>24;let flags=c.args[3].raw;
  if(((flags>>>3)&7)===0)flags=(flags&0xfffffff8)>>>0;
  records.push({species,byte2,signedByte3,flags,sourceOffset:c.offset});
 }
 need(declared!==null&&records.length===declared&&new Set(records.map(r=>r.species)).size===records.length,'incomplete or duplicate AI records');return records;
}

export function mineCreatorResources(nitro,mapId){
 const species=decodeCreatorMapSpecies(new Uint8Array(nitro.readFile('data/prm/encmons.bin')),mapId),selected=new Set(species);
 const models=decodeCreatorModelRecords(new Uint8Array(nitro.readFile('data/prm/mons_data2.nat'))).filter(r=>selected.has(r.speciesKey));
 const ai=decodeCreatorAIRecords(new Uint8Array(nitro.readFile('data/prm/fld_mons_data.bin'))).filter(r=>selected.has(r.species)).reverse();
 need(models.length===selected.size&&ai.length===selected.size,'selected creator descriptor absent');
 return {species,models,ai};
}

/** Bind static contents to the caller's complete loaded allocation containers.
 * Supplied legacy values are checked, never silently overwritten on conflict. */
export function bindCreatorResources(resources,fieldPointer,mined){
 need(uint(fieldPointer)&&fieldPointer>0&&fieldPointer+0x314<=0x100000000,'invalid creator field allocation');
 const model=resources?.models,ai=resources?.ai;
 const modelAbsent=model?.basePointer===0&&model.declaredCount===0;
 need(model&&uint(model.basePointer)&&(modelAbsent||(model.basePointer>0&&model.declaredCount===mined.models.length&&model.basePointer+model.declaredCount*20<=0x100000000)),'complete ROM-sized model allocation or explicit null allocation required');
 need(model.containerPointer===fieldPointer+0x2f4&&ai?.containerPointer===fieldPointer+0x300,'creator containers are not field-bound');
 if(model.entries!==undefined)need(dense(model.entries)&&model.entries.length===model.declaredCount,'incomplete model entries');
 const agree=(given,key,value)=>need(!Object.hasOwn(given,key)||given[key]===value,'runtime '+key+' conflicts with ROM creator resource');
 const entries=(modelAbsent?[]:mined.models).map((r,i)=>{const values={index:i,pointer:model.basePointer+i*20,speciesKey:r.speciesKey,widthShort:r.widthShort,heightShort:r.heightShort},given=model.entries?.[i];if(model.entries!==undefined){need(given&&typeof given==='object','invalid model binding');for(const [key,value]of Object.entries(values))agree(given,key,value);}return {...given,...values};});
 const aiAbsent=ai.head===0&&dense(ai.records)&&ai.records.length===0;
 need(aiAbsent||(uint(ai.head)&&ai.head>0&&dense(ai.records)&&ai.records.length===mined.ai.length),'complete ROM-sized AI allocation list or explicit empty head required');
 const byPointer=new Map();for(const r of ai.records){need(r&&uint(r.pointer)&&r.pointer>0&&r.pointer+20<=0x100000000&&uint(r.next)&&!byPointer.has(r.pointer),'invalid AI allocation/link');byPointer.set(r.pointer,r);}
 const records=[],seen=new Set();let pointer=ai.head;
 for(const value of aiAbsent?[]:mined.ai){const given=byPointer.get(pointer);need(given&&!seen.has(pointer),'incomplete/cyclic AI links');seen.add(pointer);for(const key of ['species','byte2','signedByte3','flags'])agree(given,key,value[key]);records.push({...given,species:value.species,byte2:value.byte2,signedByte3:value.signedByte3,flags:value.flags});pointer=given.next;}
 need(pointer===0&&seen.size===byPointer.size,'extra or unterminated AI allocation');
 return {models:{...model,entries},ai:{...ai,records}};
}
