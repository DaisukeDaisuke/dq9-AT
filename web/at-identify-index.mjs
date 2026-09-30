import {prepareIndexIdentification,cancelIndexCheckpoint,snapshotWasm} from './at-identify-index-engine.mjs';
export function startIndexIdentification(request,{wasmBytes,onProgress=()=>{},WorkerClass=globalThis.Worker,workerURL=new URL('./at-identify-index-worker.mjs',import.meta.url)}={}){
 if(!WorkerClass)throw Error('Worker implementation required');const accepted=prepareIndexIdentification(request),bytes=snapshotWasm(wasmBytes);
 let last=structuredClone(accepted.checkpoint),settled=false,resolve;const result=new Promise(r=>{resolve=r;});const worker=new WorkerClass(workerURL,{type:'module'});
 const finish=value=>{if(settled)return;settled=true;worker.terminate();resolve(structuredClone(value));};
 const fail=error=>finish({...cancelIndexCheckpoint(last),status:'failed',error:String(error?.message??error)});
 function receive(message){if(settled)return;if(message?.type==='progress'){if(!Number.isSafeInteger(message.checkpoint?.sequence)||message.checkpoint.sequence<=last.sequence)return;last=structuredClone(message.checkpoint);try{onProgress(structuredClone(last));}catch(error){fail(error);}}else if(message?.type==='result'){if(!Number.isSafeInteger(message.result?.sequence)||message.result.sequence<last.sequence){fail(Error('Worker final checkpoint regressed'));return;}finish(message.result);}else if(message?.type==='error')fail(message.error);}
 if(typeof worker.addEventListener==='function'){worker.addEventListener('message',event=>receive(event.data));worker.addEventListener('error',fail);}else{worker.on('message',receive);worker.on('error',fail);worker.on('exit',code=>{if(!settled)fail(Error(`Worker exited before result (${code})`));});}
 try{worker.postMessage({type:'start',request:accepted.request,wasmBytes:bytes});}catch(error){fail(error);}
 return{result,checkpoint:()=>structuredClone(last),cancel(){finish(cancelIndexCheckpoint(last));return result;}};
}
