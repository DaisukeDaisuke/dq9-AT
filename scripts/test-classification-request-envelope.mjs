import assert from 'node:assert/strict';
import {ResidualRecognitionClient} from '../web/map-browser-preview/residual-recognition-client.mjs?v=immediate-placement-20261008-3f1821b3';
const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>k!=='classificationEnvelopeTiming').map(([k,v])=>[k,clean(v)])):x;
export async function runEnvelopeClientCases(Client){
 const originalWorker=globalThis.Worker,originalNow=Object.getOwnPropertyDescriptor(performance,'now');let now=0;
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
 const rows=[];
 try{for(const scenario of ['success','callback-throws','worker-error','cancel','post-error','worker-error-event']){
  const workers=[],trace=[],progress=[],errors=[];
  class FakeWorker{constructor(){workers.push(this);}postMessage(m){trace.push([m.type,m.id,m.romEpoch]);now+=2;if(scenario==='post-error'&&m.type==='recognize')throw Error('post failed');this.last=m;}terminate(){trace.push(['terminate']);}reply(m){this.onmessage({data:m});}}
  globalThis.Worker=FakeWorker;const client=new Client(),loading=client.load(new Uint8Array(512),'rom'),w=workers[0];w.reply({type:'loaded',id:w.last.id,romEpoch:client.epoch,catalog:[]});await loading;now=1000;
  const callbackError=Error('callback must propagate');const promise=client.classify({crop:{rgba:new Uint8Array(4)},modelIds:['same']},m=>{progress.push(structuredClone(m));now+=5;if(scenario==='callback-throws')throw callbackError;}).then(result=>({result}),error=>({error}));
  const id='residual-compare-'+client.sequence,romEpoch=client.epoch;
  if(scenario!=='post-error'){
   now+=20;try{w.reply({type:'progress',id,romEpoch,phase:'embed',timings:{elapsedMs:1}});}catch(error){assert.equal(error,callbackError);errors.push(error.message);}
   if(scenario==='cancel'){now+=10;client.cancel();}
   else if(scenario==='worker-error-event'){now+=10;w.onerror({message:'worker event failed'});}
   else{now+=10;try{w.reply({type:'progress',id,romEpoch,phase:'embed',timings:{elapsedMs:2}});}catch(error){assert.equal(error,callbackError);errors.push(error.message);}
    now+=50;const worker={clock:{domain:'recognition-worker',timeOrigin:200},requestId:id,romEpoch,handlerToBeforePostElapsedMs:12,finalSnapshotBeforePost:scenario!=='worker-error'};
    if(scenario==='worker-error')w.reply({type:'error',id,romEpoch,message:'worker failed',classificationEnvelopeTiming:{worker}});
    else w.reply({type:'result',id,romEpoch,result:{rankings:[{modelId:'same',distance:.25}],classificationEnvelopeTiming:{worker}}});
   }
  }
  const outcome=await promise,raw=outcome.result??outcome.error,metadata=raw?.classificationEnvelopeTiming;
  if(metadata?.main){assert.equal(metadata.main.postMessageSyncMs,2);assert.equal(metadata.main.progressHandlerCount,scenario==='post-error'?0:['cancel','worker-error-event'].includes(scenario)?1:2);assert.equal(metadata.main.progressHandlerSyncMs,metadata.main.progressHandlerCount*5);assert.equal(metadata.main.progressHandlerThrows,scenario==='callback-throws'?2:0);assert.equal(metadata.main.clock.domain,'window-main-thread');
   if(['success','callback-throws','worker-error'].includes(scenario)){assert.equal(metadata.main.requestToReplyHandlerEntryElapsedMs,92);assert.equal(metadata.worker.handlerToBeforePostElapsedMs,12);assert.equal(metadata.worker.clock.domain,'recognition-worker');}
   if(progress[0]?.classificationEnvelopeTiming){assert.equal(progress[0].classificationEnvelopeTiming.main.progressHandlerCount,0);progress[0].classificationEnvelopeTiming.main.clock.domain='mutated-old-copy';assert.equal(metadata.main.clock.domain,'window-main-thread');}
  }
  const pending=client.pending;w.reply({type:'result',id:'stale',romEpoch,result:{rankings:[]}});assert.equal(client.pending,pending);
  rows.push({scenario,result:clean(outcome.result),error:outcome.error?[outcome.error.name,outcome.error.message]:null,trace,callbackErrors:errors,metadata});client.release();
 }}finally{globalThis.Worker=originalWorker;if(originalNow)Object.defineProperty(performance,'now',originalNow);else delete performance.now;}
 return rows;
}
const results=await runEnvelopeClientCases(ResidualRecognitionClient);for(const row of results)assert(row.metadata?.main);assert.equal(results[1].result.rankings[0].distance,.25);assert.equal(results[3].error[0],'AbortError');
console.log(JSON.stringify({passed:true,requestEnvelopeCases:results.map(r=>({scenario:r.scenario,status:r.metadata.main.status,postMessageSyncMs:r.metadata.main.postMessageSyncMs,progressHandlerCount:r.metadata.main.progressHandlerCount,progressHandlerSyncMs:r.metadata.main.progressHandlerSyncMs,callbackThrows:r.metadata.main.progressHandlerThrows})),callbackExceptionsPreserved:true,independentSnapshots:true,realInferenceRuns:0}));
