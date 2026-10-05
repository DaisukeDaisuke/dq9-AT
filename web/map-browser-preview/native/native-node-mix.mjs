/* SPDX-License-Identifier: GPL-2.0-or-later
 * Native SBC NODEMIX position/vector helper. The source program supplies all
 * matrices and weights; no model IDs, pose samples or inverse-bind constants.
 * Source boundary: YDQJ rev0 ARM9 020b7224..020b796c. Native cache is keyed by
 * envelope/node index, not matrix slot, and lasts for one model draw.
 */
const need=(v,m)=>{if(!v)throw Error(m);};
const i32=v=>Number(BigInt.asIntN(32,BigInt(v)));
const integer=v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647;
const matrix=(m,n)=>Array.isArray(m)&&m.length===n&&m.every(integer);
const identity=()=>[4096,0,0,0,0,4096,0,0,0,0,4096,0,0,0,0,4096];
const affine=m=>matrix(m,16)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===4096;
/** Strict command boundary and terms; call only at an SBC instruction boundary.
 * The source advances 3 + 3*termCount bytes. Zero terms enter an undefined
 * native register path and are rejected. Slot31 changes GX error status; its
 * status side effects are not admitted by this position-only replay. No normalization or weight-sum check
 * is invented: each supplied unsigned byte is independently multiplied. */
export function decodeNativeNodeMix(bytes,offset,end=bytes.length){
 need(bytes instanceof Uint8Array&&Number.isSafeInteger(offset)&&Number.isSafeInteger(end)&&offset>=0&&end<=bytes.length&&offset+3<=end,'Truncated native NODEMIX header');
 need(bytes[offset]===9,'Unsupported native NODEMIX option');
 const storeSlot=bytes[offset+1],count=bytes[offset+2],length=3+3*count;
 need(count>0,'Empty native NODEMIX is undefined');need(offset+length<=end,'Truncated native NODEMIX terms');need(storeSlot<31,'Native NODEMIX store slot outside admitted 0..30 stack');
 const terms=Array.from({length:count},(_,i)=>{const at=offset+3+i*3,matrixSlot=bytes[at],nodeIndex=bytes[at+1],weightByte=bytes[at+2];need(matrixSlot<31,'Native NODEMIX restore slot outside admitted 0..30 stack');return {matrixSlot,nodeIndex,weightByte};});
 return {storeSlot,count,length,terms,weightSum:terms.reduce((n,t)=>n+t.weightByte,0)};
}
/** Envelope = inverse position 4x3 followed by inverse direction 3x3, all FX32.
 * Rows are read in GX parameter order and expanded to column-major 4x4. */
export function readNativeEnvelopeMatrices(bytes,model){
 need(bytes instanceof Uint8Array&&model,'Native envelope model bytes required');
 const {offset,size,envelopeOffset}=model,count=model.rawInfo14?.[3],start=offset+envelopeOffset,end=offset+size;
 need([offset,size,envelopeOffset,count].every(Number.isSafeInteger)&&offset>=0&&size>=64&&envelopeOffset>=model.shapeOffset&&envelopeOffset<=size&&count>=0&&count<=255&&end<=bytes.length&&start+84*count<=end,'Native envelope span outside model');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),entries=Array.from({length:count},(_,index)=>{const at=start+84*index,positionFx=identity();for(let c=0;c<4;c++)for(let r=0;r<3;r++)positionFx[c*4+r]=d.getInt32(at+4*(3*c+r),true);const vectorFx=Array.from({length:9},(_,k)=>d.getInt32(at+48+4*k,true));return {index,offset:at,positionFx,vectorFx};});
 return {kind:'source-native-envelope-matrices',start,end,entries,count};
}
/** One fresh context per model draw / pose; never share across animation frames. */
export function createNativeNodeMixContext(){return {kind:'native-node-mix-draw-context',cache:new Map()};}
// GX right multiplication uses one shift after the full dot product, no +0x800.
export function multiplyNativeMixPosition(a,b){
 need(affine(a)&&affine(b),'Affine signed FX32 position matrices required');const out=identity();
 for(let c=0;c<4;c++)for(let r=0;r<3;r++){let sum=0n;for(let k=0;k<4;k++)sum+=BigInt(a[k*4+r])*BigInt(b[c*4+k]);out[c*4+r]=i32(sum>>12n);}return out;
}
export function multiplyNativeMixVector(a,b){
 need(matrix(a,9)&&matrix(b,9),'Signed FX32 direction matrices required');return Array.from({length:9},(_,j)=>{const c=Math.floor(j/3),r=j%3;let sum=0n;for(let k=0;k<3;k++)sum+=BigInt(a[k*3+r])*BigInt(b[c*3+k]);return i32(sum>>12n);});
}
/** Accumulate native GX readback values, also useful for an independent ARM
 * arithmetic comparison. ARM uses SMULL/ASR12 of (weightByte<<4)*component,
 * then ADD modulo32 for every term, rather than rounding a float final sum. */
export function blendNativeNodeMixReadbacks(terms,readbacks){
 need(Array.isArray(terms)&&terms.length>0&&Array.isArray(readbacks)&&readbacks.length===terms.length,'Native NODEMIX readback terms required');
 const positionFx=identity(),hasVector=readbacks.every(x=>x.vectorFx!==null&&x.vectorFx!==undefined),vectorFx=hasVector?Array(9).fill(0):null;
 for(let c=0;c<4;c++)for(let r=0;r<3;r++)positionFx[c*4+r]=0;
 for(let i=0;i<terms.length;i++){const w=terms[i].weightByte,entry=readbacks[i];need(Number.isInteger(w)&&w>=0&&w<=255&&affine(entry.positionFx),'Native NODEMIX weight or position readback invalid');
  for(let c=0;c<4;c++)for(let r=0;r<3;r++){const k=c*4+r;positionFx[k]=i32(BigInt(positionFx[k])+((BigInt(entry.positionFx[k])*BigInt(w))>>8n));}
  if(hasVector){need(matrix(entry.vectorFx,9),'Native NODEMIX vector readback invalid');for(let k=0;k<9;k++)vectorFx[k]=i32(BigInt(vectorFx[k])+((BigInt(entry.vectorFx[k])*BigInt(w))>>8n));}
 }
 return {positionFx,vectorFx};
}
/** Position stack entries already include camera/actor/node. No extra camera,
 * scale or world transform is applied here. Optional vectorStack must preserve
 * GX direction matrices separately (GX SCALE changes position only). Without
 * it this returns position-only and never claims correct NORMAL lighting. */
export function evaluateNativeNodeMix({command,envelopes,positionStack,vectorStack=null,context}){
 need(command?.count===command?.terms?.length&&command.count>0&&Number.isInteger(command.storeSlot)&&command.storeSlot>=0&&command.storeSlot<31,'Decoded native NODEMIX command required');
 need(envelopes?.kind==='source-native-envelope-matrices'&&positionStack instanceof Map&&context?.kind==='native-node-mix-draw-context'&&context.cache instanceof Map&&(vectorStack===null||vectorStack instanceof Map),'Native NODEMIX source envelopes, draw context and stacks required');
 const cacheMisses=[],readbacks=command.terms.map(t=>{need(Number.isInteger(t.nodeIndex)&&t.nodeIndex>=0&&t.nodeIndex<envelopes.entries.length&&Number.isInteger(t.matrixSlot)&&t.matrixSlot>=0&&t.matrixSlot<31,'Native NODEMIX source index outside envelope/stack');
  if(!context.cache.has(t.nodeIndex)){const envelope=envelopes.entries[t.nodeIndex],position=positionStack.get(t.matrixSlot);need(position,'Uninitialized source NODEMIX matrix restore');const positionFx=multiplyNativeMixPosition(position,envelope.positionFx);let vectorFx=null;if(vectorStack){const vector=vectorStack.get(t.matrixSlot);need(vector,'Uninitialized source NODEMIX vector restore');vectorFx=multiplyNativeMixVector(vector,envelope.vectorFx);}context.cache.set(t.nodeIndex,{positionFx,vectorFx});cacheMisses.push(t.nodeIndex);}
  const hit=context.cache.get(t.nodeIndex);need(vectorStack===null||hit.vectorFx!==null,'NODEMIX vector availability changed within one draw');return hit;
 });
 return {...blendNativeNodeMixReadbacks(command.terms,readbacks),storeSlot:command.storeSlot,cacheMisses,source:'ARM9 020b7224..020b796c source NODEMIX; original GX position/vector matrices'};
}
