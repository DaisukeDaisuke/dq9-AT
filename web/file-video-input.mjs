// Local object URLs only. Media timestamps, not wall-clock playback duration, identify frames.
// Bounded clock telemetry. The opt-in pause-boundary hold never retimestamps
// pixels or assumes a frame duration; explicit seeks and ordinary regressions reset.
const diagnosticNumber=value=>typeof value==='number'?(Number.isFinite(value)?value:String(value)):null;
const diagnosticMetadata=metadata=>Object.fromEntries(['mediaTime','presentedFrames','presentationTime','expectedDisplayTime','processingDuration','width','height'].map(key=>[key,diagnosticNumber(metadata?.[key])]));
export class FileVideoInput {
 constructor(video,onFrame,onError,onDiscontinuity=()=>{},options={}) {
  Object.assign(this,{video,onFrame,onError,onDiscontinuity,interval:500,url:null,sourceId:null,generation:0,segment:0,frameId:null,lastMediaTime:null,lastClock:null,clockTimes:{currentTime:null,mediaTime:null},running:false});
  this.trace={captureSerial:0,callbackSerial:0,lifecycleSerial:0,captures:[],lifecycle:[],evicted:{captures:0,lifecycle:0},clockSamples:{currentTime:null,mediaTime:null},pendingCallback:null,lastScheduled:null,lastCancelled:null};
  this.presentationReplayEnabled=options.holdPauseResumeReplay===true&&typeof options.onUnobserved==='function';this.onUnobserved=options.onUnobserved;this.pauseBoundary=null;this.pendingPresentation=null;this.presentationSerial=0;
  this.handlers={
   loadeddata:()=>this.capture(undefined,{origin:'loadeddata'}), play:()=>{this.running=true;this.armPauseResume();this.queue();if(this.pauseBoundary?.resumed)this.pauseBoundary.registration=this.trace.pendingCallback?{...this.trace.pendingCallback}:null;},
   pause:()=>{this.rememberPause();this.running=false;this.cancel();}, ended:()=>{this.clearPresentation('ended');this.running=false;this.cancel();},
   seeking:()=>{this.clearPresentation('seek');const before=this.diagnosticState(),previousAcceptedSamples={...this.trace.clockSamples};this.generation++;this.segment++;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};this.trace.clockSamples={currentTime:null,mediaTime:null};this.cancel();this.discontinuity('seek',undefined,before,{event:'seeking'},previousAcceptedSamples);},
   seeked:()=>{this.capture(undefined,{origin:'seeked'});if(!this.video.paused)this.queue();},
   error:()=>{this.clearPresentation('error');this.running=false;this.cancel();this.onError(new Error('動画を再生できません。ブラウザ対応のWebM / MP4を選択してください。'));}
  };
  for(const [name,handler] of Object.entries(this.handlers))video.addEventListener(name,()=>{if(this.url){const event=this.lifecycle(name);try{handler();}finally{event.after=this.diagnosticState();}}});
 }
 // A callback PTS can be ahead of the playhead when pause takes effect. Only
 // that measured boundary may arm a one-callback hold after a continuous play.
 rememberPause(){
  this.clearPresentation('paused-before-confirmation');if(!this.presentationReplayEnabled||!this.running||!this.video.paused||this.video.seeking||this.video.ended)return;
  const anchor=this.trace.clockSamples.mediaTime,pause=this.diagnosticState(),hi=anchor?.metadata?.mediaTime;
  // Presented PTS may lead the paused playhead by more than one callback.
  // Use a retained, actually accepted lower sample enclosing that playhead,
  // never a frame-duration guess or a tolerated backward-time delta.
  const lower=[...this.trace.captures].reverse().find(sample=>sample.outcome==='accepted'&&sample.context?.origin==='requestVideoFrameCallback'&&sample.before?.sourceId===pause.sourceId&&sample.before?.sourceEpoch===pause.sourceEpoch&&sample.before?.timelineSegment===pause.timelineSegment&&Number.isFinite(sample.metadata?.mediaTime)&&sample.metadata.mediaTime<=pause.currentTime&&sample.metadata.mediaTime<hi&&sample.metadata.presentedFrames<anchor?.metadata?.presentedFrames);
  const previousPTS=anchor?.before?.clockTimes?.mediaTime,lo=Number.isFinite(previousPTS)&&previousPTS<=pause.currentTime?previousPTS:lower?.metadata?.mediaTime;
  if(anchor?.context?.origin!=='requestVideoFrameCallback'||!Number.isSafeInteger(anchor.metadata.presentedFrames)||!Number.isFinite(lo)||!(lo<hi)||!Number.isFinite(pause.currentTime)||!Number.isFinite(anchor.before.currentTime)||!(anchor.before.currentTime<=pause.currentTime&&pause.currentTime<hi)||!(pause.playbackRate>0)||this.clockTimes.mediaTime!==hi)return;
  this.pauseBoundary={anchor:structuredClone(anchor),lowerAcceptedSample:lower?structuredClone(lower):null,pause,lowerObservedPTS:lo,upperObservedPTS:hi,resumed:false,registration:null};
 }
 armPauseResume(){
  const b=this.pauseBoundary;if(!b)return;const resume=this.diagnosticState();
  if(resume.sourceId!==b.pause.sourceId||resume.sourceEpoch!==b.pause.sourceEpoch||resume.timelineSegment!==b.pause.timelineSegment||resume.paused||resume.seeking||resume.ended||resume.playbackRate!==b.pause.playbackRate||!Number.isFinite(resume.currentTime)||!(b.pause.currentTime<=resume.currentTime&&resume.currentTime<b.upperObservedPTS)){this.pauseBoundary=null;return;}
  b.resume=resume;b.resumed=true;
 }
 currentPresentationCallback(context){const a=context.registration,b=context.pendingCallbackAtDelivery;return context.origin==='requestVideoFrameCallback'&&a?.kind==='requestVideoFrameCallback'&&a.sourceId===this.sourceId&&a.generation===this.generation&&a.segment===this.segment&&a.serial===b?.serial&&a.callbackId===context.pendingFrameIdAtDelivery&&this.running&&!this.video.paused&&!this.video.seeking&&!this.video.ended;}
 notifyPresentation(record,metadata){this.onUnobserved?.(this.snapshot(metadata),structuredClone(record));}
 clearPresentation(reason){
  this.pauseBoundary=null;const pending=this.pendingPresentation;this.pendingPresentation=null;
  if(pending){pending.record.resolution=reason;pending.record.resolutionState=this.diagnosticState();this.notifyPresentation(pending.record,pending.metadata);}
 }
 pauseResumePresentation(metadata,context,diagnostic,clock,time,previous){
  const pending=this.pendingPresentation;
  if(pending){
   this.pendingPresentation=null;
   const state=this.diagnosticState(),last=pending.record.lastWithheld??{mediaTime:pending.metadata.mediaTime,presentedFrames:pending.metadata.presentedFrames,currentTime:pending.record.incomingCapture.before.currentTime},owned=clock==='mediaTime'&&this.currentPresentationCallback(context)&&state.sourceId===pending.record.sourceId&&state.sourceEpoch===pending.record.sourceEpoch&&state.timelineSegment===pending.record.timelineSegment&&state.playbackRate===pending.record.resume.playbackRate;
   const monotonic=owned&&Number.isSafeInteger(metadata?.presentedFrames)&&metadata.presentedFrames>last.presentedFrames&&time>last.mediaTime&&Number.isFinite(state.currentTime)&&state.currentTime>=last.currentTime;
   // A presentation-count gap is missing video evidence, not a seek or a
   // license to invent its pixels/PTS. Retain the exact absent index interval.
   if(monotonic&&metadata.presentedFrames>last.presentedFrames+1){
    const gap={afterPresentedFrames:last.presentedFrames,beforePresentedFrames:metadata.presentedFrames,missingPresentedFrames:metadata.presentedFrames-last.presentedFrames-1,pixelsObserved:false,timestampsKnown:false,minimumProvenATCalls:0};
    pending.record.missingPresentedFrames=(pending.record.missingPresentedFrames??0)+gap.missingPresentedFrames;
    (pending.record.recentMissingPresentations??=[]).push(gap);if(pending.record.recentMissingPresentations.length>8){pending.record.recentMissingPresentations.shift();pending.record.evictedMissingIntervals=(pending.record.evictedMissingIntervals??0)+1;}
   }
   const caughtUp=monotonic&&time>=pending.record.previousPTS;
   // Callback PTS and the separately sampled HTML playhead need not be ordered.
   // Both still advance within their own clocks; ownership and the measured
   // pre-pause PTS bracket bound this unobserved catch-up sequence.
   if(monotonic&&pending.record.lowerObservedPTS<=time&&time<pending.record.previousPTS){
    // Additional presentations inside this measured pause interval remain
    // unobserved. Never feed their pixels, timestamps or counts to inference.
    const sample={mediaTime:time,presentedFrames:metadata.presentedFrames,currentTime:state.currentTime,registration:structuredClone(context.registration)};
    pending.record.lastWithheld=sample;pending.record.withheldPresentations=(pending.record.withheldPresentations??1)+1;
    (pending.record.recentWithheld??=[]).push(sample);if(pending.record.recentWithheld.length>8){pending.record.recentWithheld.shift();pending.record.evictedWithheld=(pending.record.evictedWithheld??0)+1;}
    pending.record.resolution='pending-forward-check';pending.record.resolutionState=state;diagnostic.outcome='pause-resume-presentation-withheld';
    this.pendingPresentation=pending;this.notifyPresentation(pending.record,metadata);return true;
   }
   pending.record.resolution=caughtUp?'forward-catch-up-observed':'not-confirmed';pending.record.resolutionState=state;pending.record.nextCapture=structuredClone(diagnostic);this.notifyPresentation(pending.record,metadata);
   // A nonincreasing presentation/PTS or lost owner cannot extend
   // this hold. The ordinary regression/seek rules below remain unchanged.
  }
  const b=this.pauseBoundary;this.pauseBoundary=null;
  if(!b?.resumed||clock!=='mediaTime'||!(time<previous)||!this.currentPresentationCallback(context)||context.registration.serial!==b.registration?.serial||context.registration.callbackId!==b.registration?.callbackId||previous!==b.upperObservedPTS||!(b.lowerObservedPTS<=time&&time<=b.resume.currentTime)||!Number.isFinite(this.video.currentTime)||this.video.currentTime<b.resume.currentTime||(!Number.isSafeInteger(metadata.presentedFrames)||metadata.presentedFrames<=b.anchor.metadata.presentedFrames))return false;
  const record={kind:'pause-resume-presentation-replay-candidate-v1',id:this.sourceId+':'+this.generation+':'+(++this.presentationSerial),resolution:'pending-forward-check',sourceId:this.sourceId,sourceEpoch:this.generation,timelineSegment:this.segment,previousPTS:previous,incomingPTS:time,previousAcceptedSample:b.anchor,lowerAcceptedSample:b.lowerAcceptedSample,lowerObservedPTS:b.lowerObservedPTS,pause:b.pause,resume:b.resume,incomingCapture:structuredClone(diagnostic),callbackMetadataObserved:true,pixelsObserved:false,replayCertified:false,observed:false,absenceCertified:false,independentDrawCertified:false,minimumProvenATCalls:0,frameRateAssumed:false,timeRetimed:false};
  const missing=metadata.presentedFrames-b.anchor.metadata.presentedFrames-1;
  record.missingPresentedFrames=missing;record.recentMissingPresentations=missing?[{afterPresentedFrames:b.anchor.metadata.presentedFrames,beforePresentedFrames:metadata.presentedFrames,missingPresentedFrames:missing,pixelsObserved:false,timestampsKnown:false,minimumProvenATCalls:0}]:[];
  diagnostic.outcome='pause-resume-presentation-withheld';diagnostic.presentationReplay=record;this.pendingPresentation={record,metadata:diagnosticMetadata(metadata)};this.notifyPresentation(record,metadata);return true;
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
  const inputDiscontinuity=structuredClone({schema:'file-video-input-discontinuity-v1',reason,observedAt:new Date().toISOString(),performanceNow:performance.now(),trigger,before,afterReset:this.diagnosticState(),previousAcceptedSamples:{...previousAcceptedSamples},lastScheduledCallback:this.trace.lastScheduled,lastCancelledCallback:this.trace.lastCancelled,recentCaptures:this.trace.captures,recentLifecycle:this.trace.lifecycle,retention:{maximumCaptures:8,maximumLifecycle:16,evicted:{...this.trace.evicted}},diagnosticOnly:true,resetRulesUnchanged:!this.presentationReplayEnabled,ordinaryBackwardComparisonUnchanged:true,pauseResumePresentationHoldEnabled:this.presentationReplayEnabled,frameRateAssumed:false});
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
  if(!Number.isFinite(time)){diagnostic.outcome='nonfinite-time';return;}
  if(this.presentationReplayEnabled&&this.pauseResumePresentation(metadata,context,diagnostic,clock,time,previous))return;
  if(time===previous){diagnostic.outcome='same-clock-duplicate';return;}
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
 stop(){this.clearPresentation('stop');const event=this.lifecycle('stop');this.generation++;this.running=false;this.cancel();if(this.url){this.video.pause();this.video.removeAttribute('src');this.video.load();URL.revokeObjectURL(this.url);this.url=null;}this.sourceId=null;this.segment=0;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};this.trace.clockSamples={currentTime:null,mediaTime:null};event.after=this.diagnosticState();}
}
