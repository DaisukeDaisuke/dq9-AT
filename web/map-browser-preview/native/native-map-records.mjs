export const MODEL_TAGS=[1,0,1,1];
export const PLACEMENT_TAGS=[1,1,2,2,2,1,0,2,2,2,2,2,2,1];
function shape(c,opcode,tags){if(c.opcode!==opcode||c.argumentCount!==tags.length||c.args.some((a,i)=>a.type!==tags[i]))throw new Error('Unsupported canonical command shape at '+c.offset);}
const signed16=x=>(x<<16)>>16;
export function decodeNativeModel(c){
 if(![2,3,4].includes(c.argumentCount))throw new Error('Unsupported native model argument count at '+c.offset);shape(c,0x6c,MODEL_TAGS.slice(0,c.argumentCount));const v=c.args.map(a=>a.value);if(typeof v[1]!=='string')throw new Error('Null model name');const flags=c.argumentCount>2?v[2]&63:0,mask=c.argumentCount>3?v[3]&255:0;
 return {callIndex:c.index,callOffset:c.offset,id:signed16(v[0]),name:v[1],nativeFlags:flags,nativeMask:mask,nativeBranch:v[1][3]==='A'?'name-char3-A / 02014f00':(flags&16)?'flag0x10 / 02014f98':'static-model / 02014b4c'};
}
export function decodeNativePlacement(c,multiplier){
 if(![7,10,13,14].includes(c.argumentCount))throw new Error('Unsupported native placement argument count at '+c.offset);shape(c,0x6f,PLACEMENT_TAGS.slice(0,c.argumentCount));if(multiplier!==4096)throw new Error('Native multiplier differs from analyzed version');const v=c.args.map(a=>a.value),sourceScale=c.argumentCount>10?v.slice(7,10):[1,1,1],sourceRotation=c.argumentCount>7?v.slice(c.argumentCount>10?10:7,c.argumentCount>10?13:10):[0,0,0],rawFlags=c.argumentCount>13?v[13]:null;
 const convert=x=>{if(!Number.isFinite(x))throw new Error('Nonfinite conversion is outside observed range');return Math.trunc(Math.fround(Math.fround(x)*multiplier));};
 const p={callIndex:c.index,callOffset:c.offset,id:v[0]&65535,modelId:signed16(v[1]),parentId:signed16(v[5]),stringArgument6:{value:v[6],status:'Getter return discarded in 0201eb7c; raw source retained'},rawFlags,nativeFlags:rawFlags===null?15:(rawFlags&255)^0x30,sourcePosition:v.slice(2,5),sourceScale,sourceRotation,nativePosition:v.slice(2,5).map(x=>convert(x)|0),nativeRotation:sourceRotation.map(x=>signed16(convert(x))),nativeScale:sourceScale.map(x=>signed16(convert(x)))};
 const bytes=new Uint8Array(32),d=new DataView(bytes.buffer);d.setUint16(0,p.id,true);d.setInt16(2,p.modelId,true);d.setInt16(4,p.parentId,true);d.setUint16(6,p.nativeFlags,true);p.nativePosition.forEach((x,i)=>d.setInt32(8+4*i,x,true));p.nativeRotation.forEach((x,i)=>d.setInt16(20+2*i,x,true));p.nativeScale.forEach((x,i)=>d.setInt16(26+2*i,x,true));p.nativeRecordHex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return p;
}
export function makeNativeTrig(table,cycle){
 if(!(table instanceof Uint8Array)||table.byteLength!==16384||cycle!==25736)throw new Error('Verified native trig bytes and cycle required');
 const d=new DataView(table.buffer,table.byteOffset,table.byteLength);
 return angle=>{const shifted=BigInt.asIntN(32,BigInt(angle)<<16n),q=Number(shifted/BigInt(cycle)),i=(q&65535)>>>4;return {sin:d.getInt16(i*4,true),cos:d.getInt16(i*4+2,true)};};
}
export function normalizeNativeAngle(angle,cycle=25736){
 if(!Number.isInteger(angle)||cycle!==25736)throw new Error('Native angle required');
 const divide=a=>Number(BigInt.asIntN(32,(((BigInt(a)<<32n)/BigInt(cycle))+0x80000n)>>20n));
 const multiply=q=>Number(BigInt.asIntN(32,(BigInt(cycle)*BigInt(q)+0x800n)>>12n));
 if(angle<0)return (angle+multiply((divide((-angle)|0)+4096)&~4095))|0;
 if(angle>cycle)return (angle-multiply(divide(angle)&~4095))|0;return angle;
}
const i32=n=>Number(BigInt.asIntN(32,n)),fx=(a,b,round)=>i32((BigInt(a)*BigInt(b)+(round?2048n:0n))>>12n);
export function deriveNativeWorld(placements,{rootPosition=[0,0,0],rootScale=[4096,4096,4096],rootYaw=0,trig,cycle=25736}){
 if(typeof trig!=='function')throw new Error('Native trig function required');const byId=new Map(placements.map(p=>[p.id,p]));if(byId.size!==placements.length)throw new Error('Duplicate IDs cannot be resolved');const done=new Map(),active=new Set();
 const visit=p=>{if(done.has(p.id))return done.get(p.id);if(active.has(p.id))throw new Error('Parent cycle');active.add(p.id);let parent={position:rootPosition,scale:rootScale,yaw:rootYaw};if(p.parentId>=0){const q=byId.get(p.parentId);if(!q)throw new Error('Missing parent '+p.parentId);parent=visit(q);}
  const {sin,cos}=trig(parent.yaw),[x,y,z]=p.nativePosition;
  // FUN020c3290 rotates local position without multiplying parent scale.
  const rotated=[i32((BigInt(x)*BigInt(cos)+BigInt(z)*BigInt(sin))>>12n),y|0,i32((BigInt(z)*BigInt(cos)-BigInt(x)*BigInt(sin))>>12n)];
  const r={id:p.id,position:rotated.map((v,i)=>(v+parent.position[i])|0),scale:p.nativeScale.map((v,i)=>fx(v,parent.scale[i],true)),yaw:normalizeNativeAngle(parent.yaw+p.nativeRotation[1],cycle)};
  done.set(p.id,r);active.delete(p.id);return r;};
 return placements.map(visit);
}
