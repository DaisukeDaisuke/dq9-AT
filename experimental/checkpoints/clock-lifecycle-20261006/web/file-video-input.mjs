// Local object URLs only. Media timestamps, not wall-clock playback duration, identify frames.
// Bounded discontinuity telemetry only; timestamp/reset/seek rules are unchanged.
const diagnosticNumber=value=>typeof value==='number'?(Number.isFinite(value)?value:String(value)):null;
const diagnosticMetadata=metadata=>Object.fromEntries(['mediaTime','presentedFrames','presentationTime','expectedDisplayTime','processingDuration','width','height'].map(key=>[key,diagnosticNumber(metadata?.[key])]));
export class FileVideoInput {
 constructor(video,onFrame,onError,onDiscontinuity=()=>{}) {
  Object.assign(this,{video,onFrame,onError,onDiscontinuity,interval:500,url:null,sourceId:null,generation:0,segment:0,frameId:null,lastMediaTime:null,lastClock:null,clockTimes:{currentTime:null,mediaTime:null},running:false});
  this.trace={captureSerial:0,callbackSerial:0,lifecycleSerial:0,captures:[],lifecycle:[],evicted:{captures:0,lifecycle:0},clockSamples:{currentTime:null,mediaTime:null},pendingCallback:null,lastScheduled:null,lastCancelled:null};
  this.handlers={
   loadeddata:()=>this.capture(undefined,{origin:'loadeddata'}), play:()=>{this.running=true;this.queue();},
   pause:()=>{this.running=false;this.cancel();}, ended:()=>{this.running=false;this.cancel();},
   seeking:()=>{const before=this.diagnosticState(),previousAcceptedSamples={...this.trace.clockSamples};this.generation++;this.segment++;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};this.trace.clockSamples={currentTime:null,mediaTime:null};this.cancel();this.discontinuity('seek',undefined,before,{event:'seeking'},previousAcceptedSamples);},
   seeked:()=>{this.capture(undefined,{origin:'seeked'});if(!this.video.paused)this.queue();},
   error:()=>{this.running=false;this.cancel();this.onError(new Error('動画を再生できません。ブラウザ対応のWebM / MP4を選択してください。'));}
  };
  for(const [name,handler] of Object.entries(this.handlers))video.addEventListener(name,()=>{if(this.url){const event=this.lifecycle(name);try{handler();}finally{event.after=this.diagnosticState();}}});
 }
 diagnosticState(){
  return{sourceId:this.sourceId,sourceEpoch:this.generation,timelineSegment:this.segment,currentTime:diagnosticNumber(this.video.currentTime),paused:this.video.paused??null,seeking:this.video.seeking??null,ended:this.video.ended??null,readyState:this.video.readyState??null,playbackRate:diagnosticNumber(this.video.playbackRate),running:this.running,urlPresent:this.url!==null,frameId:this.frameId,pendingCallback:this.trace.pendingCallback,lastClock:this.lastClock,lastMediaTime:this.lastMediaTime,clockTimes:{...this.clockTimes}};
 }
 retainDiagnostic(kind,value,maximum){const list=this.trace[kind];list.push(value);if(list.length>maximum){list.shift();this.trace.evicted[kind]++;}return value;}
 lifecycle(event){return this.retainDiagnostic('lifecycle',{sequence:++this.trace.lifecycleSerial,event,observedAt:new Date().toISOString(),performanceNow:performance.now(),before:this.diagnosticState()},16);}
 captureDiagnostic(metadata,context){
  return this.retainDiagnostic('captures',{sequence:++this.trace.captureSerial,observedAt:new Date().toISOString(),performanceNow:performance.now(),context:{...context},metadata:diagnosticMetadata(metadata),mediaTimeProvided:metadata?.mediaTime!==undefined,mediaTimeType:typeof metadata?.mediaTime,before:this.diagnosticState(),outcome:'pending'},8);
 }
 discontinuity(reason,metadata,before,trigger,previousAcceptedSamples=this.trace.clockSamples){
  const inputDiscontinuity=structuredClone({schema:'file-video-input-discontinuity-v1',reason,observedAt:new Date().toISOString(),performanceNow:performance.now(),trigger,before,afterReset:this.diagnosticState(),previousAcceptedSamples:{...previousAcceptedSamples},lastScheduledCallback:this.trace.lastScheduled,lastCancelledCallback:this.trace.lastCancelled,recentCaptures:this.trace.captures,recentLifecycle:this.trace.lifecycle,retention:{maximumCaptures:8,maximumLifecycle:16,evicted:{...this.trace.evicted}},diagnosticOnly:true,resetRulesUnchanged:true,frameRateAssumed:false});
  this.onDiscontinuity(reason,{...this.snapshot(metadata),inputDiscontinuity});
 }
 snapshot(metadata) {
  const precise=Number.isFinite(metadata?.mediaTime);
  return {sourceKind:'local-file',sourceId:this.sourceId,sourceEpoch:this.generation,timelineSegment:this.segment,
   videoTime:precise?metadata.mediaTime:this.video.currentTime,mediaTime:precise?metadata.mediaTime:this.video.currentTime,
   timestampBasis:precise?'requestVideoFrameCallback.mediaTime':'HTMLMediaElement.currentTime',
   presentedFrames:Number.isFinite(metadata?.presentedFrames)?metadata.presentedFrames:null,
   absoluteFrameIndex:null,capturedAt:new Date().toISOString()};
 }
 load(file) {
  const before=this.diagnosticState(),previousAcceptedSamples={...this.trace.clockSamples},event=this.lifecycle('load');this.stop();this.sourceId=globalThis.crypto?.randomUUID?.()||`local-${Date.now()}-${this.generation}`;
  this.url=URL.createObjectURL(file);this.video.srcObject=null;this.video.autoplay=false;this.video.src=this.url;this.video.load();
  this.discontinuity('file-replacement',undefined,before,{event:'load'},previousAcceptedSamples);event.after=this.diagnosticState();
 }
 cancel(){if(this.frameId!==null){this.trace.lastCancelled={observedAt:new Date().toISOString(),performanceNow:performance.now(),callbackId:this.frameId,registration:this.trace.pendingCallback,state:this.diagnosticState()};if(this.video.cancelVideoFrameCallback)this.video.cancelVideoFrameCallback(this.frameId);else cancelAnimationFrame(this.frameId);}this.frameId=null;this.trace.pendingCallback=null;}
 capture(metadata,context={origin:'direct-capture'}){const diagnostic=this.captureDiagnostic(metadata,context);if(!this.url||this.video.seeking||this.video.readyState<2){diagnostic.outcome='input-not-ready';return;}
  const precise=Number.isFinite(metadata?.mediaTime),clock=precise?'mediaTime':'currentTime',time=precise?metadata.mediaTime:this.video.currentTime,previous=this.clockTimes[clock];
  if(!Number.isFinite(time)||time===previous){diagnostic.outcome=Number.isFinite(time)?'same-clock-duplicate':'nonfinite-time';return;}
  // A paused/seeked currentTime can lie just after the decoded frame PTS.
  // Compare regressions within each clock only, even across a clock switch.
  if(previous!==null&&time<previous){const before=this.diagnosticState(),previousAcceptedSample=this.trace.clockSamples[clock];diagnostic.outcome='backward-time-trigger';this.generation++;this.segment++;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};this.discontinuity('backward-time',metadata,before,{event:'capture',clock,previous,incoming:time,delta:time-previous,previousAcceptedSample,incomingCapture:diagnostic});this.trace.clockSamples={currentTime:null,mediaTime:null};}
  if(this.lastClock===clock&&this.lastMediaTime!==null&&time>=this.lastMediaTime&&time-this.lastMediaTime<this.interval/1000){diagnostic.outcome='interval-not-reached';return;}
  this.clockTimes[clock]=time;this.lastClock=clock;this.lastMediaTime=time;diagnostic.outcome='accepted';diagnostic.after=this.diagnosticState();this.trace.clockSamples[clock]=diagnostic;const sample=this.snapshot(metadata);Promise.resolve(this.onFrame(performance.now(),sample)).catch(error=>{if(sample.sourceEpoch===this.generation)this.onError(error);});
 }
 queue(){if(!this.url||!this.running||this.frameId!==null)return;const generation=this.generation,registration={serial:++this.trace.callbackSerial,sourceId:this.sourceId,generation,segment:this.segment,kind:this.video.requestVideoFrameCallback?'requestVideoFrameCallback':'requestAnimationFrame',scheduledAt:new Date().toISOString(),scheduledPerformanceNow:performance.now()};
  const tick=(_now,metadata)=>{const context={origin:registration.kind,callbackNow:diagnosticNumber(_now),registration:{...registration},pendingCallbackAtDelivery:this.trace.pendingCallback,pendingFrameIdAtDelivery:this.frameId};this.frameId=null;this.trace.pendingCallback=null;if(generation!==this.generation||!this.url){this.captureDiagnostic(metadata,context).outcome='stale-generation-or-source-callback';return;}this.capture(metadata,context);this.queue();};
  this.frameId=this.video.requestVideoFrameCallback?this.video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);registration.callbackId=this.frameId;this.trace.pendingCallback=registration;this.trace.lastScheduled={...registration};
 }
 stop(){const event=this.lifecycle('stop');this.generation++;this.running=false;this.cancel();if(this.url){this.video.pause();this.video.removeAttribute('src');this.video.load();URL.revokeObjectURL(this.url);this.url=null;}this.sourceId=null;this.segment=0;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};this.trace.clockSamples={currentTime:null,mediaTime:null};event.after=this.diagnosticState();}
}
