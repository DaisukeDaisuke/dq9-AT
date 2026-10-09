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

// The template stores a model-to-canonical-camera heading. Native actor yaw
// precedes the branch camera. Preserve the direct hint as a separate hypothesis.
import {fxCross,fxNormalize} from './map-browser-preview/native/native-camera-fx.mjs';
import {normalizeNativeAngle} from './map-browser-preview/native/native-map-records.mjs';
export function deriveNativeCameraRelativeReferencePose(reference,{camera}={}){
 const no=reason=>({ready:false,reason,currentActorPoseCertified:false});
 if(!reference?.ready||!Number.isFinite(reference.yaw)||reference.yaw<0||reference.yaw>=2*Math.PI||!Number.isInteger(reference.yawFx))return no('Valid original same-frame reference pose required');
 const v=camera?.viewFx;
 if(!Array.isArray(v)||v.length!==16||!v.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647)||v[3]!==0||v[7]!==0||v[11]!==0||v[15]!==4096)return no('Source affine branch camera unavailable');
 // Exact source lookAtFx basis admission, not a fitted tolerance. Rolled,
 // sheared, inverted-up and degenerate bases retain the former direct hint.
 const x=[v[0],v[4],v[8]],y=[v[1],v[5],v[9]],z=[v[2],v[6],v[10]],equal=(a,b)=>a.every((x,i)=>x===b[i]);
 if(x[1]!==0||y[1]<=0||[...x,...y,...z].some(a=>Math.abs(a)>4096))return no('Camera outside upright source look-at heading subset');
 try{if(!equal(x,fxNormalize(fxCross([0,4096,0],z)))||!equal(y,fxCross(z,x)))return no('Camera does not match the exact source upright look-at basis');}catch{return no('Degenerate source camera horizontal heading');}
 const cameraYaw=Math.atan2(v[8],v[0]),tau=2*Math.PI,relativeYaw=reference.yaw-cameraYaw,yaw=(relativeYaw%tau+tau)%tau,yawFx=normalizeNativeAngle(Math.round(relativeYaw/tau*25736));
 return {...structuredClone(reference),yaw,yawFx,source:'same-frozen-appearance-camera-relative-bestPose',cameraRelativeHeading:{kind:'conditional-source-camera-relative-reference-heading',templateYaw:reference.yaw,originalDirectYawFx:reference.yawFx,cameraYaw,cameraViewFx:v.slice(),angleConversion:'round radians/cycle then source normalizeNativeAngle; native trig table quantization remains in renderer',basis:'Exact upright lookAtFx: x=normalize(up×z), y=z×x; screen-right heading alpha+actorYaw',currentYawKnown:false,cameraPitchTakenFromReference:false},currentActorPoseCertified:false};
}

// Keep the former direct-heading outcomes even when another conditional hint
// wins the unchanged full-pixel objective. This is evidence, never a gate.
export function retainNativeReferenceHeadingSupport(target,row,{sourcePlacement,placementMethod,appendUnsupported,retainIsolatedBodySupport}){
 const key=sourcePlacement?.poseOrdering==='same-frame-appearance-camera-relative-first'?'cameraRelative':sourcePlacement?.poseOrdering==='same-frame-appearance-reference-first'?'originalDirect':null;
 if(!key)return;
 const all=target.referenceHeadingSupport??={kind:'conditional-reference-heading-alternatives',currentYawKnown:false,identityCertified:false,minimumProvenATCalls:0},out=all[key]??={testedProposals:0,best:null,unsupported:[],placementSupport:{decoded:{testedProposals:0,best:null},emitted:{testedProposals:0,best:null}}};
 out.testedProposals+=row.testedProposals;appendUnsupported(out.unsupported,...row.unsupported);
 const method=out.placementSupport[placementMethod];method.testedProposals+=row.testedProposals;
 if(row.best){const replaceMethod=!method.best||row.best.fit.pixelErrorReduction>method.best.fit.pixelErrorReduction,replaceOverall=!out.best||row.best.fit.pixelErrorReduction>out.best.fit.pixelErrorReduction;if(replaceMethod||replaceOverall){const best={...structuredClone(row.best),sourcePlacement:structuredClone(sourcePlacement)};if(replaceMethod)method.best=best;if(replaceOverall)out.best=best;}}
 retainIsolatedBodySupport(out,row,{sourcePlacement,placementMethod,appendUnsupported});
}
