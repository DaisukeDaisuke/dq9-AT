// Adapted from BattleEmulator/public/vision.js populateCameras/connectCamera/queueLoop.
// Battle-only UI and pre-extracted vision assets are deliberately not carried over.
export class CameraInput {
 constructor(video,onFrame,onError){this.video=video;this.onFrame=onFrame;this.onError=onError;this.stream=null;this.running=false;this.frameId=null;this.lastFrame=0;this.interval=500;this.generation=0;}
 async list(){if(!navigator.mediaDevices?.enumerateDevices)throw Error('HTTPSのカメラ対応ブラウザが必要です');return (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');}
 async connect(deviceId){this.stop();const generation=this.generation;const constraints={audio:false,video:{width:{ideal:1920},height:{ideal:1080}}};if(deviceId)constraints.video.deviceId={exact:deviceId};const stream=await navigator.mediaDevices.getUserMedia(constraints);if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
  this.stream=stream;this.video.srcObject=stream;await this.video.play();if(generation!==this.generation)return;this.running=true;this.lastFrame=0;for(const track of stream.getTracks())track.onended=()=>{if(this.stream===stream){this.stop();this.onError(new Error('映像入力が終了しました。AT下限は保持し、観測の空白として扱います。'));}};this.queue();
 }
 queue(){if(!this.running)return;const generation=this.generation;const tick=async now=>{if(!this.running||generation!==this.generation)return;try{if(this.video.readyState>=2&&now-this.lastFrame>=this.interval){this.lastFrame=now;await this.onFrame(now);}}catch(error){this.onError(error);}if(generation===this.generation)this.queue();};this.frameId=this.video.requestVideoFrameCallback?this.video.requestVideoFrameCallback((now,meta)=>tick(meta.expectedDisplayTime??now)):requestAnimationFrame(tick);}
 stop(){this.generation++;this.running=false;if(this.frameId!==null){if(this.video.cancelVideoFrameCallback)this.video.cancelVideoFrameCallback(this.frameId);else cancelAnimationFrame(this.frameId);}this.frameId=null;if(this.stream){this.stream.getTracks().forEach(t=>t.stop());this.stream=null;}this.video.srcObject=null;}
}
