const signed=(value,bits)=>(value<<(32-bits))>>(32-bits);
const view=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
const rawHex=b=>[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
export function decodeNativeSbc(bytes,model){
 const start=model.offset+model.sbcOffset,end=model.offset+model.materialOffset,commands=[],unresolved=[];let at=start,terminated=false,material=null;
 while(at<end){const raw=bytes[at],opcode=raw&31,option=raw&224;let length;
  if(opcode===0||opcode===1||opcode===11)length=1;
  else if(opcode===2)length=3;
  else if(opcode===3||opcode===4||opcode===5)length=2;
  else if(opcode===6)length=4+(option===64||option===96?1:0)+(option===32||option===96?1:0);
  else if(opcode===7||opcode===8)length=2+(option===64||option===96?1:0)+(option===32||option===96?1:0);
  else{unresolved.push({offset:at,opcode,option,reason:'Native handler outside decoded subset',remainingHex:rawHex(bytes.subarray(at,end))});break;}
  if(at+length>end){unresolved.push({offset:at,opcode,reason:'Truncated SBC',remainingHex:rawHex(bytes.subarray(at,end))});break;}
  const c={offset:at,modelOffset:at-model.offset,opcode,option,rawHex:rawHex(bytes.subarray(at,at+length)),length,args:[...bytes.subarray(at+1,at+length)]};
  if(opcode===2)c.nodeVisibility={nodeIndex:c.args[0],visible:Boolean(c.args[1]&1),status:'Raw SBC default; animation/callback override remains separate'};
  if(opcode===3)c.matrixRestore=c.args[0];
  if(opcode===4){material=c.args[0];c.materialIndex=material;}
  if(opcode===5)c.shape={index:c.args[0],lastRawMaterialIndex:material};
  if(opcode===6)c.nodeDescription={nodeIndex:c.args[0],parentIndex:c.args[1],flags:c.args[2],restoreSlot:option===64?c.args[3]:option===96?c.args[4]:null,storeSlot:option===32||option===96?c.args[3]:null};
  if(opcode===7||opcode===8)c.billboard={nodeIndex:c.args[0],axis:opcode===7?'Full native billboard':'Native Y-axis billboard',restoreSlot:option===64?c.args[1]:option===96?c.args[2]:null,storeSlot:option===32||option===96?c.args[1]:null,status:'Boundary decoded from 020b6bb8/020b6ec0; native clip readback, inverse camera/object transforms, callbacks and flags100/200 are not evaluated'};
  if(opcode===11)c.positionScale={inverse:option!==0,status:'Native state flags100/200 may suppress emission'};
  commands.push(c);at+=length;if(opcode===1){terminated=true;break;}
 }
 return {start,end,commands,unresolved,terminated,decodedEnd:at,tailHex:rawHex(bytes.subarray(at,end))};
}
export function readNativeShapes(bytes,model){
 const d=view(bytes),base=model.offset+model.shapeOffset,require=(a,n)=>{if(a<0||a+n>model.offset+model.size||a+n>bytes.length)throw new Error('Shape span outside model');};
 require(base,8);const count=d.getUint8(base+1),entry=base+d.getUint16(base+6,true);require(entry,4);const stride=d.getUint16(entry,true);if(stride!==4)throw new Error('Unsupported shape entry width');require(entry+4,count*stride);
 const rows=[];for(let i=0;i<count;i++){const offset=base+d.getUint32(entry+4+i*stride,true);require(offset,16);const displayListOffset=offset+d.getUint32(offset+8,true),displayListBytes=d.getUint32(offset+12,true);require(displayListOffset,displayListBytes);rows.push({index:i,offset,itemTag:d.getUint16(offset,true),rawHeaderHex:rawHex(bytes.subarray(offset,offset+16)),displayListOffset,displayListBytes});}return rows;
}
// Hardware parameter counts from the supplied core gfx3d_commandTypes; unknown bytes remain explicit.
const parameterCounts=new Map([[16,1],[17,0],[18,1],[19,1],[20,1],[21,0],[22,16],[23,12],[24,16],[25,12],[26,9],[27,3],[28,3],[32,1],[33,1],[34,1],[35,2],[36,1],[37,1],[38,1],[39,1],[40,1],[41,1],[42,1],[43,1],[48,1],[49,1],[50,1],[51,1],[52,32],[64,1],[65,0],[80,1],[96,1],[112,3],[113,2],[114,1]]);
export function decodePackedGx(bytes,start,length){
 const end=start+length,d=view(bytes),commands=[],unresolved=[];let at=start;
 while(at<end){if(at+4>end){unresolved.push({offset:at,reason:'Truncated command word',remainingHex:rawHex(bytes.subarray(at,end))});break;}const packedOffset=at,word=d.getUint32(at,true);at+=4;
  for(let lane=0;lane<4;lane++){const opcode=(word>>>(lane*8))&255;if(opcode===0){commands.push({packedOffset,lane,opcode,parameterWords:[],status:'Packed zero padding/no-op'});continue;}
   if(!parameterCounts.has(opcode)){unresolved.push({offset:packedOffset,lane,opcode,reason:'Unknown GX command; parameter boundary not guessed',remainingHex:rawHex(bytes.subarray(at,end))});return {start,end,decodedEnd:at,commands,unresolved};}
   const count=parameterCounts.get(opcode);if(at+count*4>end){unresolved.push({offset:packedOffset,lane,opcode,reason:'Truncated GX parameters',remainingHex:rawHex(bytes.subarray(at,end))});return {start,end,decodedEnd:at,commands,unresolved};}
   const c={packedOffset,lane,opcode,parameterOffset:at,parameterWords:Array.from({length:count},(_,i)=>d.getUint32(at+4*i,true))};commands.push(c);at+=count*4;
  }
 }
 return {start,end,decodedEnd:at,commands,unresolved};
}
export function decodeLocalVertices(commands){
 let current=[0,0,0],primitive=null,initialized=false;const vertices=[],boundaries=[],unresolved=[];let normal=null,texcoord=null;
 for(let i=0;i<commands.length;i++){const c=commands[i],p=c.parameterWords;
  if(c.opcode===0x40){primitive=p[0]&3;boundaries.push({command:i,type:'begin',primitive,vertexIndex:vertices.length});continue;}
  if(c.opcode===0x41){boundaries.push({command:i,type:'end',primitive,vertexIndex:vertices.length});primitive=null;continue;}
  if(c.opcode===0x21){normal=[0,1,2].map(k=>signed((p[0]>>>(10*k))&1023,10));continue;}
  if(c.opcode===0x22){texcoord=[signed(p[0]&65535,16),signed(p[0]>>>16,16)];continue;}
  let v=null;if(c.opcode===0x23){v=[signed(p[0]&65535,16),signed(p[0]>>>16,16),signed(p[1]&65535,16)];initialized=true;}
  if(c.opcode===0x24){v=[0,1,2].map(k=>signed((p[0]>>>(10*k))&1023,10)<<6);initialized=true;}
  if(c.opcode===0x25)v=[signed(p[0]&65535,16),signed(p[0]>>>16,16),current[2]];
  if(c.opcode===0x26)v=[signed(p[0]&65535,16),current[1],signed(p[0]>>>16,16)];
  if(c.opcode===0x27)v=[current[0],signed(p[0]&65535,16),signed(p[0]>>>16,16)];
  if(c.opcode===0x28)v=current.map((v,k)=>signed((v+signed((p[0]>>>(k*10))&1023,10))&65535,16));
  if(v){current=v;if(!initialized)unresolved.push({command:i,opcode:c.opcode,reason:'Initial native vertex state is required before a partial/relative vertex'});vertices.push({command:i,positionFx12:initialized?[...current]:null,primitive,normalFx9:normal?[...normal]:null,texcoordFx4:texcoord?[...texcoord]:null});}
  else if(c.opcode>=0x10&&c.opcode<=0x1c)unresolved.push({command:i,opcode:c.opcode,reason:'Matrix command retained; model/node/stack transform not applied to local vertex output'});
 }
 return {vertices,boundaries,unresolved,scope:'Raw local coordinates only; matrix/normal/texture/material/animation/rasterization transforms remain separate.'};
}
