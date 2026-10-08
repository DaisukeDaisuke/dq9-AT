// A current-frame callback from independently validated compiled evidence.
// Historical native support and legacy image scores cannot release this gate.
export function preparedCurrentNativeAdmission(bundle,job){
 const v=bundle?.source?.video,rom=bundle?.source?.background?.romSHA256;
 if(!v||typeof v.sourceId!=='string'||!Number.isSafeInteger(v.sourceEpoch)||!Number.isSafeInteger(v.timelineSegment)||!Number.isSafeInteger(v.frameSerial)||!Number.isFinite(v.mediaTime)||!/^[a-f0-9]{64}$/.test(v.fullRGBA_SHA256??'')||!/^[a-f0-9]{64}$/.test(rom??''))return null;
 if(job?.identity?.romSHA256!==rom||!job.checkpointKey)return null;
 const currentKey='video-frame:'+JSON.stringify([v.sourceId,v.sourceEpoch,v.timelineSegment,v.frameSerial,v.mediaTime])+':'+v.fullRGBA_SHA256;
 const branches=[],routeBranches=[];
 for(const b of job.request?.experiment?.branches??[])for(const e of b.events??[])for(const source of e.eventEvidence?.sourceEvidence??[]){
  const a=source.cameraBodyAlternative,f=source.mapHypothesisProvenance?.frame;
  if(b.sightingEventBindings?.[source.sightingId]!==e.id||source.frameKey!==f?.frameKey||!bundle.sightings?.some(s=>s.id===source.sightingId&&s.frameKey===source.frameKey))continue;
  if(a?.kind!=='conditional-camera-body-alternative-v1'||typeof a.supportedModelId!=='string'||a.identityCertified!==false||a.certifiedObservation!==false||a.conditionalHypothesisOnly!==true||a.noEventPossible!==true||source.legacyPredictionUsed!==false||a.supportedModelId!==source.modelId||a.supportedModelId!==e.eventEvidence?.modelId)continue;
  if(f?.romSHA256!==rom||f.fullRGBA_SHA256!==v.fullRGBA_SHA256||f.frameSerial!==v.frameSerial||f.sourcePTS!==v.mediaTime||source.sourcePTS!==v.mediaTime||['sourceId','sourceEpoch','timelineSegment'].some(k=>f[k]!==v[k]))continue;
  branches.push({branchId:b.id,eventId:e.id,sightingId:source.sightingId,frameKey:source.frameKey});
 }
 for(const b of job.request?.experiment?.branches??[]){if((b.events?.length??0)<2)continue;for(const e of b.events??[]){const q=e.eventEvidence,t=q?.to;
  if(e.operation!=='direct-output-modulo'||e.possibleOutputCount<=0||e.exactPredicate!==true||q?.source!=='02077d10 routeMode1 armed choice / 02079d54 direct UpdateAT modulo'||q.romSHA256!==rom||q.sourceIdentity?.length!==3||q.sourceIdentity.some((x,i)=>x!==[v.sourceId,v.sourceEpoch,v.timelineSegment][i]))continue;
  const sighting=bundle.sightings?.find(s=>s.id===q.toSightingId&&s.frameKey===t?.frameKey&&s.sourcePTS===v.mediaTime);
  if(!sighting||t.sourcePTS!==v.mediaTime||t.frameKey!==currentKey||b.sightingEventBindings?.[sighting.id]!==e.id)continue;
  const bound=(job.nativeMotionAssociationInputs?.perSightingPriorCandidates??[]).some(row=>row.incomingSightingId===sighting.id&&(row.candidates??[]).some(c=>c.romSHA256===rom&&c.toSightingId===sighting.id&&(c.hypotheses??[]).some(h=>h.modelId===q.modelId&&h.recordKey===q.recordKey&&h.to?.frameKey===currentKey&&h.to.proposalId===t.proposalId&&h.to.branchId===t.branchId&&JSON.stringify(h.toPositionFx)===JSON.stringify(q.toPositionFx))));
  if(!bound)continue;
  routeBranches.push({branchId:b.id,eventId:e.id,sightingId:sighting.id,frameKey:t.frameKey,proposalId:t.proposalId,operation:e.operation,conditionalOnly:true,sourceClockKnown:false});
 }}
 return branches.length||routeBranches.length?{kind:'current-frame-conditional-native-AT-admission-v1',frame:structuredClone(v),romSHA256:rom,preparedCheckpointKey:job.checkpointKey,observationIdentity:structuredClone(job.identity),branches,routeBranches,identityCertified:false,birthCertified:false,currentATRecovered:false}:null;
}
