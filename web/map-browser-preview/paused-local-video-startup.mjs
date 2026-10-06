// Only the paused, decoded local-file startup branch. Already-playing and
// not-yet-decoded paths keep their existing caller behavior.
export class PausedLocalVideoStartup{
 constructor(){this.generation=0;this.pendingPreparation=null;}
 cancel(){this.generation++;}
 async start({isCurrent,isPaused,isReady,prepare,play}){
  const generation=++this.generation,current=()=>generation===this.generation&&isCurrent(),cancelled=()=>({started:false,reason:'startup-cancelled'}),previous=this.pendingPreparation;
  if(previous){try{await previous;}catch{/* A newer explicit Start may retry. */}}
  if(!current())return cancelled();if(!isPaused())return{started:false,reason:'already-playing'};
  if(!isReady()){
   const pending=Promise.resolve().then(()=>current()?prepare():undefined);this.pendingPreparation=pending;
   try{await pending;}catch(error){return current()?{started:false,reason:'startup-preparation-failed',error}:cancelled();}
   finally{if(this.pendingPreparation===pending)this.pendingPreparation=null;}
  }
  if(!current())return cancelled();if(!isPaused())return{started:false,reason:'already-playing'};
  if(!isReady())return{started:false,reason:'startup-frame-unavailable'};
  try{await play();}catch(error){return current()?{started:false,reason:'play-failed',error}:cancelled();}
  return current()?{started:true,reason:'startup-ready-play-requested'}:cancelled();
 }
}
