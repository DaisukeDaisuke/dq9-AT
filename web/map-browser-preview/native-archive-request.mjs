// YDQJ FUN02014374 + predicates0201b328/0201b350, static-derived request only.
// Read strings/constants from the caller's ROM; do not embed extracted tables.
export function readArchiveRequestRules(sdk){
 const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const cstring=a=>{const b=sdk.read(a,80),end=b.indexOf(0);if(end<0||b.subarray(0,end).some(x=>x>127))throw Error('Bounded native ASCII literal required');return new TextDecoder('ascii').decode(b.subarray(0,end));};
 return {grottoStart:word(0x0201b34c),grottoSpan:0x5f,otherStart:word(0x0201b374),otherSpan:0x194,dualMapId:word(0x020144b8),directory:cstring(word(0x020144b0)),formats:{grotto:cstring(word(0x020144ac)),other:cstring(word(0x020144b4)),dualFirst:cstring(word(0x020144bc)),dualSecond:cstring(word(0x020144c0)),ordinary:cstring(word(0x020144c4))}};
}
export function nativeArchiveRequest({mapId,nativeFieldCode,phase,grottoVariant},rules){
 if(!Number.isInteger(mapId)||mapId<0||mapId>65535)throw Error('Native map ushort required');
 let kind='ordinary',value=nativeFieldCode,nextPhase=phase;
 if(mapId>=rules.grottoStart&&mapId<=rules.grottoStart+rules.grottoSpan){if(!(Number.isInteger(grottoVariant)&&grottoVariant>=-2147483648&&grottoVariant<=2147483647))return{supported:false,reason:'Current generated-map variant required'};kind='grotto';value=grottoVariant===0?1:grottoVariant>5?5:grottoVariant;}
 else if(mapId>=rules.otherStart&&mapId<=rules.otherStart+rules.otherSpan){if(!(Number.isInteger(grottoVariant)&&grottoVariant>=-2147483648&&grottoVariant<=2147483647))return{supported:false,reason:'Current generated-map variant required'};kind='other';value=grottoVariant;}
 else{if(typeof nativeFieldCode!=='string'||!nativeFieldCode.length||nativeFieldCode.length>6||!/^[A-Za-z0-9_]+$/.test(nativeFieldCode))throw Error('Explicit native six-byte field code required');if(mapId===rules.dualMapId||mapId===rules.dualMapId+100){if(phase!==0&&phase!==1)return{supported:false,reason:'Dual-archive phase outside observed initialization branches'};kind=phase===0?'dualFirst':'dualSecond';nextPhase=phase+1;}}
 const format=rules.formats[kind];let slot=0;const args=[rules.directory,value],path=format.replace(/%[sd]/g,()=>String(args[slot++]));if(slot!==2||path.includes('%'))throw Error('Unexpected native archive format');
 return {supported:true,path,kind,nextPhase,scope:'Static-derived native request branch; current context/variant and dynamic load completion are separate.'};
}
