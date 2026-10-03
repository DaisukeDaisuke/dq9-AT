// Native maplist9 opcode67 -> ordinary field camera preset selector.
// Raw arguments are supplied by the unchanged formal call-stream decoder.
export function mapCameraRecord(call,decodeNumber){
 if(call.opcode!==0x67)return null;
 if(call.argumentCount!==22)return {supported:false,reason:'opcode67 argument count differs from verified22',callIndex:call.index,callOffset:call.offset,argumentCount:call.argumentCount,rawCall:call};
 const indices=[0,1,3,9,10,12],values={};
 for(const index of indices){const a=call.args[index];if(a.type!==1)return {supported:false,reason:'integer argument layout not verified',argumentIndex:index,argumentType:a.type,callIndex:call.index,callOffset:call.offset,rawCall:call};values[index]=decodeNumber(a);}
 const selector=(values[10]&3),byte0c=(values[3]&15)|((values[9]&1)<<4)|(selector<<5)|((values[12]&1)<<7);
 return {supported:true,callIndex:call.index,callOffset:call.offset,mapId:values[0]&65535,secondaryId:values[1]&32767,cameraArgumentIndex:10,cameraArgumentRaw:call.args[10],cameraArgumentValue:values[10],selector,recordByte0c:byte0c,scope:'Static ordinary-field preset selector; scripts/modes/transitions can override it.'};
}
