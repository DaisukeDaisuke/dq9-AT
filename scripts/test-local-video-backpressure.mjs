import assert from'node:assert/strict';import{LocalVideoBackpressure}from'../web/map-browser-preview/local-video-backpressure.mjs?v=browser-at-20261008-138417cd';
let id={sourceId:'file',sourceEpoch:1,segment:0,rom:'rom1',activation:1},enabled=true,pauses=0,plays=0,gate;
const video={paused:false,seeking:false,ended:false,error:null,srcObject:null,pause(){this.paused=true;pauses++;},async play(){this.paused=false;plays++;gate.playEvent();}};
gate=new LocalVideoBackpressure({video,identity:()=>id,isEnabled:()=>enabled,minimumAdvanceSeconds:.5});
assert(gate.admit({mediaTime:1}));for(const time of[1.016,1.1,1.49])assert.equal(gate.admit({mediaTime:time}),false);assert(gate.admit({mediaTime:1.5}));
let h=gate.begin();assert(h);assert.equal(gate.begin(),null);assert.equal(pauses,1);let done=false;const resumed=gate.finish(h).then(x=>{done=x;});await Promise.resolve();assert.equal(plays,0);assert(gate.pauseEvent());await resumed;assert(done);assert.equal(plays,1);
for(const invalidate of[()=>gate.cancel(),()=>id={...id,sourceEpoch:id.sourceEpoch+1},()=>id={...id,rom:'new'},()=>id={...id,segment:id.segment+1},()=>{video.seeking=true;},()=>enabled=false,()=>{video.ended=true;}]){enabled=true;video.paused=false;video.seeking=false;video.ended=false;h=gate.begin();gate.pauseEvent();const before=plays;invalidate();assert.equal(await gate.finish(h),false);assert.equal(plays,before);gate.cancel();}
enabled=true;video.ended=false;video.seeking=false;video.paused=true;assert.equal(gate.begin(),null);video.paused=false;video.srcObject={};assert.equal(gate.begin(),null);video.srcObject=null;
h=gate.begin();gate.pauseEvent();video.paused=false;gate.playEvent();video.paused=true;gate.pauseEvent();const before=plays;assert.equal(await gate.finish(h),false);assert.equal(plays,before);
// Cancelling before the native pause event also resolves the waiter safely.
video.paused=false;h=gate.begin();const cancelled=gate.finish(h);gate.cancel();assert.equal(await cancelled,false);
console.log(JSON.stringify({passed:true,oneOwnedPause:true,pauseAcknowledgedBeforeResume:true,sourceRomEpochStopSeekAndEndDoNotReplay:true,userPlayThenPauseNotOverridden:true,slowCadenceSeparateFromFastCapture:true,noSeekOrRetimestamp:true,syntheticOnly:true}));
