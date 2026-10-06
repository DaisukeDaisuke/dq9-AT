// Conditional extent evidence for the exact already-tested native proposal.
// No extra renders, component merging, score threshold, identity decision or
// conversion of the composite's final alpha into a visible-body mask.
import {nativeProjectedBodyEnvelope} from './monster-native-body-placement.mjs?v=footprint-rgb-20261006-2328';
const WIDTH=256,HEIGHT=192,PIXELS=WIDTH*HEIGHT;
const unsupported=reason=>({ready:false,empty:null,roi:null,pixels:null,reason});
const validMask=mask=>mask instanceof Uint8Array&&mask.length===PIXELS&&mask.every(x=>x===0||x===1);
// Keep comparison validity first in the caller. Each source mask is then
// validated and summarized in one pass. Ownership subset checking shares its
// pass, but a later nonbinary value still takes precedence over that failure.
function summarize(mask,alignment,comparisonMask,coverage=null){
 if(!(mask instanceof Uint8Array)||mask.length!==PIXELS)return {valid:false};
 let outsideCoverage=false;
 let minX=WIDTH,minY=HEIGHT,maxX=-1,maxY=-1,pixels=0,knownPixels=0,outsideFramePixels=0,knownSpatialSupportRank=0,first=null,second=null;
 // Read the unaligned source mask and apply its integer alignment once.
 for(let i=0;i<PIXELS;i++){
  const value=mask[i];if(value!==0&&value!==1)return {valid:false};
  if(!value)continue;if(coverage&&!coverage[i])outsideCoverage=true;
  const x=i%WIDTH+alignment.dx,y=(i>>8)+alignment.dy;
  if(x<0||y<0||x>=WIDTH||y>=HEIGHT){outsideFramePixels++;continue;}
  const index=y*WIDTH+x;pixels++;knownPixels+=comparisonMask[index];
  if(comparisonMask[index]){if(!first)first=[x,y];else if(!second){second=[x,y];knownSpatialSupportRank=1;}else if((second[0]-first[0])*(y-first[1])!==(second[1]-first[1])*(x-first[0]))knownSpatialSupportRank=2;}
  minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
 }
 return {valid:true,outsideCoverage,extent:{ready:true,empty:pixels===0,roi:pixels?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:null,pixels,knownPixels,knownSpatialSupportRank,knownBodySpatiallyDegenerate:knownSpatialSupportRank<2,unavailablePixels:pixels-knownPixels,outsideFramePixels,clippedByAlignment:outsideFramePixels>0,retainedPixelMask:false}};
}
/** The projected envelope and raster footprint are deliberately separate from
 * body color ownership. In mixed composition, final color ownership does not
 * describe every earlier body contribution seen through later map blending.
 * Preserve that limitation rather than claiming complete visible-body bounds.
 * The observed video body, source membership and species remain uncertified. */
function collectNativeBodyExtentEvidence({projected,rendered,alignment,comparisonValidMask,frame}){
 const evidence={kind:'conditional-source-native-body-extent-v1',frame:structuredClone(frame),width:WIDTH,height:HEIGHT,sourceAcceptedSubset:rendered?.sourceAcceptedSubset??null,sceneOcclusionApplied:rendered?.sceneOcclusionApplied===true,projectedEnvelope:unsupported('Source emitted projection unavailable'),rasterFootprint:unsupported('Accepted source footprint unavailable'),bodyColorOwnership:unsupported('Accepted source body-color ownership unavailable'),bodyExtentCertified:false,identityCertified:false,actorMembershipCertified:false,observedBodyCountCertified:false,minimumProvenATCalls:0,scope:'Extent of one already-tested source rendering hypothesis only. No residual merging, observed-body identity/count, current pose/root, or full-world body certification.'};
 if(!Number.isInteger(alignment?.dx)||!Number.isInteger(alignment?.dy)){evidence.bodyColorOwnership=unsupported('Frozen integer alignment unavailable');return evidence;}
 if(projected?.kind==='source-original-body-polygons'){
  const p=nativeProjectedBodyEnvelope(projected,alignment);
  evidence.projectedEnvelope={...p,kind:'source-emitted-geometric-envelope',sourcePolygons:projected.polygons.length,textureAlphaApplied:false,sceneOcclusionApplied:false,observedBodyCertified:false};
 }
 if(rendered?.ready!==true)return evidence;
 if(!validMask(comparisonValidMask)){evidence.bodyColorOwnership=unsupported('Frozen comparison-validity mask unavailable');return evidence;}
 const footprintSummary=summarize(rendered.sourceCoverage,alignment,comparisonValidMask);
 if(!footprintSummary.valid){evidence.bodyColorOwnership=unsupported('Binary source raster footprint unavailable; composite alpha is not substituted');return evidence;}
 const footprint=footprintSummary.extent;
 evidence.rasterFootprint={...footprint,kind:'source-alpha-positive-raster-footprint',bodyColorContributionImplied:false};
 if(rendered.sourceAcceptedSubset==='isolated-opaque-binary-body-polygons'&&rendered.sceneOcclusionApplied===false){
  evidence.bodyColorOwnership={...footprint,roi:footprint.roi?{...footprint.roi}:null,kind:'isolated-source-opaque-binary-body-coverage',completeWithinAdmittedRendererSubset:true,allSceneOcclusionReconstructed:false,allVisibleContributionsCapturedWithinComposition:true,observedBodyCertified:false};
 }else if(['known-source-destination-mixed-body','conditional-source-map-actor-MSE-body'].includes(rendered.sourceAcceptedSubset)&&rendered.sceneOcclusionApplied===true){
  const ownership=rendered.nativeState?.colorOwnerIsBody;
  const ownershipSummary=summarize(ownership,alignment,comparisonValidMask,rendered.sourceCoverage);
  if(!ownershipSummary.valid){evidence.bodyColorOwnership=unsupported('Accepted mixed-body final-color ownership mask unavailable; composite alpha is not substituted');return evidence;}
  if(ownershipSummary.outsideCoverage){evidence.bodyColorOwnership=unsupported('Body color ownership outside accepted source footprint');return evidence;}
  evidence.bodyColorOwnership={...ownershipSummary.extent,kind:'source-final-body-color-ownership',completeWithinAdmittedRendererSubset:true,allVisibleContributionsCapturedWithinComposition:false,mayOmitEarlierBodyContributionThroughLaterMapBlending:true,observedBodyCertified:false,scope:rendered.sourceAcceptedSubset==='conditional-source-map-actor-MSE-body'?'Pixels whose final accepted source color writer is the body. Earlier body contribution through later map/MSE blending is not reconstructed by this ownership mask.':'Pixels whose final accepted source color writer is the body. Earlier body contribution through later map blending is not reconstructed by this ownership mask.'};
 }else evidence.bodyColorOwnership=unsupported('Renderer subset has no admitted body-color ownership contract');
 return evidence;
}

// Optional extent metadata must never discard an otherwise valid tested score.
export function nativeBodyExtentEvidence(input){
 try{return collectNativeBodyExtentEvidence(input);}
 catch(error){return {kind:'conditional-source-native-body-extent-v1',ready:false,projectedEnvelope:unsupported('Extent metadata unavailable'),rasterFootprint:unsupported('Extent metadata unavailable'),bodyColorOwnership:unsupported('Extent metadata unavailable: '+error.message),bodyExtentCertified:false,identityCertified:false,actorMembershipCertified:false,observedBodyCountCertified:false,minimumProvenATCalls:0};}
}
