// Adapt UI-only diagnostics to the existing read-only AT video evidence contract.
export function compatibleVideoObservation(observation){
 const common={capturedAt:observation.capturedAt,videoTime:observation.videoTime,frameSerial:observation.frameSerial,sourceId:observation.sourceId,sourceEpoch:observation.sourceEpoch,minimumProvenATCalls:0,worldPositionKnown:false,bootProof:false};
 if(observation.kind==='video-map-disambiguation')return {...common,kind:'video-map-registration',mapDisambiguation:structuredClone(observation),interpretation:'Font-nominated map-image candidates only; no AT consumption or unique current map inferred.'};
 if(observation.kind==='video-screen-candidates')return {...common,kind:'video-map-registration',screenCandidates:structuredClone(observation),interpretation:'Screen rectangle candidates only; map/position remains unverified.'};
 if(observation.kind==='video-name-roi-unknown')return {...common,kind:'video-gap',reason:'map-name-roi-unresolved',nameROIObservation:structuredClone(observation)};
 return observation;
}
