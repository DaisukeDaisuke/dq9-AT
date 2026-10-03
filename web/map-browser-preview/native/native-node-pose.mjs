const hex=b=>[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
const fxMul=(a,b)=>Number(BigInt.asIntN(32,(BigInt(a)*BigInt(b))>>12n));
const identity=[4096,0,0,0,4096,0,0,0,4096];
export function readNativeNodes(bytes,model,pivotLayout){
 if(!(bytes instanceof Uint8Array)||!(pivotLayout instanceof Uint8Array)||pivotLayout.length!==36)throw new Error('Model bytes and verified native 36-byte pivot table are required');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),base=model.offset+64,end=model.offset+model.sbcOffset,require=(a,n)=>{if(a<base||a+n>end||a+n>bytes.length)throw new Error('Node span outside the native node section');};
 require(base,8);const count=d.getUint8(base+1),entry=base+d.getUint16(base+6,true);require(entry,4);const stride=d.getUint16(entry,true);if(stride!==4)throw new Error('Unsupported native node dictionary width');require(entry+4,count*stride);
 const nodes=[];for(let index=0;index<count;index++){
  const offset=base+d.getUint32(entry+4+index*stride,true);require(offset,4);const flags=d.getUint16(offset,true),headerRotation00=d.getInt16(offset+2,true);let at=offset+4,translation=[0,0,0],rotation=[...identity],scale=[4096,4096,4096],inverseScale=[4096,4096,4096],pivot=null;
  if(!(flags&1)){require(at,12);translation=[0,1,2].map(i=>d.getInt32(at+4*i,true));at+=12;}
  if(!(flags&2)){
   if(flags&8){require(at,4);const slot=(flags&240)>>>4;if(slot>=9)throw new Error('Native pivot index outside the supplied table');const a=d.getInt16(at,true),b=d.getInt16(at+2,true),positions=[...pivotLayout.subarray(slot*4,slot*4+4)];rotation=Array(9).fill(0);rotation[slot]=flags&256?-4096:4096;rotation[positions[0]]=a;rotation[positions[1]]=b;rotation[positions[2]]=flags&512?-b:b;rotation[positions[3]]=flags&1024?-a:a;pivot={slot,a,b,positions};at+=4;}
   else{require(at,16);rotation=[headerRotation00,...Array.from({length:8},(_,i)=>d.getInt16(at+2*i,true))];at+=16;}
  }
  if(!(flags&4)){require(at,24);scale=[0,1,2].map(i=>d.getInt32(at+4*i,true));inverseScale=[0,1,2].map(i=>d.getInt32(at+12+4*i,true));at+=24;}
  nodes.push({index,offset,decodedEnd:at,flags,rawHeaderRotation00:headerRotation00,translationFx12:translation,rotationFx12:rotation,scaleFx12:scale,inverseScaleFx12:inverseScale,pivot,rawHex:hex(bytes.subarray(offset,at)),scope:'Native default joint source only; animation and callback overrides are separate.'});
 }
 return {base,end,count,declaredNodeCount:model.rawInfo14[3],declaredCountMatches:count===model.rawInfo14[3],scalingRule:model.rawInfo14[1],nodes};
}
export function createNativeScalingContext(){return {identityNodes:new Set([0]),cumulative:new Map()};}
export function evaluateNativeNodeScale(node,nodeIndex,parentIndex,rule,context){
 if(![0,2].includes(rule))throw new Error('Native scaling rule outside decoded 0/2 subset');
 let flags=(node.flags&1?4:0)|(node.flags&2?2:0)|(node.flags&4?1:0),compensation=null,cumulative=null;
 if(rule===0)flags|=24;
 else{
  const parentIdentity=context.identityNodes.has(parentIndex),parent=context.cumulative.get(parentIndex);
  if(!parentIdentity&&!parent)throw new Error('Native cumulative parent scale has not been established: '+parentIndex);
  if(!(node.flags&4)){
   context.identityNodes.delete(nodeIndex);
   cumulative=parentIdentity?[...node.scaleFx12,...node.inverseScaleFx12]:[...node.scaleFx12.map((x,i)=>fxMul(x,parent[i])),...node.inverseScaleFx12.map((x,i)=>fxMul(x,parent[i+3]))];
   context.cumulative.set(nodeIndex,cumulative);if(parentIdentity)flags|=24;else compensation=[...parent];
  }else if(parentIdentity){context.identityNodes.add(nodeIndex);flags|=24;}
  else{context.identityNodes.delete(nodeIndex);cumulative=[...parent];context.cumulative.set(nodeIndex,cumulative);compensation=[...parent];}
 }
 return {nodeIndex,parentIndex,rule,flags,translationFx12:node.translationFx12,rotationFx12:node.rotationFx12,scaleFx12:node.scaleFx12,compensationScaleFx12:compensation?.slice(0,3)??null,compensationInverseScaleFx12:compensation?.slice(3,6)??null,cumulativeScaleAndInverseFx12:cumulative,scope:'Default native scale result; no animation/callback state is evaluated.'};
}
export function emitNativeNodeMatrixCommands(pose){
 const result=[],send=(opcode,values)=>result.push({opcode,parameterWords:values.map(v=>v>>>0),signedFx12:[...values]}),f=pose.flags,t=pose.translationFx12,r=pose.rotationFx12;
 if(pose.rule===0){
  if(!(f&4)){if(!(f&2))send(0x19,[...r,...t]);else send(0x1c,t);}else if(!(f&2))send(0x1a,r);
  if(!(f&1))send(0x1b,pose.scaleFx12);
 }else if(pose.rule===2){
  const direct=(f&24)!==0;
  if(!direct)send(0x1b,pose.compensationInverseScaleFx12);
  const translationInMatrix=!(f&4)&&direct;
  if(!(f&4)&&!direct)send(0x1c,t.map((v,i)=>fxMul(v,pose.compensationScaleFx12[i])));
  if(!(f&2)){if(translationInMatrix)send(0x19,[...r,...t]);else send(0x1a,r);}else if(translationInMatrix)send(0x1c,t);
  if(!direct)send(0x1b,pose.compensationScaleFx12);
  if(!(f&1))send(0x1b,pose.scaleFx12);
 }else throw new Error('Unsupported native scaling output callback');
 return result;
}
export function planNativeNodeMatrices(nodeInfo,sbc){
 const context=createNativeScalingContext(),results=[],unresolved=[];
 for(const command of sbc.commands){if(command.opcode!==6)continue;const desc=command.nodeDescription,node=nodeInfo.nodes[desc.nodeIndex];if(!node){unresolved.push({offset:command.offset,reason:'SBC node reference outside node dictionary'});continue;}
  try{const pose=evaluateNativeNodeScale(node,desc.nodeIndex,desc.parentIndex,nodeInfo.scalingRule,context);results.push({offset:command.offset,description:desc,pose,gx:emitNativeNodeMatrixCommands(pose)});}catch(e){unresolved.push({offset:command.offset,reason:e.message});}
 }
 return {results,unresolved,scope:'Default joint callback command plan only; SBC restore/store, BB, animation, visibility, world, clip and rasterization remain separate.'};
}
