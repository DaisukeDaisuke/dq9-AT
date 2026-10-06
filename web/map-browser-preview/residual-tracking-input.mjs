import{videoTrackingFrameKey,videoTrackingSourceKey}from'./video-patch-correspondence.mjs?v=continuity-yield-local-evidence-20261006-1458';
// Adapter to the existing image-space tracker; residuals are not certified enemies.
import {EnemyProposalTracker} from '../monster-position-proposals.mjs?v=camera-loss-evidence-20261006-1205';
export class ResidualTracker {
 constructor(){this.tracker=new EnemyProposalTracker();this.key=null;this.last=null;}
 reset(){this.tracker.reset();this.key=null;this.last=null;}
 update({comparison,image,videoEvidence,backgroundEvidence,frameSerial,measuredContinuity=null}){
  // Validity precedes idempotence: an unavailable comparison cannot revive a
  // cached observation. Pixel equality alone is not frame/source equality.
  if(comparison.state==='alignment-unresolved'||comparison.state==='background-unavailable'){this.reset();return{resetReason:comparison.state,observed:[],unobserved:[],ATDrawsCertified:0};}
  const videoTime=videoEvidence.mediaTime??videoEvidence.videoPTS??videoEvidence.videoTime;
  const identity=JSON.stringify([videoEvidence.sourceId,videoEvidence.sourceEpoch,videoEvidence.timelineSegment,videoEvidence.timestampBasis,videoEvidence.filename,videoEvidence.bytes,videoEvidence.layout,backgroundEvidence.romSHA256,backgroundEvidence.mapId,backgroundEvidence.recordKey]);
  const key=JSON.stringify([identity,frameSerial,videoTime,videoEvidence.fullRGBA_SHA256,backgroundEvidence,comparison.alignment.applied,measuredContinuity?.id??null]);
  if(key===this.key)return this.last;
  const gray=new Uint8Array(49152),blocked=Uint8Array.from(comparison.validMask,v=>v?0:1);
  if(image.rgba.length!==49152*4)throw Error('256x192 video pixels required');
  for(let i=0;i<49152;i++)gray[i]=(image.rgba[i*4]*77+image.rgba[i*4+1]*150+image.rgba[i*4+2]*29)>>8;
  const captureStamp={videoTime,frameSerial,sceneContext:{gameplayROI:{x:0,y:0,w:256,h:192}}};
  const result=this.tracker.update({captureStamp,proposals:comparison.components.map(r=>({...r,originalResidualId:r.id,roi:{...r.roi}})),trackingFrame:{width:256,height:192,gray,mask:comparison.residualMask,blocked,identity}});
  // Only measured replay correspondences for this exact original frame can
  // reconnect a gap in the slower ROM-background lane. Existing associations
  // win on conflict; no replay result is a detection, birth or actor proof.
  const bound=measuredContinuity?.ready===true&&measuredContinuity.kind==='measured-video-patch-continuity-v1'&&measuredContinuity.targetFrameKey===videoTrackingFrameKey(videoEvidence)&&measuredContinuity.targetSourceKey===videoTrackingSourceKey(videoEvidence)&&measuredContinuity.mapScope===JSON.stringify([backgroundEvidence.romSHA256,backgroundEvidence.recordKey,backgroundEvidence.mapId])&&measuredContinuity.identityCertified===false&&measuredContinuity.minimumProvenATCalls===0;
  let measuredContinuations=0;
  if(bound){const occupied=new Set(result.observed.filter(r=>r.association==='tentative-continuation').map(r=>r.id)),claimed=new Set();
   for(const hint of measuredContinuity.associations??[]){const row=result.observed.find(r=>r.originalResidualId===hint.originalResidualId);if(!row||row.association==='tentative-continuation'||occupied.has(hint.trackId)||claimed.has(hint.originalResidualId)||typeof hint.trackId!=='string'||hint.lastSeen!==videoTime||!Number.isFinite(hint.firstSeen)||hint.firstSeen>videoTime||!Number.isSafeInteger(hint.sightings)||hint.sightings<2)continue;const oldId=row.id;Object.assign(row,{id:hint.trackId,firstSeen:hint.firstSeen,lastSeen:hint.lastSeen,sightings:hint.sightings,association:'tentative-continuation',associationSource:'measured-video-patch-replay',nativeIdentityCertified:false,birthCertified:false});for(const t of this.tracker.tracks)if(t.id===oldId)Object.assign(t,{id:row.id,firstSeen:row.firstSeen,lastSeen:row.lastSeen,sightings:row.sightings});occupied.add(row.id);claimed.add(hint.originalResidualId);measuredContinuations++;}
  }
  if(measuredContinuity)result.measuredVideoContinuity={bound,used:measuredContinuations,seedFrameKey:bound?measuredContinuity.seedFrameKey:null,seedPTS:bound?measuredContinuity.seedPTS:null,measuredSteps:bound?measuredContinuity.measuredSteps:null,identityCertified:false,birthCertified:false,absenceCertified:false,minimumProvenATCalls:0};
  this.key=key;this.last={...result,trackingBudget:32,rawRegions:comparison.components.length,notRetainedByTrackingBudget:Math.max(0,result.observed.length-32),scope:'Tentative image-space correspondence only. All raw regions remain in the comparison record. No species, native identity, birth, disappearance or AT draw certification.'};return this.last;
 }
}
