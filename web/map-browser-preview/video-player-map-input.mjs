// Same-frame upper-screen marker -> ROM map-coordinate hypotheses.
// Reuses existing calibration, registration and BMMP coordinate interpretation.
import {calibratedPartyMarkerCandidates} from '../party-marker-calibration.mjs';
import {markerCoordinateBinding,mapMarkerCoordinateCandidate} from '../map-marker-coordinate.mjs';
import {sampleGameplayFrame} from './map-video-residual.mjs';
import {floorHeightsAtXZ} from './rom-floor-candidates.mjs';
export function upperVideoROI(width,height,layout){
 let r;if(layout==='obs-side-1920'&&width===1920&&height===1080)r={x:0,y:0,w:960,h:720};
 else if(layout==='ds-vertical'&&height%2===0)r={x:0,y:0,w:width,h:height/2};
 else if(layout==='ds-horizontal'&&width%2===0)r={x:0,y:0,w:width/2,h:height};
 else throw Error('この配置では上画面が取得できません。上下または左右2画面の動画が必要です');
 if(r.w*3!==r.h*4)throw Error('上画面ROIが4:3ではありません');return r;
}
function halfFrame(image){const rgba=new Uint8ClampedArray(128*96*4);for(let y=0;y<96;y++)for(let x=0;x<128;x++)for(let c=0;c<4;c++){let s=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)s+=image.rgba[((y*2+dy)*256+x*2+dx)*4+c];rgba[(y*128+x)*4+c]=s/4;}return{width:128,height:96,rgba};}
export function deriveVideoPlayerMapInput({sourceImage,layout,mapImage,mapId,matcher,floors,frameEvidence}){
 if(!frameEvidence?.fullRGBA_SHA256)throw Error('同じ固定フレームの由来が必要です');
 const roi=upperVideoROI(sourceImage.width,sourceImage.height,layout),upper=sampleGameplayFrame(sourceImage,roi),markers=calibratedPartyMarkerCandidates(upper),frame=halfFrame(upper);
 matcher.setReference({...mapImage,mapId,descriptor:mapImage.descriptor.path});
 const excluded=[{x:0,y:0,w:128,h:10},{x:0,y:86,w:128,h:10},...markers.candidates.map(m=>({x:m.bounds.x/2-2,y:m.bounds.y/2-2,w:m.bounds.w/2+4,h:m.bounds.h/2+4}))];
 const registration=matcher.match(frame,{scales:[.5],excluded,maxMilliseconds:1500}),binding=markerCoordinateBinding(mapImage.descriptor,mapId),candidates=[];
 for(const [peakIndex,peak]of registration.candidates.entries())for(const marker of markers.candidates){
  const sx=Math.round(mapImage.width*peak.scale)/mapImage.width,sy=Math.round(mapImage.height*peak.scale)/mapImage.height,x=(marker.x/2-peak.dx)/sx,y=(marker.y/2-peak.dy)/sy;
  const coordinate=mapMarkerCoordinateCandidate({imageX:x,imageY:y,imageBounds:{left:x-((marker.uncertaintyPixels?.x??0)/2+1)/sx,right:x+((marker.uncertaintyPixels?.x??0)/2+1)/sx,top:y-((marker.uncertaintyPixels?.y??0)/2+1)/sy,bottom:y+((marker.uncertaintyPixels?.y??0)/2+1)/sy},originPixel:mapImage.originPixel,scale:mapImage.descriptor.worldToMapScale,mapId,markerIdentity:marker.id},binding);
  const world=coordinate.splitX&&coordinate.splitZ?{xFx:coordinate.splitX.rawSigned32,zFx:coordinate.splitZ.rawSigned32}:null;
  const floor=world?floorHeightsAtXZ(floors,world.xFx,world.zFx):null;
  candidates.push({markerId:marker.id,slotColorCandidates:marker.slotColorCandidates,peakIndex,image:{x,y},registrationAccepted:registration.resolved&&peakIndex===0,coordinate,world,floor,playerIdentityProven:false});
 }
 const firstSlotHUDConfirmed=markers.calibration.profiles.some(p=>p.slot===1&&p.measuredRGB&&p.evidence);
 const primary=candidates.filter(c=>firstSlotHUDConfirmed&&c.registrationAccepted&&c.slotColorCandidates.length===1&&c.slotColorCandidates[0]===1&&c.world);
 return{kind:'same-frame-video-player-map-input',frameEvidence,mapSelection:{mode:'user-selected-ROM-reference',mapId,descriptor:mapImage.descriptor.path,otherMapReferencesSearched:false},selection:{rule:'Only accepted best registration peak and one unambiguous same-frame HUD slot1 color component; one source COL2 height required to render',firstSlotHUDConfirmed,markerIdentityCertified:false,referenceChoiceVerified:false},upperROI:roi,upper,markers,registration,binding,candidates,primaryCandidate:primary.length===1?primary[0]:null,status:!markers.candidates.length?'marker-unobserved':!firstSlotHUDConfirmed?'first-slot-HUD-unconfirmed':!registration.resolved?'registration-unresolved':primary.length!==1?'first-player-candidate-ambiguous':primary[0].floor.heightsFx.length!==1?'floor-unresolved-or-multiple':'position-candidate',worldPositionKnown:false,playerIdentityProven:false,minimumProvenATCalls:0,scope:'Selected map is a hypothesis. Same-frame calibrated slot-color markers and ROM registration peaks are retained. Initial camera heading and live camera state are separate dependencies.'};
}
