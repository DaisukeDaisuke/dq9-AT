import {buildGlyphAkinatorDictionary,GlyphAkinatorMatcher,validateCpuAkinatorRequest} from './font-akinator.mjs';

// A worker owns one ROM epoch and one frozen-frame request at a time. The host
// terminates it on cancellation, ROM/frame changes, or its hard watchdog.
export function createCpuAkinatorWorkerHandler(send){
 let matcher=null,romEpoch=null,busy=false;
 return async function handle(message){
  const {type,id,romEpoch:requestEpoch}=message??{};
  try{
   if(typeof id!=='string'||!id.length||!Number.isSafeInteger(requestEpoch)||requestEpoch<0)throw Error('Invalid CPU worker request identity');
   if(type==='init'){
    if(busy)throw Error('CPU worker is busy');
    matcher?.destroy();matcher=null;romEpoch=null;
    const dictionary=buildGlyphAkinatorDictionary(message.glyphsBySize,{backend:'cpu-reference'});
    matcher=new GlyphAkinatorMatcher(dictionary,{backend:'cpu-reference'});romEpoch=requestEpoch;
    send({type:'ready',id,romEpoch});return;
   }
   if(type!=='match')throw Error('Unknown CPU worker request');
   if(!matcher||requestEpoch!==romEpoch)throw Error('CPU worker ROM epoch is stale or uninitialized');
   if(busy)throw Error('CPU worker is busy');
   validateCpuAkinatorRequest(message.image,message.options);
   busy=true;
   try{
    const result=await matcher.match(message.image,message.options);
    send({type:'result',id,romEpoch,stamp:message.stamp,result});
   }finally{busy=false;}
  }catch(error){send({type:'error',id,romEpoch:requestEpoch,message:error?.message||String(error)});}
 };
}

if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope){
 const handle=createCpuAkinatorWorkerHandler(message=>globalThis.postMessage(message));
 globalThis.onmessage=event=>{void handle(event.data);};
}
