/* Isolated source SBC decoder extension; existing map decoder/guards remain unchanged. */
import {decodeNativeNodeMix} from './monster-native-node-mix.mjs?v=native-body-20261006-0212';
const rawHex=b=>[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
export function decodeNativeBodySbc(bytes,model){
 const start=model.offset+model.sbcOffset,end=model.offset+model.materialOffset,commands=[],unresolved=[];let at=start,terminated=false,material=null;
 while(at<end){const raw=bytes[at],opcode=raw&31,option=raw&224;let length,nodeMix;
  if(opcode===0||opcode===1||opcode===11)length=1;
  else if(opcode===2)length=3;
  else if(opcode===3||opcode===4||opcode===5)length=2;
  else if(opcode===6)length=4+(option===64||option===96?1:0)+(option===32||option===96?1:0);
  else if(opcode===7||opcode===8)length=2+(option===64||option===96?1:0)+(option===32||option===96?1:0);
  else if(opcode===9){try{nodeMix=decodeNativeNodeMix(bytes,at,end);length=nodeMix.length;}catch(error){unresolved.push({offset:at,opcode,option,reason:error.message,remainingHex:rawHex(bytes.subarray(at,end))});break;}}
  else{unresolved.push({offset:at,opcode,option,reason:'Native handler outside decoded subset',remainingHex:rawHex(bytes.subarray(at,end))});break;}
  if(at+length>end){unresolved.push({offset:at,opcode,reason:'Truncated SBC',remainingHex:rawHex(bytes.subarray(at,end))});break;}
  const c={offset:at,modelOffset:at-model.offset,opcode,option,rawHex:rawHex(bytes.subarray(at,at+length)),length,args:[...bytes.subarray(at+1,at+length)]};
  if(opcode===9)c.nodeMix=nodeMix;
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
