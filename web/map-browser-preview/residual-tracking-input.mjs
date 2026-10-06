// Adapter to the existing image-space tracker; residuals are not certified enemies.
import {EnemyProposalTracker} from '../monster-position-proposals.mjs';
export class ResidualTracker {
 constructor(){this.tracker=new EnemyProposalTracker();this.key=null;this.last=null;}
 reset(){this.tracker.reset();this.key=null;this.last=null;}
 update({comparison,image,videoEvidence,backgroundEvidence,frameSerial}){
  // Validity precedes idempotence: an unavailable comparison cannot revive a
  // cached observation. Pixel equality alone is not frame/source equality.
  if(comparison.state==='alignment-unresolved'||comparison.state==='background-unavailable'){this.reset();return{resetReason:comparison.state,observed:[],unobserved:[],ATDrawsCertified:0};}
  const videoTime=videoEvidence.mediaTime??videoEvidence.videoPTS??videoEvidence.videoTime;
  const identity=JSON.stringify([videoEvidence.sourceId,videoEvidence.sourceEpoch,videoEvidence.timelineSegment,videoEvidence.timestampBasis,videoEvidence.filename,videoEvidence.bytes,videoEvidence.layout,backgroundEvidence.romSHA256,backgroundEvidence.mapId,backgroundEvidence.recordKey]);
  const key=JSON.stringify([identity,frameSerial,videoTime,videoEvidence.fullRGBA_SHA256,backgroundEvidence,comparison.alignment.applied]);
  if(key===this.key)return this.last;
  const gray=new Uint8Array(49152),blocked=Uint8Array.from(comparison.validMask,v=>v?0:1);
  if(image.rgba.length!==49152*4)throw Error('256x192 video pixels required');
  for(let i=0;i<49152;i++)gray[i]=(image.rgba[i*4]*77+image.rgba[i*4+1]*150+image.rgba[i*4+2]*29)>>8;
  const captureStamp={videoTime,frameSerial,sceneContext:{gameplayROI:{x:0,y:0,w:256,h:192}}};
  const result=this.tracker.update({captureStamp,proposals:comparison.components.map(r=>({...r,originalResidualId:r.id,roi:{...r.roi}})),trackingFrame:{width:256,height:192,gray,mask:comparison.residualMask,blocked,identity}});
  this.key=key;this.last={...result,trackingBudget:32,rawRegions:comparison.components.length,notRetainedByTrackingBudget:Math.max(0,result.observed.length-32),scope:'Tentative image-space correspondence only. All raw regions remain in the comparison record. No species, native identity, birth, disappearance or AT draw certification.'};return this.last;
 }
}
