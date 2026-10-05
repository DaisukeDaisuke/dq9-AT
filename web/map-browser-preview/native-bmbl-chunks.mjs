// Static subset derived from BMBL opcode65 -> 0201c550 -> 0201e090.
// Defined ID/position/string prefix only; copied stack padding/tail are not fabricated.
export function decodeBmblChunk(call){
 if(call.opcode!==0x65)return null;
 if(![5,6,7].includes(call.argumentCount))return{supported:false,reason:'Unverified opcode65 argument count',rawCall:call};
 const expected=[1,2,2,2,0,0,0];if(call.args.some((a,i)=>a.type!==expected[i]))return{supported:false,reason:'Unverified opcode65 argument tags',rawCall:call};
 const values=call.args.map(a=>a.value),names=values.slice(4);if(names[0]===null)return{supported:false,reason:'Native skips null primary name',rawCall:call};
 if(names.some(n=>n!==null&&(typeof n!=='string'||! /^[\x00-\x7f]*$/.test(n)||n.length>15||n.includes('\0'))))return{supported:false,reason:'Name outside bounded16byte native field subset',rawCall:call};
 const nativePositionFx=values.slice(1,4).map(x=>{const y=Math.trunc(Math.fround(Math.fround(x)*4096));if(!Number.isFinite(y)||y< -2147483648||y>2147483647)throw Error('Position conversion outside verified signed range');return y;});
 return {supported:true,sourceCallIndex:call.index,sourceCallOffset:call.offset,id:values[0]|0,nativePositionFx,primaryName:names[0],secondaryName:names[1]??'',tertiaryName:names[2]??'',rawCall:call,scope:'Defined chunk fields; native capacity, active chunk selection, world propagation and uninitialized tail are not inferred.'};
}
export function matchNativeChunkStreams(chunks,members){
 const rows=[];for(const member of members){if(!member.toLowerCase().endsWith('.bmdj'))continue;for(const chunk of chunks){if(!chunk.supported)continue;if(member.includes(chunk.primaryName))rows.push({member,chunkId:chunk.id,sourceCallIndex:chunk.sourceCallIndex,sourceCallOffset:chunk.sourceCallOffset,nativePositionFx:chunk.nativePositionFx,primaryName:chunk.primaryName});}}
 return rows; // Native02004158 is case-sensitive substring matching, not global resource-name guessing.
}
