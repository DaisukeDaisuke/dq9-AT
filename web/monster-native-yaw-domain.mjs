// Exact native-renderer yaw equivalence, not a fitted angular sampling grid.
// The decoded Float64 envelope path is deliberately outside this equivalence.
const need=(v,m)=>{if(!v)throw Error(m);};
const cycle=25736,indices=4096;
export function nativeYawIndex(angleFx){need(Number.isInteger(angleFx)&&angleFx>=-2147483648&&angleFx<=2147483647,'Signed32 native yaw required');const q=Number(BigInt.asIntN(32,BigInt(angleFx)<<16n)/BigInt(cycle));return(q&65535)>>>4;}
const reverse12=n=>{let result=0;for(let i=0;i<12;i++){result=(result<<1)|(n&1);n>>>=1;}return result;};
export function deriveNativeYawClasses(table){
 need(table instanceof Uint8Array&&table.byteLength===16384,'Exact source native trig table required');const d=new DataView(table.buffer,table.byteOffset,table.byteLength),byPair=new Map(),indexToClass=[];
 for(let index=0;index<indices;index++){
  const sin=d.getInt16(index*4,true),cos=d.getInt16(index*4+2,true),key=sin+','+cos,minFx=Math.ceil(index*cycle/indices),maxFx=Math.ceil((index+1)*cycle/indices)-1;
  let row=byPair.get(key);if(!row){row={classId:byPair.size,representativeFx:minFx,trigIndices:[],angleRanges:[]};byPair.set(key,row);}row.trigIndices.push(index);row.angleRanges.push({minFx,maxFx});indexToClass[index]=row.classId;
 }
 const classes=[...byPair.values()];classes[indexToClass[0]].angleRanges.push({minFx:cycle,maxFx:cycle});const seen=new Set(),order=[];for(let i=0;i<indices;i++){const id=indexToClass[reverse12(i)];if(!seen.has(id)){seen.add(id);order.push(id);}}
 return{kind:'source-native-yaw-equivalence-v1',cycle,trigIndices:indices,classes,indexToClass,order,normalizedIntegerAngles:cycle+1,sourceAngleDomain:'normalized-integer-0-through-cycle',actorNormalizationObserved:false,decodedEnvelopeCovered:false,currentYawKnown:false};
}
export async function readNativeYawDomain(sdk){
 need(sdk?.read,'Original source SDK reader required');const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 // Existing preferredNodeTrigFromRom source signatures, without decoding ROM twice.
 for(const[a,v]of [[0x020307a8,0xe1a00800],[0x020307cc,cycle],[0x020307d0,0x020e955c],[0x02030808,cycle],[0x0203080c,0x020e955c]])need(word(a)===v,'Native yaw source conversion/table binding differs');
 const table=sdk.read(0x020e955c,16384),domain=deriveNativeYawClasses(table),digest=await crypto.subtle.digest('SHA-256',table);return{...domain,source:{tableAddress:0x020e955c,tableBytes:table.byteLength,tableSHA256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join(''),sourceSignatureVerified:true}};
}
export function nativeYawCondition(domain,row){return{kind:'conditional-native-emitted-yaw-class',classId:row.classId,trigIndices:row.trigIndices.slice(),representativeFx:row.representativeFx,normalizedAngleRanges:structuredClone(row.angleRanges),cycle:domain.cycle,sourceAngleDomain:domain.sourceAngleDomain,actorNormalizationObserved:false,source:structuredClone(domain.source),currentYawKnown:false,decodedEnvelopeCovered:false,equivalenceScope:'Fixed source model, stored pose, scale, root, camera, material and callback assumptions; native sin/cos pair only'};}
