// Reached 02074568 preferred-node query. No input/controller schedule, spawn
// position interpolation, visibility, or AT update is inferred here.
import {describeInventorySlot} from './field-inventory.mjs';

const s32=n=>Number(BigInt.asIntN(32,BigInt(n))),u64=n=>BigInt.asUintN(64,n);
const integer=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const xyz=p=>Array.isArray(p)&&p.length===3&&p.every(integer);
const unknown=reason=>({resolved:false,reason,atConsumed:0,visibilityUsed:false});
function sqrt(n){if(n<0n)throw Error('Negative sqrt');if(n<2n)return n;let x=1n<<BigInt((n.toString(2).length+1)>>1);for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
function squared(v){return v.reduce((a,x)=>a+BigInt(x)*BigInt(x),0n);}
// The measured domain avoids signed hardware-divisor/root overflow. Unsupported
// extreme or zero vectors remain conditional rather than using floating point.
export function fieldNativeDistance(a,b){
 if(!xyz(a)||!xyz(b))return null;
 const v=a.map((n,i)=>(n-b[i])|0),sum=squared(v);
 if(sum>=1n<<60n)return null;
 return Number((sqrt(sum*4n)+1n)>>1n);
}
export function fieldNativeNormalize(vector){
 if(!xyz(vector))return null;const sum=squared(vector);
 if(sum===0n||sum>=1n<<60n)return null;
 // 020c49e4: DIV mode2, numerator 2^56, denominator squared length;
 // SQRT mode1 of 4*sum; retain low64 product, then high32 +0x1000 ASR13.
 const factor=u64(((1n<<56n)/sum)*sqrt(sum*4n));
 return vector.map(x=>s32((u64(factor*BigInt(x))>>32n)+0x1000n)>>13);
}
export function fieldNativeDot(a,b){
 if(!xyz(a)||!xyz(b))return null;
 return s32(u64(a.reduce((sum,x,i)=>sum+BigInt(x)*BigInt(b[i]),0x800n))>>12n);
}
export function fieldNativeFacing(angle,trig){
 if(!integer(angle)||!trig||trig.divisor!==25736||!(trig.values instanceof Int16Array)||trig.values.length!==8192)return null;
 const quotient=Math.trunc((angle<<16)/trig.divisor),index=((quotient&65535)>>>4)*2;
 return [trig.values[index],0,trig.values[index+1]];
}

/** Occupancy02074ee4 scans typed actors in the natural 12-slot group, active
 * and whose current graph index resolves to the requested node ID. A known
 * matching actor resolves true even if other slots are unknown; false requires
 * all applicable records to exclude a match. Species/visibility are irrelevant.
 */
export function fieldNodeOccupied(graph,inventory,group,nodeId){
 if(!Array.isArray(graph?.nodes)||!Array.isArray(inventory?.slots)||!Number.isInteger(group)||group<0||group>3)return {resolved:false,occupied:null};
 const bySlot=new Map();for(const r of inventory.slots){if(bySlot.has(r.slot))throw Error('Duplicate inventory slot');bySlot.set(r.slot,r);}
 const checked=[],missing=[];
 for(let slot=112+12*group;slot<124+12*group;slot++){
  const r=describeInventorySlot(bySlot.get(slot)??{slot,registryKnown:false});
  if(r.allocated===false||r.typedActorReadable===false||r.active===false){checked.push(slot);continue;}
  if(r.typedActorReadable!==true||r.active!==true||!Number.isInteger(r.nodeIndex)||r.nodeIndex<0||r.nodeIndex>65535){missing.push(slot);continue;}
  checked.push(slot);const node=graph.nodes[r.nodeIndex];
  if(node?.id===nodeId)return {resolved:true,occupied:true,matchingSlot:slot,checked,missing};
 }
 return {resolved:missing.length===0,occupied:missing.length?null:false,checked,missing};
}

export function queryPreferredFieldNode({queryReached,player,graph,inventory,fieldFlags,trig}={}){
 if(queryReached!==true)return unknown('preferred-node query reachability unknown');
 if(player?.graphEnabled===false)return {resolved:true,nodeIds:[],dots:[],preferredNodeId:-1,reason:'player graph gate clear',atConsumed:0,visibilityUsed:false};
 if(player?.graphEnabled!==true||!xyz(player.position)||!integer(player.angle)||!Number.isInteger(player.nodeIndex))return unknown('player position/actual orientation/current node unknown');
 if(!Array.isArray(graph?.nodes)||!Number.isInteger(fieldFlags)||fieldFlags<0||fieldFlags>65535)return unknown('graph or natural group unknown');
 const current=graph.nodes[player.nodeIndex];
 if(!current)return unknown('current node missing; native nearest-node fallback unresolved');
 if(!Array.isArray(current.neighbors))return unknown('ordered adjacency unknown');
 if(!current.neighbors.length)return {resolved:true,nodeIds:[],dots:[],preferredNodeId:-1,reason:'current node has no neighbours',atConsumed:0,visibilityUsed:false};
 const facing=fieldNativeFacing(player.angle,trig);if(!facing)return unknown('ROM trig resource unknown');
 const candidates=[],occupancy=[];
 for(const index of current.neighbors){
  const node=graph.nodes[index];if(!node)return unknown('adjacent graph node missing');
  const test=fieldNodeOccupied(graph,inventory,fieldFlags&3,node.id);occupancy.push({index,nodeId:node.id,...test});
  if(!test.resolved)return {...unknown('candidate occupancy unknown'),occupancy};
  if(!test.occupied)candidates.push(node);
 }
 const raw=node=>Array.isArray(node.position)&&node.position.length===3&&node.position.every(x=>Number.isInteger(x)&&x>=-32768&&x<=32767)?node.position.map(x=>x<<12):null;
 const currentRaw=raw(current),distance=currentRaw&&fieldNativeDistance(currentRaw,player.position);
 if(distance===null)return unknown('current-node distance outside supported integer domain');
 if(distance>0x5000&&!candidates.some(n=>n.id===current.id)){
  const test=fieldNodeOccupied(graph,inventory,fieldFlags&3,current.id);occupancy.push({index:player.nodeIndex,nodeId:current.id,...test});
  if(!test.resolved)return {...unknown('current-node occupancy unknown'),occupancy};
  if(!test.occupied)candidates.push(current);
 }
 const dots=[],vectors=[];let preferredIndex=-1,best=0;
 for(let i=0;i<candidates.length;i++){
  const position=raw(candidates[i]);if(!position)return unknown('candidate position unknown');
  const difference=position.map((x,j)=>(x-player.position[j])|0),normalized=fieldNativeNormalize(difference);
  if(!normalized)return unknown('normalization outside supported integer domain');
  const dot=fieldNativeDot(facing,normalized);vectors.push({difference,normalized});dots.push(dot);
  if(dot>best){best=dot;preferredIndex=i;}
 }
 return {resolved:true,nodeIds:candidates.map(n=>n.id),nodeIndices:candidates.map(n=>n.index),dots,vectors,facing,currentDistance:distance,occupancy,
  preferredIndex,preferredNodeId:preferredIndex<0?-1:candidates[preferredIndex].id,
  fallbackDrawRequired:preferredIndex<0&&candidates.length>0,atConsumed:0,visibilityUsed:false,
  reason:'reached-source-query',remaining:'scheduler owns fallback AT draw; later spawn geometry remains separate'};
}

/** Extract the actual table from the supplied JP ROM, never ship a copied table.
 * Header-directed ARM9 BLZ decoding mirrors the already independently validated
 * extraction. Fixed addresses are guarded by this known ROM's instruction/data
 * signature. This is not a region/revision-independent ROM discovery routine.
 */
export function preferredNodeTrigFromRom(input){
 const rom=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(rom.buffer,rom.byteOffset,rom.byteLength);
 if(rom.length<0x200)throw Error('NDS header missing');
 const offset=v.getUint32(0x20,true),base=v.getUint32(0x28,true),size=v.getUint32(0x2c,true);
 if(base!==0x02000000||size<8||offset+size>rom.length)throw Error('Unsupported ARM9 layout');
 const raw=rom.subarray(offset,offset+size),rv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 const pointerOffset=v.getUint32(0x70,true)-base-4;
 if(pointerOffset<0||pointerOffset+4>size)throw Error('Module pointer outside ARM9');
 const settings=rv.getUint32(pointerOffset,true)-base;
 if(settings<0||settings+24>size)throw Error('Module settings outside ARM9');
 let decoded=raw;const compressedEnd=rv.getUint32(settings+20,true);
 if(compressedEnd){
  if(compressedEnd!==base+size)throw Error('Unexpected compressed ARM9 end');
  const packed=rv.getUint32(size-8,true),extra=rv.getUint32(size-4,true),header=packed>>>24,span=packed&0xffffff,prefix=size-span;
  if(header<8||header>span||span>size||!extra||size+extra>0x2000000)throw Error('Invalid BLZ header');
  for(let i=size-header;i<size-8;i++)if(raw[i]!==255)throw Error('Invalid BLZ padding');
  decoded=new Uint8Array(size+extra);decoded.set(raw.subarray(0,prefix));let src=size-header,dst=decoded.length;
  while(dst>prefix){if(--src<prefix)throw Error('BLZ flags underflow');const flags=raw[src];for(let bit=7;bit>=0&&dst>prefix;bit--){
   if(flags&(1<<bit)){if(src-2<prefix)throw Error('BLZ reference underflow');const a=raw[--src],b=raw[--src],count=(a>>>4)+3,distance=((a&15)<<8|b)+3;if(dst-count<prefix)throw Error('BLZ output underflow');for(let i=0;i<count;i++){--dst;if(dst+distance>=decoded.length)throw Error('BLZ reference outside output');decoded[dst]=decoded[dst+distance];}}
   else{if(--src<prefix)throw Error('BLZ literal underflow');decoded[--dst]=raw[src];}
  }}if(src!==prefix)throw Error('BLZ bytes remain');
 }
 const d=new DataView(decoded.buffer,decoded.byteOffset,decoded.byteLength);
 if(decoded.length<0xed55c||d.getUint32(0x307cc,true)!==25736||d.getUint32(0x307d0,true)!==0x020e955c||d.getUint32(0x30808,true)!==25736||d.getUint32(0x3080c,true)!==0x020e955c||d.getUint32(0x307a8,true)!==0xe1a00800)throw Error('Unverified preferred-query ROM signature');
 const values=new Int16Array(8192);for(let i=0;i<values.length;i++)values[i]=d.getInt16(0xe955c+2*i,true);
 return {divisor:25736,values,source:{arm9Base:base,tableAddress:0x020e955c,tableBytes:16384,decodedArm9Bytes:decoded.length}};
}
