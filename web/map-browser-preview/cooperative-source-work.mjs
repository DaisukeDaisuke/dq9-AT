/* Run the same source-ordered operations synchronously for reference callers,
 * or cooperatively for UI work. A slice is checked only at explicit boundaries;
 * it is not a bound on a single polygon, source read, or device response time. */
export function runSourceStepsSync(steps){
 let done=false;try{for(;;){const next=steps.next();if(next.done){done=true;return next.value;}}}finally{if(!done)steps.return?.();}
}
// A run owns at most one lazily created channel and one outstanding boundary.
// Posted-message tasks do not request scheduler.yield continuation priority.
// Explicit caller yieldTask values bypass this default, including invalid ones.
function createDefaultSourceYield(){
 let initialized=false,channel=null,pending=null,closed=false,policy=null;
 const closePorts=()=>{const value=channel;channel=null;for(const key of['port1','port2'])try{value?.[key]?.close?.();}catch{}};
 const initialize=()=>{if(initialized)return;initialized=true;
  try{if(typeof globalThis.MessageChannel!=='function')return;channel=new globalThis.MessageChannel();
   if(typeof channel.port1?.close!=='function'||typeof channel.port2?.postMessage!=='function'||typeof channel.port2?.close!=='function')throw Error('MessageChannel unavailable');
   channel.port1.onmessage=()=>{if(closed||!pending)return;const value=pending;pending=null;value.resolve();};
   channel.port1.onmessageerror=()=>{if(closed||!pending)return;const value=pending;pending=null;value.reject(Error('Source yield message delivery failed'));};
  }catch{closePorts();}
 };
 return{get policy(){return policy;},yieldTask(){
  if(closed)return Promise.reject(new DOMException('Source yield closed','AbortError'));initialize();
  if(!channel){if(globalThis.scheduler?.yield){policy='scheduler-yield-fallback';return globalThis.scheduler.yield();}policy='timer-task-fallback';return new Promise(resolve=>setTimeout(resolve,0));}
  policy='message-channel-task';if(pending)return Promise.reject(Error('Overlapping source yield boundary'));
  return new Promise((resolve,reject)=>{pending={resolve,reject};try{channel.port2.postMessage(0);}catch(error){pending=null;reject(error);}});
 },close(){if(closed)return;closed=true;closePorts();if(pending){const value=pending;pending=null;value.reject(new DOMException('Source yield closed','AbortError'));}}};
}
export async function runSourceStepsAsync(steps,{isCurrent=()=>true,yieldTask,sliceMilliseconds=8,now=()=>performance.now(),onSegment=null,onYieldTiming=null}={}){
 if(!Number.isFinite(sliceMilliseconds)||sliceMilliseconds<=0)throw Error('Positive finite cooperative slice required');
 const ownedYield=yieldTask===undefined?createDefaultSourceYield():null;if(ownedYield)yieldTask=()=>ownedYield.yieldTask();
 const check=()=>{if(!isCurrent())throw new DOMException('Source rendering cancelled','AbortError');};
 let started=now(),done=false;
 try{for(;;){check();const next=steps.next(),elapsedMs=now()-started;
  if(next.done){check();onSegment?.({elapsedMs,done:true});done=true;return next.value;}
  if(elapsedMs>=sliceMilliseconds){onSegment?.({elapsedMs,done:false,boundary:next.value});
   // Observe the existing wait only. No new Promise, task or yield boundary.
   let waitStarted=null,waitCompleted=false;
   if(typeof onYieldTiming==='function')try{waitStarted=now();}catch{}
   try{await yieldTask();waitCompleted=true;}finally{if(typeof onYieldTiming==='function')try{const endedAtMs=now();onYieldTiming({startedAtMs:waitStarted,endedAtMs,elapsedMs:waitStarted===null?null:endedAtMs-waitStarted,completed:waitCompleted,yieldPolicy:ownedYield?ownedYield.policy:'explicit-caller-yield'});}catch{/* Optional timing cannot change source work. */}}
   check();started=now();}
 }}finally{try{if(!done)steps.return?.();}finally{ownedYield?.close();}}
}
