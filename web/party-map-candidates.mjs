import {imageToMapCoordinateCandidate} from './player-coordinate.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
/** Keep marker × reference × peak hypotheses factored. Never silently pick a map. */
export function factorPartyMapCandidates({disambiguation,markers,stamp,markerFrame={width:256,height:192},registrationFrame={width:128,height:96}}){
 const source=disambiguation?.stamp;
 if(!source||!stamp||!Number.isSafeInteger(stamp.frameSerial)||!stamp.streamId||['frameSerial','streamId','generation','romEpoch','referenceEpoch'].some(k=>source[k]!==stamp[k]))throw Error('Party and map matching must refer to the same capture epochs');
 if(JSON.stringify(source.roi)!==JSON.stringify(stamp.roi)||JSON.stringify(source.markerProfiles)!==JSON.stringify(stamp.markerProfiles)||source.profileTolerance!==stamp.profileTolerance)throw Error('Party color profile/ROI snapshot differs');
 if(markers?.frame?.width!==markerFrame.width||markers?.frame?.height!==markerFrame.height)throw Error('Marker/capture dimensions differ');
 const references=(disambiguation.rankings||[]).map((r,index)=>({index,descriptor:r.descriptor,mapIds:[...r.mapIds],imageWidth:r.imageWidth,imageHeight:r.imageHeight,originPixel:r.originPixel,worldToMapScale:r.worldToMapScale,registrationResolved:!!r.registration?.resolved,bestScore:r.bestScore,peaks:structuredClone(r.registration?.candidates||[]),bestCandidateWithinFontSet:index===0&&!!disambiguation.descriptorCandidate,uniqueWithinFullyEvaluatedFontSet:index===0&&!!disambiguation.mapIdentityResolved&&!!disambiguation.allCandidatesEvaluated}));
 const markerCandidates=structuredClone(markers.candidates||[]),combinationCount=markerCandidates.length*references.reduce((sum,r)=>sum+r.peaks.length,0),mapIdentityCombinationCount=markerCandidates.length*references.reduce((sum,r)=>sum+r.peaks.length*r.mapIds.length,0);
 return {kind:'factorized-party-map-coordinate-candidates',stamp:structuredClone(stamp),markerFrame,registrationFrame,markerCandidates,references,unknownMapHypotheses:structuredClone(disambiguation.unknown||[]),candidateSource:structuredClone(disambiguation.candidateSource),combinationCount,mapIdentityCombinationCount,allCandidateMapsEvaluated:!!disambiguation.allCandidatesEvaluated,worldPositionKnown:false,partyCountKnown:false,partyIdentitiesKnown:false,interpolated:false,minimumProvenATCalls:0,automaticATConsumption:false,confidenceCalibrated:false,coordinateScope:'Only current font-nominated map references; aliases and unsearched hypotheses remain possible'};
}
export function materializePartyMapCandidate(factors,referenceIndex,markerIndex,peakIndex=0){
 const reference=factors.references[referenceIndex],marker=factors.markerCandidates[markerIndex],peak=reference?.peaks[peakIndex];if(!reference||!marker||!peak)return null;
 const sx=Math.round(reference.imageWidth*peak.scale)/reference.imageWidth,sy=Math.round(reference.imageHeight*peak.scale)/reference.imageHeight,fx=factors.registrationFrame.width/factors.markerFrame.width,fy=factors.registrationFrame.height/factors.markerFrame.height;
 if(![sx,sy,fx,fy,peak.dx,peak.dy,marker.x,marker.y].every(finite)||sx<=0||sy<=0)return null;
 const x=(marker.x*fx-peak.dx)/sx,y=(marker.y*fy-peak.dy)/sy,ux=((marker.uncertaintyPixels?.x??0)*fx+1)/sx,uy=((marker.uncertaintyPixels?.y??0)*fy+1)/sy,bounds={left:x-ux,top:y-uy,right:x+ux,bottom:y+uy};
 const mapCoordinate=Array.isArray(reference.originPixel)&&reference.originPixel.length===2&&reference.originPixel.every(finite)&&finite(reference.worldToMapScale)&&reference.worldToMapScale>0?imageToMapCoordinateCandidate({imageX:x,imageY:y,imageBounds:bounds,originPixel:reference.originPixel,scale:reference.worldToMapScale,mapId:reference.mapIds.length===1?reference.mapIds[0]:null,markerIdentity:marker.id}):null;
 return {referenceIndex,markerIndex,peakIndex,descriptor:reference.descriptor,mapIds:reference.mapIds,markerId:marker.id,profileId:marker.profileId,image:{x,y,bounds,insideImage:x>=0&&y>=0&&x<=reference.imageWidth&&y<=reference.imageHeight},mapCoordinate,registrationScore:peak.score,registrationCandidate:peakIndex===0&&reference.registrationResolved,bestCandidateWithinFontSet:peakIndex===0&&reference.bestCandidateWithinFontSet,uniqueWithinFullyEvaluatedFontSet:peakIndex===0&&reference.uniqueWithinFullyEvaluatedFontSet,worldPositionKnown:false,minimumProvenATCalls:0};
}
/** Display cap only. Full combinations remain recoverable from factors. */
export function previewPartyMapCandidates(factors,limit=24){
 limit=Math.max(1,Math.min(100,Math.floor(limit)||24));const rows=[],maxPeaks=Math.max(0,...factors.references.map(r=>r.peaks.length));
 outer:for(let peak=0;peak<maxPeaks;peak++)for(let marker=0;marker<factors.markerCandidates.length;marker++)for(let reference=0;reference<factors.references.length;reference++){const row=materializePartyMapCandidate(factors,reference,marker,peak);if(row)rows.push(row);if(rows.length===limit)break outer;}
 return {rows,shown:rows.length,total:factors.combinationCount,displayTruncated:rows.length<factors.combinationCount,omittedDisplayCandidatesRemainInFactors:true};
}
