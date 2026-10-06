import{createFrozenAnalysisCapture}from'./capture-analysis-pixels.mjs?v=native-continuation-20261006-0333';
import{gameplayVideoROI,gameplaySampleReadbackRect,sampleGameplayFrame}from'./map-video-residual.mjs?v=capture-gate-reseed-20261006-0850';
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const verificationScope='One captured frame compared on the same Canvas after one retained VideoFrame draw. This is not proof for every frame, input, browser or GPU.';
/** Bounded actual capture: one pending pixel hash, one reusable source canvas.
 * The cadence is a work budget. Skipped callbacks are not invented frames. */
export function createVideoTrackingCapture({video,replay,document:doc=globalThis.document,minimumCaptureIntervalSeconds=.1,makeCapture=createFrozenAnalysisCapture,hash=sha}){
 let generation=0,busy=false,lastSource=null,lastIdentity=null,lastPTS=-Infinity,canvas=null,readback=null;
 function reset(reason){generation++;lastSource=null;lastIdentity=null;lastPTS=-Infinity;readback=null;replay.reset(reason);}
 function snapshot(){return readback?structuredClone(readback):{kind:'same-canvas-readback-gate-v1',mode:'unverified',reason:'waiting-for-valid-capture',verification:null,scope:verificationScope};}
 function readImage(context,width,height,roi,sourceRect,bound,stamp,layout){
  if(!readback)readback={kind:'same-canvas-readback-gate-v1',mode:'pending',reason:'first-valid-frame',source:{sourceId:stamp.sourceId,sourceEpoch:stamp.sourceEpoch,timelineSegment:stamp.timelineSegment,width,height,layout},sourceRect:{...sourceRect},fullReadbacks:0,croppedReadbacks:0,returnedReadbackBytes:0,verification:null,scope:verificationScope};
  const state=readback,fullBytes=width*height*4,croppedBytes=sourceRect.w*sourceRect.h*4;
  const readFull=()=>{state.fullReadbacks++;const pixels=context.getImageData(0,0,width,height);state.returnedReadbackBytes+=pixels.data.byteLength;return sampleGameplayFrame({width,height,rgba:pixels.data},roi);};
  const readCrop=()=>{state.croppedReadbacks++;const pixels=context.getImageData(sourceRect.x,sourceRect.y,sourceRect.w,sourceRect.h);state.returnedReadbackBytes+=pixels.data.byteLength;return sampleGameplayFrame({width,height,rgba:pixels.data},roi,{sourceRect});};
  const fallback=reason=>{state.mode='full';state.reason=reason;};
  // No speculative second read when it cannot save any returned bytes.
  if(state.mode==='pending'&&croppedBytes===fullBytes)fallback('full-frame-rectangle-no-byte-saving');
  if(state.mode==='full')return{image:readFull(),state};
  if(state.mode==='cropped'){
   try{return{image:readCrop(),state};}catch(error){fallback('cropped-read-failed-after-check: '+error.message);return{image:readFull(),state};}
  }
  // The only probe for this source/epoch/segment/size/layout. It is synchronous:
  // no verification promise, additional hash, pixel history or queue is kept.
  const verification=state.verification={result:'checking',mediaTime:bound.mediaTime,pixelTimestampUs:bound.captureTiming.pixelTimestampUs??null,comparedBytes:0,differentBytes:null,firstMismatchByte:null,fullReadbackBytes:fullBytes,croppedReadbackBytes:croppedBytes,scope:verificationScope};
  let image;
  try{image=readFull();}catch(error){verification.result='full-read-failed';fallback('initial-full-read-failed: '+error.message);throw error;}
  try{
   const other=readCrop();let differentBytes=0,firstMismatchByte=null;
   for(let i=0;i<image.rgba.length;i++)if(image.rgba[i]!==other.rgba[i]){differentBytes++;firstMismatchByte??=i;}
   Object.assign(verification,{comparedBytes:image.rgba.length,differentBytes,firstMismatchByte,result:differentBytes?'mismatch':'match'});
   if(differentBytes)fallback('same-canvas-sampled-bytes-differ');else{state.mode='cropped';state.reason='one-frame-sampled-bytes-match';}
  }catch(error){verification.result='cropped-read-failed';fallback('initial-cropped-read-failed: '+error.message);}
  // Even a successful first probe publishes the original full-read sample.
  // The second buffer is only temporary and is never retained or hashed.
  return{image,state,probe:verification};
 }
 function offer(stamp,{layout}={}){
  const pts=stamp.mediaTime??stamp.videoTime,width=video.videoWidth,height=video.videoHeight,identity=JSON.stringify([stamp.sourceId,stamp.sourceEpoch,stamp.timelineSegment,width,height]);
  // Unknown layout is a missing observation, not an established source layout.
  // Epoch/segment/size changes still invalidate old captures immediately.
  if(identity!==lastIdentity){generation++;if(lastIdentity!==null)replay.reset('fast-capture-source-changed');lastIdentity=identity;lastSource=null;lastPTS=-Infinity;readback=null;}
  if(!layout){replay.noteGap(stamp,'fast-capture-layout-unavailable');return false;}
  const source=JSON.stringify([identity,layout]);
  if(source!==lastSource){generation++;if(lastSource!==null)replay.reset('fast-capture-source-changed');lastSource=source;lastPTS=-Infinity;readback=null;}
  if(busy){replay.noteGap(stamp,'fast-capture-busy');return false;}
  if(!Number.isFinite(pts)||pts-lastPTS<minimumCaptureIntervalSeconds)return false;
  const mine=generation;let image,bound,capture,state,probe;
  try{
   const roi=gameplayVideoROI(width,height,layout);canvas??=doc.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});
   capture=makeCapture(video);capture.draw(context,width,height);bound=capture.stamp(stamp);
   if(bound.captureTiming?.pixelTimestampBound!==true){replay.noteGap(bound,'fast-pixel-timestamp-unbound');capture.close();return false;}
   ({image,state,probe}=readImage(context,width,height,roi,gameplaySampleReadbackRect(width,height,roi),bound,stamp,layout));capture.close();capture=null;
   bound={...bound,layout,roi};lastPTS=bound.mediaTime;busy=true;
   void hash(image.rgba).then(gameplayRGBA_SHA256=>{if(mine===generation){if(probe&&readback===state&&state.verification===probe)probe.sampleSHA256=gameplayRGBA_SHA256;replay.retain({image,stamp:{...bound,gameplayRGBA_SHA256}});}},error=>{if(mine===generation)replay.noteGap(bound,'fast-capture-hash-failed: '+error.message);}).finally(()=>{busy=false;});return true;
  }catch(error){capture?.close();busy=false;replay.noteGap(stamp,'fast-capture-unavailable: '+error.message);return false;}
 }
 return{offer,reset,cancel:reset,snapshot,get busy(){return busy;}};
}
