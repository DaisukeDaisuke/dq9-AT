import {runIndexIdentification} from './at-identify-index-engine.mjs';
let started=false;
export async function handleWorkerMessage(message,post){if(message?.type!=='start')return;if(started){post({type:'error',error:'Worker accepts exactly one request; create a new Worker for another search'});return;}started=true;try{const result=await runIndexIdentification(message.request,message.wasmBytes,checkpoint=>post({type:'progress',checkpoint}));post({type:'result',result});}catch(error){post({type:'error',error:String(error?.message??error)});}}
if(typeof globalThis.addEventListener==='function'&&typeof globalThis.postMessage==='function')globalThis.addEventListener('message',event=>handleWorkerMessage(event.data,message=>globalThis.postMessage(message)));
