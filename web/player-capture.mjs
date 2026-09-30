import {playerPositionSample,PlayerTrajectory} from './player-position.mjs';
// Joins only results from one immutable capture; invalidation discards late work.
export class PlayerCaptureCoordinator {
 constructor(onSample=()=>{},enrichSample=sample=>sample){this.onSample=onSample;this.enrichSample=enrichSample;this.trajectory=new PlayerTrajectory();this.pending=new Map();this.epoch=0;}
 capture({stamp,frame,registrationFrame,markers,registrationExpected=true}){
  const token={epoch:this.epoch,frameSerial:stamp.frameSerial};
  const entry={token,stamp:structuredClone(stamp),frame:structuredClone(frame),registrationFrame:structuredClone(registrationFrame),markers:structuredClone(markers),registration:null,mapNameObservation:null,registrationReady:!registrationExpected,nameReady:false};
  this.pending.set(token.frameSerial,entry);while(this.pending.size>8)this.pending.delete(this.pending.keys().next().value);return token;
 }
 get(token){const e=this.pending.get(token?.frameSerial);return token?.epoch===this.epoch&&e?.token===token?e:null;}
 registration(token,result){const e=this.get(token);if(!e)return false;e.registration=structuredClone(result);e.registrationReady=true;return this.finish(e);}
 name(token,observation=null){const e=this.get(token);if(!e)return false;if(e.nameReady)return this.finish(e);e.mapNameObservation=structuredClone(observation);e.nameReady=true;return this.finish(e);}
 finish(e){if(!e.registrationReady||!e.nameReady)return false;this.pending.delete(e.token.frameSerial);const sample=this.trajectory.append(this.enrichSample(playerPositionSample(e)));if(this.trajectory.samples.length>1000)this.trajectory.samples.splice(0,this.trajectory.samples.length-1000);this.onSample(sample);return sample;}
 invalidate(stamp,reason){this.epoch++;this.pending.clear();if(!stamp)return null;const gap=this.trajectory.gap(stamp,reason);if(this.trajectory.samples.length>1000)this.trajectory.samples.shift();this.onSample(gap);return gap;}
}
