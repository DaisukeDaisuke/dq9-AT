import{createFrozenAnalysisCapture}from'./capture-analysis-pixels.mjs?v=native-continuation-20261006-0333';
import{gameplayVideoROI,sampleGameplayFrame}from'./map-video-residual.mjs';
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
/** Bounded actual capture: one pending pixel hash, one reusable source canvas.
 * The cadence is a work budget. Skipped callbacks are not invented frames. */
export function createVideoTrackingCapture({video,replay,document:doc=globalThis.document,minimumCaptureIntervalSeconds=.1,makeCapture=createFrozenAnalysisCapture,hash=sha}){
 let generation=0,busy=false,lastSource=null,lastIdentity=null,lastPTS=-Infinity,canvas=null;
 function reset(reason){generation++;lastSource=null;lastIdentity=null;lastPTS=-Infinity;replay.reset(reason);}
 function offer(stamp,{layout}={}){
  const pts=stamp.mediaTime??stamp.videoTime,identity=JSON.stringify([stamp.sourceId,stamp.sourceEpoch,stamp.timelineSegment]);
  // Unknown layout is a missing observation, not an established source layout.
  // Epoch/segment changes still invalidate old captures immediately.
  if(identity!==lastIdentity){generation++;if(lastIdentity!==null)replay.reset('fast-capture-source-changed');lastIdentity=identity;lastSource=null;lastPTS=-Infinity;}
  if(!layout){replay.noteGap(stamp,'fast-capture-layout-unavailable');return false;}
  // Callback currentTime/VFC clocks may switch during normal activation. The
  // captured pixel clock is validated below and stays in replay frame evidence.
  const source=JSON.stringify([identity,layout]);
  if(source!==lastSource){generation++;if(lastSource!==null)replay.reset('fast-capture-source-changed');lastSource=source;lastPTS=-Infinity;}
  if(busy){replay.noteGap(stamp,'fast-capture-busy');return false;}
  if(!Number.isFinite(pts)||pts-lastPTS<minimumCaptureIntervalSeconds)return false;
  const mine=generation;let image,bound,capture;
  try{
   const width=video.videoWidth,height=video.videoHeight,roi=gameplayVideoROI(width,height,layout);canvas??=doc.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});
   capture=makeCapture(video);capture.draw(context,width,height);bound=capture.stamp(stamp);
   if(bound.captureTiming?.pixelTimestampBound!==true){replay.noteGap(bound,'fast-pixel-timestamp-unbound');capture.close();return false;}
   const full=context.getImageData(0,0,width,height);image=sampleGameplayFrame({width,height,rgba:full.data},roi);capture.close();capture=null;
   bound={...bound,layout,roi};lastPTS=bound.mediaTime;busy=true;
   void hash(image.rgba).then(gameplayRGBA_SHA256=>{if(mine===generation)replay.retain({image,stamp:{...bound,gameplayRGBA_SHA256}});},error=>{if(mine===generation)replay.noteGap(bound,'fast-capture-hash-failed: '+error.message);}).finally(()=>{busy=false;});return true;
  }catch(error){capture?.close();busy=false;replay.noteGap(stamp,'fast-capture-unavailable: '+error.message);return false;}
 }
 return{offer,reset,cancel:reset,get busy(){return busy;}};
}
