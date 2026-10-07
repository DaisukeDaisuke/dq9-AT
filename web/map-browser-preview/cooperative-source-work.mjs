/* Run the same source-ordered operations synchronously for reference callers,
 * or cooperatively for UI work. A slice is checked only at explicit boundaries;
 * it is not a bound on a single polygon, source read, or device response time. */
export function runSourceStepsSync(steps){
 let done=false;try{for(;;){const next=steps.next();if(next.done){done=true;return next.value;}}}finally{if(!done)steps.return?.();}
}
const task=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
export async function runSourceStepsAsync(steps,{isCurrent=()=>true,yieldTask=task,sliceMilliseconds=8,now=()=>performance.now(),onSegment=null,onYieldTiming=null}={}){
 if(!Number.isFinite(sliceMilliseconds)||sliceMilliseconds<=0)throw Error('Positive finite cooperative slice required');
 const check=()=>{if(!isCurrent())throw new DOMException('Source rendering cancelled','AbortError');};
 let started=now(),done=false;
 try{for(;;){check();const next=steps.next(),elapsedMs=now()-started;
  if(next.done){check();onSegment?.({elapsedMs,done:true});done=true;return next.value;}
  if(elapsedMs>=sliceMilliseconds){onSegment?.({elapsedMs,done:false,boundary:next.value});
   // Observe the existing wait only. No new Promise, task or yield boundary.
   let waitStarted=null,waitCompleted=false;
   if(typeof onYieldTiming==='function')try{waitStarted=now();}catch{}
   try{await yieldTask();waitCompleted=true;}finally{if(typeof onYieldTiming==='function')try{const endedAtMs=now();onYieldTiming({startedAtMs:waitStarted,endedAtMs,elapsedMs:waitStarted===null?null:endedAtMs-waitStarted,completed:waitCompleted});}catch{/* Optional timing cannot change source work. */}}
   check();started=now();}
 }}finally{if(!done)steps.return?.();}
}
