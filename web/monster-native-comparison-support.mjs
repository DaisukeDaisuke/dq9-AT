// Complete tested RGB comparison and winning-body eligibility are separate.
// Private source witnesses never travel with serialized recognition evidence.
import {readNativeBodyColorLineage,nativeBodyColorLineageUsesDestination} from './monster-native-color-lineage.mjs?v=recognition-20261008-7cf64cf4';
import {sourcePixelComparisonBinding,sameSourcePixelComparison} from './native-pixel-comparison-binding.mjs?v=native-scene-link-20261007-0354';
const N=256*192,KIND='complete-source-native-comparison-v1',rasters=new WeakMap(),destinations=new WeakMap(),contexts=new WeakMap(),cache=new WeakMap();
const keys=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const validFrame=f=>f&&/^[a-f0-9]{64}$/.test(f.romSHA256??'')&&/^[a-f0-9]{64}$/.test(f.fullRGBA_SHA256??'')&&typeof f.recordKey==='string'&&f.recordKey.length>0&&typeof f.sourceId==='string'&&f.sourceId.length>0&&['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(f[k])&&f[k]>=0)&&Number.isFinite(f.mediaTime)&&f.mediaTime>=0;
const sameFrame=(a,b)=>validFrame(a)&&validFrame(b)&&keys.every(k=>a[k]!==undefined&&a[k]!==null&&a[k]===b[k]);
const matrix=m=>Array.isArray(m)&&m.length===16&&m.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
const cameraKey=c=>matrix(c?.viewFx)&&matrix(c?.projectionFx)?JSON.stringify([c.viewFx,c.projectionFx]):null;
const sameCamera=(a,b)=>cameraKey(a)!==null&&cameraKey(a)===cameraKey(b);
const sameAlignment=(a,b)=>Number.isInteger(a?.dx)&&Number.isInteger(a?.dy)&&a.dx===b?.dx&&a.dy===b?.dy;
const rgba=x=>(x instanceof Uint8Array||x instanceof Uint8ClampedArray)&&x.length===N*4;
const mask=x=>{if(!(x instanceof Uint8Array)||x.length!==N)return false;if(x.byteOffset%4===0){const words=new Uint32Array(x.buffer,x.byteOffset,N/4);for(let i=0;i<words.length;i++)if(words[i]&0xfefefefe)return false;}else for(let i=0;i<N;i++)if(x[i]!==0&&x[i]!==1)return false;return true;};
const equal=(a,b)=>{if(a?.length!==b?.length)return false;if(a.BYTES_PER_ELEMENT===1&&b.BYTES_PER_ELEMENT===1&&a.byteOffset%4===0&&b.byteOffset%4===0&&a.length%4===0){const x=new Uint32Array(a.buffer,a.byteOffset,a.length/4),y=new Uint32Array(b.buffer,b.byteOffset,b.length/4);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;}else for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;};
const mixed=s=>['known-source-destination-mixed-body','conditional-source-map-actor-MSE-body'].includes(s);
const clone=x=>structuredClone(x);
/** Called only by the existing source destination binder, after it compares
 * reconstruction with the frozen null. Preserve exactly which B/validMask was
 * bound; same frame/camera labels alone cannot substitute another background. */
export function retainNativeBodyComparisonDestination(binding,backgroundRGBA,validMask){
 if(binding?.kind!=='same-frozen-source-destination-v1'||!rgba(backgroundRGBA)||!mask(validMask))return;
 destinations.set(binding,{backgroundRGBA:backgroundRGBA.slice(),validMask:validMask.slice()});
}
/** Called by rasterNativeBody, for its complete successful original-source
 * result. Mixed output already has the lineage producer's exact byte witness;
 * the isolated source output needs only a private raster/coverage snapshot. */
export function retainNativeBodyComparisonRaster(rendered,{program,camera,alignment}){
 try{
  if(rendered?.ready!==true||rendered.width!==256||rendered.height!==192||!rgba(rendered.rgba)||!mask(rendered.sourceCoverage)||!cameraKey(camera)||!sameAlignment(alignment,alignment)||typeof program?.modelId!=='string')return;
  const isolated=rendered.sourceAcceptedSubset==='isolated-opaque-binary-body-polygons'&&rendered.sceneOcclusionApplied===false&&rendered.raster==='source-integer-original-GX-body-subset';
  if(!isolated&&!(mixed(rendered.sourceAcceptedSubset)&&rendered.sceneOcclusionApplied===true&&rendered.raster==='source-integer-original-GX-body-composition-subset'))return;
  rasters.set(rendered.rgba,{program,modelId:program.modelId,cameraKey:cameraKey(camera),alignment:{...alignment},sourceAcceptedSubset:rendered.sourceAcceptedSubset,raster:rendered.raster,sourceCoverage:rendered.sourceCoverage,nativeState:rendered.nativeState,isolated,...(isolated?{pixels:rendered.rgba.slice(),coverage:rendered.sourceCoverage.slice()}:{})});
 }catch{}
}
/** Freeze and freshly verify the comparison tuple once per retained branch.
 * The private snapshots make subsequent independent score replay immutable.
 * A cache is keyed by the original binding and input references, never by a
 * serialized hash claim alone. Caller retains its existing stale-frame guard. */
export async function prepareNativeBodyComparison({frame,camera,alignment,videoRGBA,backgroundRGBA,validMask,comparisonBinding}){
 try{
  if(!sameFrame(frame,frame)||!cameraKey(camera)||!sameAlignment(alignment,alignment)||!rgba(videoRGBA)||!rgba(backgroundRGBA)||!(validMask instanceof Uint8Array)||validMask.length!==N||comparisonBinding?.sourcePixelSHA256!==frame.fullRGBA_SHA256)return null;
  const key=JSON.stringify([keys.map(k=>frame[k]),cameraKey(camera),alignment.dx,alignment.dy]),prior=cache.get(comparisonBinding);
  if(prior&&prior.key===key&&prior.videoRGBA===videoRGBA&&prior.backgroundRGBA===backgroundRGBA&&prior.validMask===validMask)return prior.token;
  if(!mask(validMask))return null;
  const frozen={sourcePixelSHA256:frame.fullRGBA_SHA256,videoRGBA:videoRGBA.slice(),backgroundRGBA:backgroundRGBA.slice(),validMask:validMask.slice()},fresh=await sourcePixelComparisonBinding(frozen);
  if(!sameSourcePixelComparison(fresh,comparisonBinding))return null;
  const token=Object.freeze({kind:'private-frozen-native-comparison'});contexts.set(token,{...frozen,frame:clone(frame),camera:clone(camera),alignment:{...alignment},comparisonBinding:clone(fresh),matchedDestinations:new WeakSet()});cache.set(comparisonBinding,{key,videoRGBA,backgroundRGBA,validMask,token});return token;
 }catch{return null;}
}
export function nativeBodyComparisonSupport(rendered,{context,program,destination,fit,proposalId,modelId}){
 const unavailable=reason=>({kind:KIND,ready:false,reason,identityCertified:false,minimumProvenATCalls:0});
 try{
  const c=contexts.get(context),r=rasters.get(rendered?.rgba);
  if(!c||!r||r.program!==program||r.modelId!==modelId||typeof proposalId!=='string'||rendered.ready!==true||rendered.width!==256||rendered.height!==192||r.sourceCoverage!==rendered.sourceCoverage||r.sourceAcceptedSubset!==rendered.sourceAcceptedSubset||r.raster!==rendered.raster||r.cameraKey!==cameraKey(c.camera)||!sameAlignment(r.alignment,c.alignment))return unavailable('Complete original-source raster or frozen comparison binding unavailable');
  let sourceDestinationBound=false;
  if(r.isolated){if(rendered.sceneOcclusionApplied!==false||rendered.raster!=='source-integer-original-GX-body-subset'||!equal(rendered.rgba,r.pixels)||!equal(rendered.sourceCoverage,r.coverage))return unavailable('Isolated source raster changed');}
  else{
   const lineage=readNativeBodyColorLineage(rendered,{frame:c.frame,camera:c.camera,alignment:c.alignment}),bound=destinations.get(destination?.binding);
   if(!lineage||rendered.nativeState!==r.nativeState||!nativeBodyColorLineageUsesDestination(rendered,destination?.binding)||!bound||!sameFrame(destination.binding.frame,c.frame)||!sameCamera(destination.binding.camera,c.camera)||!sameAlignment(destination.binding.alignment,c.alignment))return unavailable('Complete source composition is not bound to this frozen frame/camera');
   if(!c.matchedDestinations.has(bound)){if(!equal(bound.backgroundRGBA,c.backgroundRGBA)||!equal(bound.validMask,c.validMask))return unavailable('Complete source composition is not bound to these exact frozen background/validity bytes');c.matchedDestinations.add(bound);}
   sourceDestinationBound=true;
  }
  if(!rgba(rendered.rgba)||!mask(rendered.sourceCoverage))return unavailable('Malformed source raster bytes');
  let bodyPixels=0,backgroundSSE=0,bodySSE=0;
  for(let i=0;i<N;i++){
   const a=rendered.rgba[i*4+3]/255;if(!a)continue;bodyPixels++;
   if(c.validMask[i]!==1)return unavailable('A compared source-rendered pixel is unknown; partial comparison is not admitted');
   for(let channel=0;channel<3;channel++){const o=i*4+channel,v=c.videoRGBA[o],b=c.backgroundRGBA[o],pred=b*(1-a)+rendered.rgba[o]*a;backgroundSSE+=(v-b)**2;bodySSE+=(v-pred)**2;}
  }
  const gain=backgroundSSE-bodySSE;
  if(fit?.kind!=='conditional-source-perspective-body-comparison'||fit.raster!==rendered.raster||!Number.isFinite(gain)||fit.pixelErrorReduction!==gain||fit.backgroundSSE!==backgroundSSE||fit.bodySSE!==bodySSE||fit.bodyPixels!==bodyPixels||fit.knownBodyPixels!==bodyPixels||fit.unavailableBodyPixels!==0)return unavailable('Recorded score does not equal the full frozen pixel objective');
  return{kind:KIND,ready:true,frame:clone(c.frame),camera:clone(c.camera),alignment:{...c.alignment},modelId,sourceProposalId:proposalId,regionId:fit.regionId,sourceAcceptedSubset:r.sourceAcceptedSubset,raster:rendered.raster,sceneOcclusionApplied:rendered.sceneOcclusionApplied===true,sourceDestinationBoundToComparison:sourceDestinationBound,comparisonBinding:clone(c.comparisonBinding),completeSourceRasterVerified:true,completeComparedFootprintKnown:true,exactScoreReplayVerified:true,outsideRenderedFootprintUsesFrozenBackground:true,bodyPixels,knownBodyPixels:bodyPixels,unavailableBodyPixels:0,backgroundSSE,bodySSE,pixelErrorReduction:gain,winningBodySupportImplied:false,identityCertified:false,bodyAbsenceCertified:false,modelExcluded:false,minimumProvenATCalls:0,scope:'Complete known score of this one source hypothesis in the exact frozen RGB objective. Empty or degenerate body support does not invalidate ranking; a positive winner still needs separate body/component/appearance/UI eligibility.'};
 }catch(error){return unavailable('Source comparison metadata unavailable: '+error.message);}
}
export function completeNativeBodyComparison(best,{frame,camera,alignment,modelId,originalResidualId,backgroundRGBA_SHA256}){
 const p=best?.nativeComparisonSupport,f=best?.fit,e=best?.nativeBodyExtent;
 if(p?.kind!==KIND||p.ready!==true||!sameFrame(p.frame,frame)||!sameFrame(e?.frame,frame)||!sameCamera(p.camera,camera)||!sameAlignment(p.alignment,alignment)||p.modelId!==modelId||p.sourceProposalId!==best.proposalId||p.regionId!==originalResidualId||f?.kind!=='conditional-source-perspective-body-comparison'||f.regionId!==originalResidualId||p.raster!==f.raster||p.sourceAcceptedSubset!==e.sourceAcceptedSubset||p.sceneOcclusionApplied!==e.sceneOcclusionApplied)return false;
 if(!sameSourcePixelComparison(p.comparisonBinding,f.comparisonBinding)||p.comparisonBinding.sourcePixelSHA256!==frame.fullRGBA_SHA256||!/^[a-f0-9]{64}$/.test(backgroundRGBA_SHA256??'')||p.comparisonBinding.backgroundRGBA_SHA256!==backgroundRGBA_SHA256)return false;
 if(mixed(p.sourceAcceptedSubset)){
  const s=best.sceneComposition;
  if(p.raster!=='source-integer-original-GX-body-composition-subset'||p.sceneOcclusionApplied!==true||p.sourceDestinationBoundToComparison!==true||s?.partialBodyNotScored!==false||s.sourceAcceptedSubset!==p.sourceAcceptedSubset||s.binding?.kind!=='same-frozen-source-destination-v1'||!sameFrame(s.binding.frame,frame)||!sameCamera(s.binding.camera,camera)||!sameAlignment(s.binding.alignment,alignment))return false;
 }else if(p.sourceAcceptedSubset!=='isolated-opaque-binary-body-polygons'||p.raster!=='source-integer-original-GX-body-subset'||p.sceneOcclusionApplied!==false||p.sourceDestinationBoundToComparison!==false)return false;
 return p.completeSourceRasterVerified===true&&p.completeComparedFootprintKnown===true&&p.exactScoreReplayVerified===true&&p.outsideRenderedFootprintUsesFrozenBackground===true&&Number.isSafeInteger(p.bodyPixels)&&p.bodyPixels>=0&&p.bodyPixels<=N&&p.bodyPixels===f.bodyPixels&&p.knownBodyPixels===p.bodyPixels&&f.knownBodyPixels===p.bodyPixels&&p.unavailableBodyPixels===0&&f.unavailableBodyPixels===0&&Number.isFinite(p.backgroundSSE)&&p.backgroundSSE>=0&&Number.isFinite(p.bodySSE)&&p.bodySSE>=0&&p.backgroundSSE===f.backgroundSSE&&p.bodySSE===f.bodySSE&&p.pixelErrorReduction===f.pixelErrorReduction&&p.pixelErrorReduction===p.backgroundSSE-p.bodySSE&&p.winningBodySupportImplied===false&&p.identityCertified===false&&p.bodyAbsenceCertified===false&&p.modelExcluded===false&&p.minimumProvenATCalls===0;
}
export {sameSourcePixelComparison};
