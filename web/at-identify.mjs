import {prepare,cancelCheckpoint} from './at-identify-engine.mjs';
export function startIdentification(request,{wasmBytes,onProgress=()=>{},WorkerClass=globalThis.Worker,workerURL=new URL('./at-identify-worker.mjs',import.meta.url)}={}){
 if(!WorkerClass)throw Error('Worker implementation required');if(!(wasmBytes instanceof ArrayBuffer)&&!ArrayBuffer.isView(wasmBytes))throw Error('Reviewed WASM bytes required');
 let last=structuredClone(prepare(request).checkpoint),settled=false,resolveResult;const result=new Promise(resolve=>{resolveResult=resolve;});
 const worker=new WorkerClass(workerURL,{type:'module'});
 function finish(value){if(settled)return;settled=true;worker.terminate();resolveResult(value);}
 function receive(message){if(settled)return;if(message?.type==='progress'){if(message.checkpoint.sequence<=last.sequence)return;last=structuredClone(message.checkpoint);try{onProgress(structuredClone(last));}catch(error){fail(error);}}else if(message?.type==='result')finish(message.result);else if(message?.type==='error')finish({...cancelCheckpoint(last),status:'failed',error:message.error});}
 const fail=error=>finish({...cancelCheckpoint(last),status:'failed',error:String(error?.message??error)});
 if(typeof worker.addEventListener==='function'){worker.addEventListener('message',event=>receive(event.data));worker.addEventListener('error',fail);}else{worker.on('message',receive);worker.on('error',fail);worker.on('exit',code=>{if(!settled)fail(Error(`Worker exited before result (${code})`));});}
 worker.postMessage({type:'start',request,wasmBytes});
 return{result,cancel(){finish(cancelCheckpoint(last));return result;},checkpoint(){return structuredClone(last);}};
}
