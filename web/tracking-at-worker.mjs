import {runTrackingSearch} from './tracking-at-runner.mjs?v=field-stream-20261005-1108';
let current=null;
self.onmessage=async({data})=>{
 if(data.type==='persisted'||data.type==='persist-failed'){if(current?.runId===data.runId&&current.pending?.sequence===data.sequence){const p=current.pending;current.pending=null;data.type==='persisted'?p.resolve():p.reject(Error(data.message??'Checkpoint write failed'));}return;}
 if(data.type==='cancel'){if(current?.runId===data.runId)current.abort.abort();return;}
 if(data.type!=='run'||current)return;
 const ctx={runId:data.runId,abort:new AbortController(),pending:null};current=ctx;
 try{const result=await runTrackingSearch({...data.args,signal:ctx.abort.signal,persist:checkpoint=>new Promise((resolve,reject)=>{ctx.pending={sequence:checkpoint.sequence,resolve,reject};self.postMessage({type:'persist',runId:ctx.runId,checkpoint});}),onProgress:progress=>self.postMessage({type:'progress',runId:ctx.runId,progress})});self.postMessage({type:'result',runId:ctx.runId,result});}
 catch(error){self.postMessage({type:'error',runId:ctx.runId,message:error.message});}finally{current=null;}
};
