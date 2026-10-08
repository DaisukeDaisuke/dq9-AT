// Scheduling identity never replaces a job's complete immutable input hash.
// Upstream must await admission before producing another distinct revision.
export function createTrackingObservationWorkQueue({sourceKey,conditionKey,own,process,resumeProcess,invalidate,onQueue=()=>{},maximumPending=1}){
 if(!Number.isSafeInteger(maximumPending)||maximumPending<1)throw Error('Positive pending observation capacity required');
 let generation=0,source=null,active=null,queue=[],resumes=[],resumeTurn=false,draining=false,sequence=0,started=0,drainSerial=0;
 const admitted=new Set(),capacityWaiters=new Set();
 const state=()=>({receivedRevisions:sequence,startedRevisions:started,activeRevision:active?.sequence??null,pendingConditions:queue.length,pendingResumeKeys:resumes.length,maximumPending,capacityWaiters:capacityWaiters.size,latestRevisionProcessed:active?.sequence===sequence,fullObservationHashesEquated:false});
 const report=()=>onQueue(state());
 const wake=()=>{for(const resolve of capacityWaiters)resolve();capacityWaiters.clear();};
 async function drain(){
  if(draining)return;draining=true;const mineDrain=++drainSerial;
  try{while((queue.length||resumes.length)&&mineDrain===drainSerial){const item=resumes.length&&(!queue.length||resumeTurn)?resumes.shift():queue.shift();resumeTurn=!item.resumeKey;active=item;started++;wake();report();
    try{const control={hasPending:()=>queue.length>0||resumes.length>0||capacityWaiters.size>0,isCurrent:()=>item.generation===generation};const result=await(item.resumeKey?resumeProcess(item.resumeKey,control):process(item.bundle,control));if(result?.status==='budget-stopped'&&result.progressed===true&&item.generation===generation)for(const resumeKey of new Set([result.resumeKey,...(result.resumeKeys??[])].filter(k=>typeof k==='string'&&k))){if(!resumes.some(r=>r.resumeKey===resumeKey&&r.generation===item.generation))resumes.push({resumeKey,key:item.key,generation:item.generation,sequence:item.sequence,resolve:()=>{},reject:()=>{}});}if(result?.status==='error'&&item.generation===generation)admitted.delete(item.key);item.resolve(result);}
    catch(error){if(item.generation===generation)admitted.delete(item.key);item.reject(error);}
    finally{if(active===item)active=null;}
  }}finally{if(mineDrain===drainSerial){draining=false;wake();report();}}
 }
 function clear(reason,options){generation++;drainSerial++;draining=false;active=null;source=null;admitted.clear();for(const item of queue)item.resolve({status:'superseded-before-preparation'});queue=[];resumes=[];wake();invalidate(reason,options);report();}
 async function admit(bundle){
  const key=sourceKey(bundle);if(source!==null&&key!==source)clear('ROM・動画 source epoch または segment が変わりました。');source=key;sequence++;
  const mine=generation,revision=sequence;
  let condition;try{condition=conditionKey(bundle);}catch{condition=`unprojectable:${revision}`;}
  if(admitted.has(condition)){report();return{done:Promise.resolve({status:'AT-conditions-already-admitted',fullObservationHashesEquated:false})};}
  // Producer-certified graphs keep their shared frozen evidence here. Generic
  // callers get the existing complete owned clone before the first await.
  const owned=own(bundle);
  while(queue.length>=maximumPending){await new Promise(resolve=>{capacityWaiters.add(resolve);report();});if(mine!==generation)return{done:Promise.resolve({status:'superseded-before-admission'})};}
  if(mine!==generation)return{done:Promise.resolve({status:'superseded-before-admission'})};
  if(admitted.has(condition))return{done:Promise.resolve({status:'AT-conditions-already-admitted',fullObservationHashesEquated:false})};
  admitted.add(condition);
  const done=new Promise((resolve,reject)=>queue.push({bundle:owned,key:condition,generation:mine,sequence:revision,resolve,reject}));
  report();void drain();return{done};
 }
 return{state,clear,admit,async submit(bundle){return(await admit(bundle)).done;}};
}
