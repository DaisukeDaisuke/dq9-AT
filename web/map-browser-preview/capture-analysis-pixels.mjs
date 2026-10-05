/* Auxiliary deterministic analysis pixels from the SAME retained decoded frame.
 * Original Canvas pixels remain the display/residual/recognition input.
 * Supports only explicit limited-range BT.709 I420/NV12, with no transfer/gamut
 * guessing, browser-converter assumption, fitted offsets, or parameter search.
 */
const need=(x,m)=>{if(!x)throw Error(m);},abort=()=>new DOMException('Frozen analysis frame invalidated','AbortError');
const frameCanvasRGBA=(frame,width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(frame,0,0,width,height);return context.getImageData(0,0,width,height).data;};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export const ANALYSIS_PIXEL_PROFILE='decoded-yuv-bt709-limited-rgb-nearest-v1';
export function decodeYuvAnalysisPixels({bytes,format,width,height,layout,colorSpace,roi}){
 need(bytes instanceof Uint8Array,'Decoded YUV byte buffer required');need(['I420','NV12'].includes(format),'Decoded format outside supported I420/NV12 analysis profile');
 need(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width%2===0&&height%2===0,'Even decoded visible dimensions required');
 need(colorSpace?.matrix==='bt709'&&colorSpace.primaries==='bt709'&&colorSpace.transfer==='bt709'&&colorSpace.fullRange===false,'Explicit limited-range BT709 matrix/primaries/transfer required');
 need(roi&&['x','y','w','h'].every(k=>Number.isInteger(roi[k]))&&roi.x>=0&&roi.y>=0&&roi.w>0&&roi.h>0&&roi.x+roi.w<=width&&roi.y+roi.h<=height,'Analysis ROI outside decoded visible image');
 const dimensions=format==='I420'?[[width,height],[width/2,height/2],[width/2,height/2]]:[[width,height],[width,height/2]];
 need(Array.isArray(layout)&&layout.length===dimensions.length,'Decoded plane layout mismatch');
 dimensions.forEach(([w,h],i)=>{const p=layout[i];need(Number.isInteger(p.offset)&&p.offset>=0&&Number.isInteger(p.stride)&&p.stride>=w&&p.offset+(h-1)*p.stride+w<=bytes.length,'Decoded plane offset/stride outside copied bytes');});
 const rgb=(x,y)=>{const yy=bytes[layout[0].offset+y*layout[0].stride+x],cx=x>>1,cy=y>>1,u=bytes[layout[1].offset+cy*layout[1].stride+(format==='NV12'?cx*2:cx)],v=format==='NV12'?bytes[layout[1].offset+cy*layout[1].stride+cx*2+1]:bytes[layout[2].offset+cy*layout[2].stride+cx];
  // BT.709 Kr/Kb and studio-range code endpoints. These are format constants,
  // not inferred from a map/video. No libyuv capped-blue approximation is used.
  const Y=(yy-16)*255/219,U=(u-128)*255/224,V=(v-128)*255/224,Kr=.2126,Kb=.0722,Kg=1-Kr-Kb;
  return[Y+2*(1-Kr)*V,Y-2*Kb*(1-Kb)/Kg*U-2*Kr*(1-Kr)/Kg*V,Y+2*(1-Kb)*U].map(n=>Math.max(0,Math.min(255,Math.round(n))));
 };
 const rgba=new Uint8ClampedArray(256*192*4),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // The same pixel-center bilinear convention as sampleGameplayFrame: convert
 // each source RGB pixel before sampling, preserving the order of operations.
 for(let y=0;y<192;y++)for(let x=0;x<256;x++){const fx=clamp(roi.x+(x+.5)*roi.w/256-.5,roi.x,roi.x+roi.w-1),fy=clamp(roi.y+(y+.5)*roi.h/192-.5,roi.y,roi.y+roi.h-1),ix=Math.floor(fx),iy=Math.floor(fy),jx=Math.min(ix+1,roi.x+roi.w-1),jy=Math.min(iy+1,roi.y+roi.h-1),dx=fx-ix,dy=fy-iy,p=[rgb(ix,iy),rgb(jx,iy),rgb(ix,jy),rgb(jx,jy)],at=(y*256+x)*4;for(let c=0;c<3;c++)rgba[at+c]=p[0][c]*(1-dx)*(1-dy)+p[1][c]*dx*(1-dy)+p[2][c]*(1-dx)*dy+p[3][c]*dx*dy;rgba[at+3]=255;}
 return{width:256,height:192,rgba};
}
export function createFrozenAnalysisCapture(video,{createFrame=v=>new VideoFrame(v),hash=digest,readFrameRGBA=frameCanvasRGBA}={}){
 let frame=null,unavailable=null,closed=false,binding=null,pending=null,result=null;const metadata={profile:ANALYSIS_PIXEL_PROFILE,ready:false,sameDecodedFrame:false};
 try{frame=createFrame(video);const r=frame.visibleRect;Object.assign(metadata,{sameDecodedFrame:false,retainedSynchronously:true,format:frame.format,colorSpace:{matrix:frame.colorSpace?.matrix,primaries:frame.colorSpace?.primaries,transfer:frame.colorSpace?.transfer,fullRange:frame.colorSpace?.fullRange},timestampUs:frame.timestamp,codedSize:{width:frame.codedWidth,height:frame.codedHeight},visibleRect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,displaySize:{width:frame.displayWidth,height:frame.displayHeight},rotation:frame.rotation??0,flip:frame.flip??false});}catch(error){unavailable='Retained decoded VideoFrame unavailable: '+error.message;}
 const release=()=>{if(frame){frame.close();frame=null;}};
 const check=()=>{if(closed)throw abort();};
 function close(reason='frame-invalidated'){if(closed)return;closed=true;metadata.invalidatedReason=reason;metadata.ready=false;release();result=null;}
 function draw(context,width,height){check();context.drawImage(video,0,0,width,height);}
 function bind(value){check();need(!binding,'Frozen analysis capture already bound');binding=structuredClone(value);metadata.frozenFrameId=binding.frameId;metadata.rawFullRGBA_SHA256=binding.rawFullRGBA_SHA256;metadata.rawGameplayRGBA_SHA256=binding.rawGameplayRGBA_SHA256;metadata.sourceId=binding.sourceId;metadata.sourceEpoch=binding.sourceEpoch;metadata.timelineSegment=binding.timelineSegment;metadata.mediaTime=binding.mediaTime;}
 async function prepare(){try{
  check();need(binding,'Frozen analysis identity not bound');need(frame&&!unavailable,unavailable??'Decoded frame is no longer retained');const r=metadata.visibleRect;need(['I420','NV12'].includes(metadata.format),'Decoded format outside supported I420/NV12 analysis profile');need(metadata.colorSpace?.matrix==='bt709'&&metadata.colorSpace.primaries==='bt709'&&metadata.colorSpace.transfer==='bt709'&&metadata.colorSpace.fullRange===false,'Explicit limited-range BT709 matrix/primaries/transfer required');
  need(binding.sourceSize?.width===metadata.displaySize.width&&binding.sourceSize?.height===metadata.displaySize.height,'Canvas size differs from retained decoded display');need(r&&r.x%2===0&&r.y%2===0&&metadata.displaySize.width===r.width&&metadata.displaySize.height===r.height,'Scaled/cropped display geometry outside decoded analysis profile');need(metadata.rotation===0&&!metadata.flip,'Rotated/flipped decoded analysis not connected');need(Number.isFinite(metadata.timestampUs),'Decoded timestamp unavailable');
  // Keep the existing HTMLVideoElement Canvas capture untouched. Verify that
  // a Canvas read of the retained decoded frame reproduces its exact raw hash
  // before attributing YUV to it. Different frame or converter stays unresolved.
  const retainedCanvas=await readFrameRGBA(frame,binding.sourceSize.width,binding.sourceSize.height);check();need(retainedCanvas?.length===binding.sourceSize.width*binding.sourceSize.height*4,'Retained frame Canvas read size differs');const retainedCanvasSHA256=await hash(retainedCanvas);check();need(retainedCanvasSHA256===binding.rawFullRGBA_SHA256,'Retained VideoFrame does not reproduce original Canvas pixels');Object.assign(metadata,{sameDecodedFrame:true,retainedCanvasSHA256});
  const rect={x:r.x,y:r.y,width:r.width,height:r.height},options={rect},bytes=new Uint8Array(frame.allocationSize(options)),layout=await frame.copyTo(bytes,options);check();release();
  const image=decodeYuvAnalysisPixels({bytes,format:metadata.format,width:r.width,height:r.height,layout,colorSpace:metadata.colorSpace,roi:binding.roi});check();const [copiedYuvSHA256,analysisRGBA_SHA256]=await Promise.all([hash(bytes),hash(image.rgba)]);check();
  Object.assign(metadata,{ready:true,copiedYuvSHA256,analysisRGBA_SHA256,planeLayout:layout.map(p=>({offset:p.offset,stride:p.stride})),copiedBytes:bytes.length,sampling:'source RGB nearest quantization then pixel-center bilinear 256x192',normalization:'Explicit BT709 limited-range YCbCr matrix only; encoded transfer domain retained; no fitted conversion',rawCanvasPixelsPreserved:true});
  result={ready:true,image,evidence:structuredClone(metadata)};return result;
 }catch(error){release();if(error.name==='AbortError')throw error;Object.assign(metadata,{ready:false,reason:error.message,rawCanvasPixelsPreserved:true});result={ready:false,reason:error.message,evidence:structuredClone(metadata)};return result;}}
 async function get({isCurrent=()=>true}={}){check();if(!isCurrent()){close('analysis-cancelled');throw abort();}pending??=prepare();const value=await pending;check();if(!isCurrent()){close('analysis-cancelled');throw abort();}return value;}
 return{draw,bind,get,close,evidence:()=>structuredClone(metadata),result:()=>result};
}

/** Preserve the legacy conditional RGB path when an auxiliary format is absent.
 * A stale/mismatched supposedly successful sidecar is NEVER a fallback input.
 */
export async function resolveFrozenInferencePixels({input,video,isCurrent=()=>true}){
 const current=()=>{if(!isCurrent())throw abort();};current();
 if(typeof input.getInferencePixels!=='function')return{ready:true,image:video,evidence:{kind:'caller-supplied-RGB-analysis',profile:null,rawCanvasPixelsPreserved:true,sourceFrame:input.frameEvidence,canonicalConversionVerified:false}};
 const result=await input.getInferencePixels({isCurrent});current();
 if(!result?.ready)return{ready:true,image:video,evidence:{kind:'legacy-Canvas-RGB-analysis',profile:'legacy-Canvas-RGB-v1',canonicalConversionVerified:false,auxiliary:{...result?.evidence,ready:false,reason:result?.reason??'readback unavailable'},rawFullRGBA_SHA256:input.frameEvidence?.fullRGBA_SHA256,rawCanvasPixelsPreserved:true}};
 const e=result.evidence,f=input.frameEvidence;
 need(e?.profile===ANALYSIS_PIXEL_PROFILE&&e.sameDecodedFrame===true&&e.frozenFrameId===input.frameId&&e.rawFullRGBA_SHA256===f?.fullRGBA_SHA256&&e.retainedCanvasSHA256===f?.fullRGBA_SHA256,'Analysis pixels do not belong to the verified frozen input frame');
 for(const key of['sourceId','sourceEpoch','timelineSegment'])if(f?.[key]!==undefined)need(e[key]===f[key],'Analysis source/timeline identity differs');
 need(result.image?.width===256&&result.image?.height===192&&result.image?.rgba?.length===196608,'Analysis pixel dimensions differ');
 return{...result,evidence:{...e,canonicalConversionVerified:true}};
}
