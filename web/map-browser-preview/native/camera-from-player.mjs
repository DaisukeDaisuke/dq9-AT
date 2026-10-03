import {followTargetFx,buildEyeFx,fovHalfAngleFx,lookAtFx,perspectiveFx} from './native-camera-fx.mjs';
// Ordinary, unblended follow-camera contract. The caller provides current native state.
// A 2D map click must first become a world position, including its floor height.
export function cameraFromPlayerFx(input,trig){
 const {playerPositionFx,playerHeightFx,followOffsetFx,yawFx,orbitHeightFx,radiusFx,halfFovFx,upFx,aspectFx,nearFx,farFx,conditions:c}=input;
 const fields=['transformFlags','roll','shakeAmplitude','bobEnabled','eyeClampEnabled','extraYaw','followBlendActive','areaBlendMask','fovRemaining'];
 if(!c||fields.some(k=>!Object.hasOwn(c,k)))throw Error('Explicit native camera conditions required');
 if(fields.filter(k=>k!=='followBlendActive').some(k=>!Number.isInteger(c[k]))||typeof c.followBlendActive!=='boolean')throw Error('Native condition field types required');
 if(c.transformFlags&1||c.roll||c.shakeAmplitude>0||c.bobEnabled||c.eyeClampEnabled||c.extraYaw||c.followBlendActive||c.areaBlendMask||c.fovRemaining)throw Error('Camera state outside verified ordinary follow subset');
 const vectors=[playerPositionFx,followOffsetFx,upFx],scalars=[playerHeightFx,yawFx,orbitHeightFx,radiusFx,halfFovFx,aspectFx,nearFx,farFx];
 if(vectors.some(v=>!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isInteger(x)))||scalars.some(x=>!Number.isInteger(x)))throw Error('Native integer FX32 fields required');
 const targetFx=followTargetFx(playerPositionFx,playerHeightFx,followOffsetFx),built=buildEyeFx({target:targetFx,yawFx,heightFx:orbitHeightFx,radiusFx},trig),fov=fovHalfAngleFx(halfFovFx,trig);
 return {targetFx,eyeFx:built.eye,projectionFx:perspectiveFx({...fov,aspectFx,nearFx,farFx}),view4x3Fx:lookAtFx(built.eye,upFx,targetFx),viewport:[0,0,255,191],fov,orbit:built};
}
