import{IMAGE_TRANSLATION_LIMITS,PROPOSAL_LIMITS}from'../monster-position-proposals.mjs?v=measured-replay-candidate-20261006-0653';
const W=256,H=192,N=W*H,finite=Number.isFinite;
export const videoTrackingSourceKey=s=>JSON.stringify([s?.sourceId,s?.sourceEpoch,s?.timelineSegment,s?.timestampBasis,s?.layout]);
export const videoTrackingFrameKey=s=>JSON.stringify([videoTrackingSourceKey(s),s?.mediaTime??s?.videoTime,s?.gameplayRGBA_SHA256]);
export function trackingGray(image){
 if(image?.width!==W||image?.height!==H||image.rgba?.length!==N*4)throw Error('Exact256x192 actual video pixels required');
 const gray=new Uint8Array(N),blocked=new Uint8Array(N);for(let i=0;i<N;i++){gray[i]=(image.rgba[i*4]*77+image.rgba[i*4+1]*150+image.rgba[i*4+2]*29)>>8;blocked[i]=image.rgba[i*4+3]===255?0:1;}return{gray,blocked};
}
export function patchTrackingFrame(frame,tracks){
 const mask=new Uint8Array(N);for(const t of tracks){const r=t.roi;for(let y=Math.max(0,Math.floor(r.y));y<Math.min(H,Math.ceil(r.y+r.h));y++)for(let x=Math.max(0,Math.floor(r.x));x<Math.min(W,Math.ceil(r.x+r.w));x++)mask[y*W+x]=1;}
 return{width:W,height:H,gray:frame.gray,blocked:frame.blocked,mask,identity:videoTrackingSourceKey(frame.stamp)};
}
function registerPatch(previous,current,roi,{maximumSamples=1024}={}){
 const limits=IMAGE_TRANSLATION_LIMITS,r={x:Math.round(roi.x),y:Math.round(roi.y),w:Math.round(roi.w),h:Math.round(roi.h)};
 const fail=reason=>({ready:false,reason,identityCertified:false,calibrated:false});
 if(![r.x,r.y,r.w,r.h].every(finite)||r.w<=0||r.h<=0)return fail('patch-bounds-unavailable');
 // This limits work, not object size or identity confidence. The source
 // registration's unchanged minimum known-sample count still applies.
 const stride=Math.max(1,Math.ceil(Math.sqrt(r.w*r.h/maximumSamples))),samples=[];let texture=0,textureCount=0;
 for(let y=Math.max(0,r.y);y<Math.min(H,r.y+r.h);y+=stride)for(let x=Math.max(0,r.x);x<Math.min(W,r.x+r.w);x+=stride){const i=y*W+x;if(previous.blocked[i])continue;samples.push(i);if(x+1<Math.min(W,r.x+r.w)&&!previous.blocked[i+1]){texture+=Math.abs(previous.gray[i]-previous.gray[i+1]);textureCount++;}if(y+1<Math.min(H,r.y+r.h)&&!previous.blocked[i+W]){texture+=Math.abs(previous.gray[i]-previous.gray[i+W]);textureCount++;}}
 texture=textureCount?texture/textureCount:0;if(samples.length<limits.minimumSamples)return fail('insufficient-known-patch-samples');if(texture<limits.minimumTexture)return fail('patch-texture-unresolved');
 const costs=new Map();
 function cost(dx,dy){const k=dx+','+dy;if(costs.has(k))return costs.get(k);let sum=0,count=0;const offset=dy*W+dx;for(const i of samples){const x=i%W+dx,y=Math.floor(i/W)+dy;if(x<0||x>=W||y<0||y>=H||current.blocked[i+offset])continue;sum+=Math.min(limits.residualClip,Math.abs(previous.gray[i]-current.gray[i+offset]));count++;}const value=count>=limits.minimumSamples?sum/count:Infinity;costs.set(k,value);return value;}
 let best={dx:0,dy:0,residual:cost(0,0)};
 for(let dy=-limits.radius;dy<=limits.radius;dy+=2)for(let dx=-limits.radius;dx<=limits.radius;dx+=2){const residual=cost(dx,dy);if(residual<best.residual)best={dx,dy,residual};}
 const rough={...best};for(let dy=Math.max(-limits.radius,rough.dy-1);dy<=Math.min(limits.radius,rough.dy+1);dy++)for(let dx=Math.max(-limits.radius,rough.dx-1);dx<=Math.min(limits.radius,rough.dx+1);dx++){const residual=cost(dx,dy);if(residual<best.residual)best={dx,dy,residual};}
 if(!finite(best.residual)||best.residual>limits.maximumResidual||Math.abs(best.dx)>=limits.radius||Math.abs(best.dy)>=limits.radius)return fail('patch-registration-outside-existing-gates');
 // An exact tied minimum is unresolved. This adds a conservative ambiguity
 // rejection, never a fitted score margin or an identity certificate.
 if([...costs.values()].filter(v=>v===best.residual).length!==1)return fail('patch-registration-tied');
 const knownSamples=samples.filter(i=>{const x=i%W+best.dx,y=Math.floor(i/W)+best.dy;return x>=0&&x<W&&y>=0&&y<H&&!current.blocked[y*W+x];}).length;
 const partialPatch=r.x<0||r.y<0||r.x+r.w>W||r.y+r.h>H||r.x+best.dx<0||r.y+best.dy<0||r.x+r.w+best.dx>W||r.y+r.h+best.dy>H;
 return{ready:true,...best,texture,samples:samples.length,knownSamples,partialPatch,roi:r,calibrated:false,searchComplete:false,identityCertified:false};
}
export function correspondVideoPatch(previous,current,roi,options){
 const from=previous.stamp.mediaTime??previous.stamp.videoTime,to=current.stamp.mediaTime??current.stamp.videoTime,dt=to-from;
 const fail=(reason,extra={})=>({ready:false,reason,...extra,identityCertified:false,birthCertified:false,absenceCertified:false,minimumProvenATCalls:0});
 if(videoTrackingSourceKey(previous.stamp)!==videoTrackingSourceKey(current.stamp))return fail('source-identity-changed');
 if(!(dt>0&&dt<=PROPOSAL_LIMITS.maxGapSeconds))return fail('unobserved-time-gap');
 const forward=registerPatch(previous,current,roi,options);if(!forward.ready)return fail(forward.reason,{forward});
 const translated={...forward.roi,x:forward.roi.x+forward.dx,y:forward.roi.y+forward.dy},backward=registerPatch(current,previous,translated,options);
 if(!backward.ready||backward.dx!==-forward.dx||backward.dy!==-forward.dy)return fail('bidirectional-patch-correspondence-unresolved',{forward,backward});
 const x=Math.max(0,translated.x),y=Math.max(0,translated.y),observedROI={x,y,w:Math.max(0,Math.min(W,translated.x+translated.w)-x),h:Math.max(0,Math.min(H,translated.y+translated.h)-y)};
 return{ready:true,roi:translated,observedROI,unobservedPatchPixels:translated.w*translated.h-observedROI.w*observedROI.h,partialPatch:forward.partialPatch||backward.partialPatch,forward,backward,fromFrameKey:previous.key,toFrameKey:current.key,sourcePTS:[from,to],kind:'tentative-bidirectional-video-patch-correspondence',identityCertified:false,bodyExtentCertified:false,birthCertified:false,absenceCertified:false,minimumProvenATCalls:0};
}
