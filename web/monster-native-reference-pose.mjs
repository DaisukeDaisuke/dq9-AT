// Existing appearance-bank pose is an input-derived ordering hint only.
// It never supplies the camera, fitted size, species decision or live pose proof.
const keys=['sourceId','sourceEpoch','timelineSegment','fullRGBA_SHA256'];
export function readNativeReferencePose(hints,{videoEvidence,romSHA256,regionId,modelId,variant,animations}){
 const no=reason=>({ready:false,reason});if(!hints)return no('No same-frame appearance pose hint');
 const a=hints.frame,b=videoEvidence;if(hints.romSHA256!==romSHA256||!a||!b||keys.some(k=>a[k]===undefined||a[k]!==b[k])||(a.mediaTime??a.videoTime)!==(b.mediaTime??b.videoTime))return no('Appearance pose frame/ROM differs');
 const regions=hints.regions?.filter(r=>String(r.regionId)===String(regionId));if(regions?.length!==1)return no('Appearance pose residual absent or ambiguous');const candidates=regions[0].candidates?.filter(c=>c.modelId===modelId);if(candidates?.length!==1)return no('Appearance pose candidate absent or ambiguous');const p=candidates[0].bestPose;
 if(!p||p.variant!==variant||typeof p.clip!=='string'||!Number.isFinite(p.yaw)||p.yaw<0||p.yaw>=2*Math.PI)return no('Appearance pose variant/heading invalid');
 if(p.clip==='bind'){if(p.frame!==null)return no('Bind pose requires null frame');}else{const animation=animations.get(p.clip);if(!animation||!Number.isInteger(p.frame)||p.frame<0||p.frame>=animation.numFrames)return no('Appearance pose is not an available stored ROM sample');}
 return{ready:true,clip:p.clip,frame:p.frame,variant,yaw:p.yaw,yawFx:Math.round(p.yaw/(2*Math.PI)*25736),source:'same-frozen-appearance-reference-bestPose',cameraPitchTakenFromReference:false,currentActorPoseCertified:false};
}
