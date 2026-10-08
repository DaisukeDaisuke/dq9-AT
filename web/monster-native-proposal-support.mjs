// Attribution of an unchanged native rendering objective, not body membership.
// The original four-connected component is recovered by the existing producer.
import {originalResidualProposalSupport} from './map-browser-preview/residual-proposal-support.mjs';
import {packBackgroundMask,unpackBackgroundMask} from './map-browser-preview/background-branch-support.mjs?v=native-lineage-at-20261008-556f7ca6';
const KIND='conditional-source-native-original-proposal-support-v1',clone=structuredClone;
export function projectNativeOriginalProposalSupport(request,region){
 // Repeated transport must preserve unknown/malformed evidence, never turn it
 // into a different component or infer a mask from its bounding rectangle.
 const s=region.originalProposalSupport??originalResidualProposalSupport(request.nativeComparison,region,{nativeVideo:request.nativeVideo,sourcePixelSHA256:request.videoEvidence?.fullRGBA_SHA256});
 const out={kind:s.kind,ready:s.ready,reason:s.reason,originalResidualId:s.originalResidualId,sourcePixelSHA256:s.sourcePixelSHA256,pixelBinding:s.pixelBinding,roi:clone(s.roi),pixels:s.pixels,absenceCertified:s.absenceCertified};
 if(s.mask instanceof Uint8Array)out.packedMask=packBackgroundMask(s.mask);else if(s.packedMask!==undefined)out.packedMask=clone(s.packedMask);
 return out;
}
export function nativeOriginalProposalAttribution(render,evidence,fit){
 const {width:W,height:H,rgba}=render,{region,videoRGBA,backgroundRGBA,validMask,sourcePixelSHA256}=evidence,s=evidence.originalProposalSupport,q=region?.roi,N=W*H;
 const unknown=reason=>({kind:KIND,ready:false,originalResidualId:region?.id??null,sourcePixelSHA256:sourcePixelSHA256??null,reason,bodyMembershipCertified:false,bodyContributionCertified:false,absenceCertified:false,minimumProvenATCalls:0});
 try{
  if(W!==256||H!==192||s?.kind!=='original-residual-component-support-v1'||s.ready!==true||s.pixelBinding!=='same-frozen-native-video-background-residual-mask'||!/^[a-f0-9]{64}$/.test(sourcePixelSHA256??'')||s.sourcePixelSHA256!==sourcePixelSHA256||s.originalResidualId!==region.id||s.pixels!==region.pixels||!Number.isSafeInteger(s.pixels)||s.pixels<=0||!['x','y','w','h'].every(k=>s.roi?.[k]===q?.[k]))return unknown(s?.reason??'Exact original component/frame binding unavailable');
  const mask=s.mask instanceof Uint8Array?s.mask:unpackBackgroundMask(s.packedMask);if(mask.length!==N)return unknown('Original component mask size differs');
  let pixels=0,knownPixels=0,knownRenderedPixels=0,backgroundSSE=0,renderedSSE=0,outsideBackgroundSSE=0,outsideRenderedSSE=0,outsideKnownRenderedPixels=0,unchangedOutsideRasterPixels=0;
  for(let i=0;i<N;i++){
   const own=mask[i],x=i%W,y=(i/W)|0;if((own!==0&&own!==1)||(validMask[i]!==0&&validMask[i]!==1)||own&&(x<q.x||x>=q.x+q.w||y<q.y||y>=q.y+q.h))return unknown('Original component mask is nonbinary or outside its bound ROI');pixels+=own;
   if(!validMask[i])continue;const a=rgba[i*4+3]/255;
   if(own){knownPixels++;if(a>0)knownRenderedPixels++;else unchangedOutsideRasterPixels++;}else if(a>0)outsideKnownRenderedPixels++;
   if(!own&&!a)continue;
   for(let c=0;c<3;c++){const v=videoRGBA[i*4+c],b=backgroundRGBA[i*4+c],p=a?b*(1-a)+rgba[i*4+c]*a:b,nb=(v-b)**2,pr=(v-p)**2;if(own){backgroundSSE+=nb;renderedSSE+=pr;}else{outsideBackgroundSSE+=nb;outsideRenderedSSE+=pr;}}
  }
  if(pixels!==s.pixels)return unknown('Original component pixel count differs');
  const gain=backgroundSSE-renderedSSE,outsideGain=outsideBackgroundSSE-outsideRenderedSSE;
  if(gain+outsideGain!==fit.pixelErrorReduction)return unknown('Original component gain does not partition the unchanged full-fit gain');
  return{kind:KIND,ready:true,originalResidualId:region.id,sourcePixelSHA256,originalROI:{...q},componentPixels:pixels,knownPixels,unavailablePixels:pixels-knownPixels,knownRenderedPixels,unchangedOutsideRasterPixels,backgroundSSE,renderedSSE,pixelErrorReduction:gain,outsideProposal:{knownRenderedPixels:outsideKnownRenderedPixels,backgroundSSE:outsideBackgroundSSE,renderedSSE:outsideRenderedSSE,pixelErrorReduction:outsideGain},sourceAcceptedSubset:render.sourceAcceptedSubset??null,sceneOcclusionApplied:render.sceneOcclusionApplied===true,bodyMembershipCertified:false,bodyContributionCertified:false,absenceCertified:false,minimumProvenATCalls:0,scope:'Exact original-component partition of the unchanged full-fit gain. Component SSE includes unchanged background outside the rendered alpha footprint; the legacy full-fit SSE remains untouched. A scene/map/MSE contribution or final color-writer mask is not attributed to a physical body.'};
 }catch(error){return unknown('Original native component attribution unavailable: '+error.message);}
}
export function nativeOriginalProposalDecision(fit,{sourcePixelSHA256,originalResidualId}={}){
 const s=fit?.originalProposalSupport,ready=s?.kind===KIND&&s.ready===true&&/^[a-f0-9]{64}$/.test(sourcePixelSHA256??'')&&s.sourcePixelSHA256===sourcePixelSHA256&&s.originalResidualId===originalResidualId&&fit.regionId===originalResidualId&&Number.isSafeInteger(s.componentPixels)&&s.componentPixels>0&&s.knownPixels===s.componentPixels&&s.unavailablePixels===0&&Number.isFinite(s.backgroundSSE)&&s.backgroundSSE>=0&&Number.isFinite(s.renderedSSE)&&s.renderedSSE>=0&&Number.isFinite(s.pixelErrorReduction)&&s.pixelErrorReduction===s.backgroundSSE-s.renderedSSE&&Number.isFinite(s.outsideProposal?.pixelErrorReduction)&&s.pixelErrorReduction+s.outsideProposal.pixelErrorReduction===fit.pixelErrorReduction;
 return{ready,positive:ready&&s.pixelErrorReduction>0,status:ready?s.pixelErrorReduction>0?'positive-original-proposal-support':'original-proposal-not-improved':'original-proposal-support-unavailable',originalResidualId:originalResidualId??null,sourcePixelSHA256:sourcePixelSHA256??null,pixelErrorReduction:ready?s.pixelErrorReduction:null,bodyMembershipCertified:false,bodyContributionCertified:false,absenceCertified:false,minimumProvenATCalls:0};
}
