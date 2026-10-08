// One owned pause for an automatic local-file observation. Never seeks,
// retimestamps pixels, assumes FPS, or grants permission to resume a new input.
export class LocalVideoBackpressure{
 constructor({video,isEnabled,identity,onError=()=>{},minimumAdvanceSeconds=.5}){Object.assign(this,{video,isEnabled,identity,onError,minimumAdvanceSeconds,generation:0,held:null,lastSlowKey:null,lastSlowPTS:null});}
 key(){return JSON.stringify(this.identity());}
 cancel(){this.generation++;this.held?.ackPause(false);this.held=null;this.lastSlowKey=null;this.lastSlowPTS=null;}
 admit(stamp){const key=this.key(),time=stamp?.mediaTime??stamp?.videoTime;if(!Number.isFinite(time))return false;if(key===this.lastSlowKey&&this.lastSlowPTS!==null&&time>=this.lastSlowPTS&&time-this.lastSlowPTS<this.minimumAdvanceSeconds)return false;this.lastSlowKey=key;this.lastSlowPTS=time;return true;}
 pauseEvent(){const h=this.held;if(h?.expectedPause&&this.video.paused&&h.key===this.key()){h.expectedPause=false;h.ackPause(true);return true;}this.cancel();return false;}
 playEvent(){if(!this.video.paused&&this.held)this.cancel();}
 begin(){const v=this.video;if(this.held||!this.isEnabled()||v.paused||v.seeking||v.ended||v.error||v.srcObject)return null;const h={generation:this.generation,key:this.key(),expectedPause:true};h.paused=new Promise(resolve=>h.ackPause=resolve);this.held=h;try{v.pause();}catch(error){this.cancel();throw error;}return h;}
 async finish(h){if(!h||this.held!==h)return false;await h.paused;if(this.held!==h)return false;const v=this.video,valid=h.generation===this.generation&&h.key===this.key()&&this.isEnabled()&&v.paused&&!v.seeking&&!v.ended&&!v.error&&!v.srcObject;this.held=null;if(!valid)return false;try{await v.play();return true;}catch(error){if(h.generation===this.generation&&h.key===this.key())this.onError(error);return false;}}
}
