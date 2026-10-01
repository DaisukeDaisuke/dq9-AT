// Local object URLs only. Media timestamps, not wall-clock playback duration, identify frames.
export class FileVideoInput {
 constructor(video,onFrame,onError,onDiscontinuity=()=>{}) {
  Object.assign(this,{video,onFrame,onError,onDiscontinuity,interval:500,url:null,sourceId:null,generation:0,segment:0,frameId:null,lastMediaTime:null,lastClock:null,clockTimes:{currentTime:null,mediaTime:null},running:false});
  this.handlers={
   loadeddata:()=>this.capture(), play:()=>{this.running=true;this.queue();},
   pause:()=>{this.running=false;this.cancel();}, ended:()=>{this.running=false;this.cancel();},
   seeking:()=>{this.generation++;this.segment++;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};this.cancel();this.onDiscontinuity('seek',this.snapshot());},
   seeked:()=>{this.capture();if(!this.video.paused)this.queue();},
   error:()=>{this.running=false;this.cancel();this.onError(new Error('動画を再生できません。ブラウザ対応のWebM / MP4を選択してください。'));}
  };
  for(const [name,handler] of Object.entries(this.handlers))video.addEventListener(name,()=>{if(this.url)handler();});
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
  this.stop();this.sourceId=globalThis.crypto?.randomUUID?.()||`local-${Date.now()}-${this.generation}`;
  this.url=URL.createObjectURL(file);this.video.srcObject=null;this.video.autoplay=false;this.video.src=this.url;this.video.load();
  this.onDiscontinuity('file-replacement',this.snapshot());
 }
 cancel(){if(this.frameId!==null){if(this.video.cancelVideoFrameCallback)this.video.cancelVideoFrameCallback(this.frameId);else cancelAnimationFrame(this.frameId);}this.frameId=null;}
 capture(metadata){if(!this.url||this.video.seeking||this.video.readyState<2)return;
  const precise=Number.isFinite(metadata?.mediaTime),clock=precise?'mediaTime':'currentTime',time=precise?metadata.mediaTime:this.video.currentTime,previous=this.clockTimes[clock];
  if(!Number.isFinite(time)||time===previous)return;
  // A paused/seeked currentTime can lie just after the decoded frame PTS.
  // Compare regressions within each clock only, even across a clock switch.
  if(previous!==null&&time<previous){this.generation++;this.segment++;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};this.onDiscontinuity('backward-time',this.snapshot(metadata));}
  if(this.lastClock===clock&&this.lastMediaTime!==null&&time>=this.lastMediaTime&&time-this.lastMediaTime<this.interval/1000)return;
  this.clockTimes[clock]=time;this.lastClock=clock;this.lastMediaTime=time;const sample=this.snapshot(metadata);Promise.resolve(this.onFrame(performance.now(),sample)).catch(error=>{if(sample.sourceEpoch===this.generation)this.onError(error);});
 }
 queue(){if(!this.url||!this.running||this.frameId!==null)return;const generation=this.generation;const tick=(_now,metadata)=>{this.frameId=null;if(generation!==this.generation||!this.url)return;this.capture(metadata);this.queue();};this.frameId=this.video.requestVideoFrameCallback?this.video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);}
 stop(){this.generation++;this.running=false;this.cancel();if(this.url){this.video.pause();this.video.removeAttribute('src');this.video.load();URL.revokeObjectURL(this.url);this.url=null;}this.sourceId=null;this.segment=0;this.lastMediaTime=null;this.lastClock=null;this.clockTimes={currentTime:null,mediaTime:null};}
}
