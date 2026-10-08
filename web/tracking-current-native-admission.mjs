// A current-frame callback from independently validated compiled evidence.
// Historical native support and legacy image scores cannot release this gate.
export function preparedCurrentNativeAdmission(bundle,job){
 const v=bundle?.source?.video,rom=bundle?.source?.background?.romSHA256;
 if(!v||typeof v.sourceId!=='string'||!Number.isSafeInteger(v.sourceEpoch)||!Number.isSafeInteger(v.timelineSegment)||!Number.isSafeInteger(v.frameSerial)||!Number.isFinite(v.mediaTime)||!/^[a-f0-9]{64}$/.test(v.fullRGBA_SHA256??'')||!/^[a-f0-9]{64}$/.test(rom??''))return null;
 if(job?.identity?.romSHA256!==rom||!job.checkpointKey)return null;
 const branches=[];
 for(const b of job.request?.experiment?.branches??[])for(const e of b.events??[])for(const source of e.eventEvidence?.sourceEvidence??[]){
  const a=source.cameraBodyAlternative,f=source.mapHypothesisProvenance?.frame;
  if(b.sightingEventBindings?.[source.sightingId]!==e.id||source.frameKey!==f?.frameKey||!bundle.sightings?.some(s=>s.id===source.sightingId&&s.frameKey===source.frameKey))continue;
  if(a?.kind!=='conditional-camera-body-alternative-v1'||typeof a.supportedModelId!=='string'||a.identityCertified!==false||a.certifiedObservation!==false||a.conditionalHypothesisOnly!==true||a.noEventPossible!==true||source.legacyPredictionUsed!==false||a.supportedModelId!==source.modelId||a.supportedModelId!==e.eventEvidence?.modelId)continue;
  if(f?.romSHA256!==rom||f.fullRGBA_SHA256!==v.fullRGBA_SHA256||f.frameSerial!==v.frameSerial||f.sourcePTS!==v.mediaTime||source.sourcePTS!==v.mediaTime||['sourceId','sourceEpoch','timelineSegment'].some(k=>f[k]!==v[k]))continue;
  branches.push({branchId:b.id,eventId:e.id,sightingId:source.sightingId,frameKey:source.frameKey});
 }
 return branches.length?{kind:'current-frame-conditional-native-AT-admission-v1',frame:structuredClone(v),romSHA256:rom,preparedCheckpointKey:job.checkpointKey,observationIdentity:structuredClone(job.identity),branches,identityCertified:false,birthCertified:false,currentATRecovered:false}:null;
}
