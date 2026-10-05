// One active frozen-frame job. Optional latest-pending retention is bounded
// to one job; default callers keep skipped-busy behavior.
export class FrozenClassificationLane {
 constructor({process,onState=()=>{},onError=()=>{},onIdle=()=>{},retainLatestPending=false}){Object.assign(this,{process,onState,onError,onIdle,retainLatestPending:retainLatestPending===true,active:null,pending:null,generation:0});}
 offer(job){
  if(this.active){
   if(!this.retainLatestPending){this.onState(job,'skipped-busy');return false;}
   const previous=this.pending;this.pending={job,generation:this.generation};
   if(previous)this.onState(previous.job,'superseded-pending',null,'newer-frozen-frame-retained');
   this.onState(job,'queued-latest');return true;
  }
  this.start(job);return true;
 }
 start(job){
  const generation=this.generation,token={job,generation};this.active=token;
  const isCurrent=()=>this.active===token&&generation===this.generation;
  this.onState(job,'running');
  token.done=Promise.resolve().then(()=>isCurrent()?this.process(job,isCurrent):undefined).then(result=>{if(isCurrent())this.onState(job,result===false?'discarded-stale':'finished');},error=>{if(isCurrent()){this.onState(job,'failed',error);this.onError(error);}}).finally(()=>{if(this.active===token){this.active=null;const pending=this.pending;this.pending=null;if(pending&&pending.generation===this.generation)this.start(pending.job);else this.onIdle(job);}});
 }
 cancel(reason='cancelled'){
  const generation=this.generation++,pending=this.pending;this.pending=null;
  if(this.active?.generation===generation)this.onState(this.active.job,'cancelled',null,reason);
  if(pending)this.onState(pending.job,'cancelled',null,reason);
  // Keep the active slot until its underlying promise settles, even if the
  // backend cannot interrupt immediately. New work may only occupy pending.
 }
 get busy(){return this.active!==null;}
}
