// A map hypothesis is not an actor coordinate. Keep all name/template, located,
// failed/unsearched and forward-passing branches separate at the timeline boundary.
const passingStates=new Set(['conditional-residual-hypotheses','no-residual-split']);
export const mapHypothesisFrameKey=s=>'video-frame:'+JSON.stringify([s?.sourceId??null,s?.sourceEpoch??null,s?.timelineSegment??null,s?.frameSerial??null,s?.mediaTime??s?.videoPTS??s?.videoTime??null])+':'+s?.fullRGBA_SHA256;
export function mapHypothesisProvenance(frame={}){
 const stamp=frame.stamp??{},candidates=new Map(),backgroundCandidates=[];
 const add=row=>{const recordKey=row?.recordKey??row?.key;if(typeof recordKey!=='string'||!recordKey)return null;
  if(!candidates.has(recordKey))candidates.set(recordKey,{recordKey,mapId:Number.isInteger(row.mapId)?row.mapId:null,fieldCode:row.fieldCode??null,nameCandidateIndexes:[],locatedCandidateIndexes:[],locatedDescriptors:[],mapSearchIndexes:[],backgroundCandidateIndexes:[],survivingBackgroundBranchIds:[],mapIdentityCertified:false,actorPositionKnown:false});
  const c=candidates.get(recordKey);if(c.mapId===null&&Number.isInteger(row.mapId))c.mapId=row.mapId;if(c.fieldCode===null&&row.fieldCode)c.fieldCode=row.fieldCode;return c;};
 (frame.mapNameCandidates??[]).forEach((r,i)=>add(r)?.nameCandidateIndexes.push(i));
 (frame.positionCandidates??[]).forEach((r,i)=>{const c=add(r);if(c){c.locatedCandidateIndexes.push(i);c.locatedDescriptors.push(r.descriptorPath??r.descriptor??null);}});
 (frame.mapSearchDiagnostics??[]).forEach((r,i)=>add(r)?.mapSearchIndexes.push(i));
 (frame.backgroundAlternatives??[]).forEach((r,i)=>{const c=add(r);if(!c)return;const accepted=r.accepted===true&&passingStates.has(r.state),branchId='background-row-'+i;
  c.backgroundCandidateIndexes.push(i);if(accepted)c.survivingBackgroundBranchIds.push(branchId);
  // Pose values remain in the original row, never promoted to positionCandidates.
  backgroundCandidates.push({branchId,branchIdScope:'within-frozen-frame-only',rowIndex:i,recordKey:c.recordKey,mapId:c.mapId,descriptor:r.descriptor??null,mapCandidateKind:r.mapCandidateKind??'located-source-background-hypothesis',yawDegrees:r.heading?.yawDegrees??null,state:r.state??null,accepted,unsupported:r.unsupported??null,actorPositionKnown:false,mapIdentityCertified:false,currentCameraCertified:false,minimumProvenATCalls:0});
 });
 return {schema:'video-map-hypothesis-provenance-v1',frame:{frameKey:mapHypothesisFrameKey(stamp),frameSerial:frame.frameSerial??stamp.frameSerial??null,sourcePTS:frame.sourcePTS??stamp.mediaTime??stamp.videoTime??null,sourceId:stamp.sourceId??null,sourceEpoch:stamp.sourceEpoch??null,timelineSegment:stamp.timelineSegment??null,timestampBasis:stamp.timestampBasis??null,fullRGBA_SHA256:stamp.fullRGBA_SHA256??frame.pixelHash??null,romSHA256:frame.romSHA256??null},candidates:[...candidates.values()],backgroundCandidates,survivingBackgroundCandidates:backgroundCandidates.filter(c=>c.accepted),unsearchedMapsPossible:true,unknownAlternativeRetained:true,absenceCertified:false,mapIdentityCertified:false,actorPositionKnown:false,minimumProvenATCalls:0,scope:'Names may be reused template hypotheses. Located rows retain their own coordinate evidence. Each passing background row is a separate conditional map/camera branch, not actor XZ. Failed or unsearched alternatives remain possible; no map, entry, reset, absence or AT state is certified.'};
}
// Entry evidence concerns map alternatives, not yaw/floor/environment changes.
export function mapHypothesisSignature(provenance){return JSON.stringify(provenance.candidates.map(c=>[c.recordKey,c.nameCandidateIndexes.length>0,[...new Set(c.locatedDescriptors)].sort(),[...new Set(provenance.survivingBackgroundCandidates.filter(b=>b.recordKey===c.recordKey).map(b=>b.descriptor))].sort()]).sort((a,b)=>a[0].localeCompare(b[0])));}
// Historic AT evidence must use that sighting's frame. Never fill a missing old
// map with the current selected background or turn a missing encounter row into absence.
export function trackingSightingMapProvenance(bundle,sighting,ownFrame=null){
 if(ownFrame)return ownFrame.stamp?.fullRGBA_SHA256&&mapHypothesisFrameKey(ownFrame.stamp)===sighting.frameKey?mapHypothesisProvenance(ownFrame):null;
 for(const v of bundle.videoObservations??[])for(const f of v.timeline?.frames??[])if(f.stamp?.fullRGBA_SHA256&&mapHypothesisFrameKey(f.stamp)===sighting.frameKey)return mapHypothesisProvenance(f);
 const source=bundle.source??{},stamp=source.video??{};
 if(!stamp.fullRGBA_SHA256||mapHypothesisFrameKey(stamp)!==sighting.frameKey)return null;
 const b=source.background??{},a=b.automaticSearch??{},names=b.nameInput?.maps??[];
 return mapHypothesisProvenance({stamp,romSHA256:b.romSHA256,positionCandidates:a.locatedCandidates??[],mapNameCandidates:names,mapSearchDiagnostics:a.mapCandidates??[],backgroundAlternatives:a.backgroundCandidates??[]});
}
