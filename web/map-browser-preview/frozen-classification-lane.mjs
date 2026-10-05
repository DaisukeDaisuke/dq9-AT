// One active frozen-frame job. Busy frames stay explicitly unclassified; no
// unbounded queue, hidden candidate truncation, or re-labelling of newer frames.
export class FrozenClassificationLane {
 constructor({process,onState=()=>{},onError=()=>{},onIdle=()=>{}}){Object.assign(this,{process,onState,onError,onIdle,active:null,generation:0});}
 offer(job){
  if(this.active){this.onState(job,'skipped-busy');return false;}
  const generation=this.generation,token={job,generation};this.active=token;
  const isCurrent=()=>this.active===token&&generation===this.generation;
  this.onState(job,'running');
  token.done=Promise.resolve().then(()=>isCurrent()?this.process(job,isCurrent):undefined).then(result=>{if(isCurrent())this.onState(job,result===false?'discarded-stale':'finished');},error=>{if(isCurrent()){this.onState(job,'failed',error);this.onError(error);}}).finally(()=>{if(this.active===token){this.active=null;this.onIdle(job);}});
  return true;
 }
 cancel(reason='cancelled'){
  if(this.active&&this.active.generation===this.generation)this.onState(this.active.job,'cancelled',null,reason);
  this.generation++;
  // Keep the slot until the underlying promise settles, even if cancellation
  // cannot interrupt a backend immediately. Otherwise jobs could overlap.
 }
 get busy(){return this.active!==null;}
}
