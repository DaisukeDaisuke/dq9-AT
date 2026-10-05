import {readRomInitialCamera} from './rom-initial-camera.mjs';
import {readInitialFieldPlayerHeight} from './rom-overlay.mjs';
import {imageToMapCoordinateCandidate} from './native/player-coordinate.mjs';
import {followTargetFx,buildEyeFx,fovHalfAngleFx,lookAtFx,perspectiveFx} from './native/native-camera-fx.mjs';
export function mapClickWorld(image,x,y){
 const c=imageToMapCoordinateCandidate({imageX:x,imageY:y,originPixel:image.originPixel,scale:image.descriptor.worldToMapScale});
 if(!c.splitX||!c.splitZ)throw Error('地図座標をROM座標へ変換できません');
 return {xFx:c.splitX.rawSigned32,zFx:c.splitZ.rawSigned32,source:c};
}
export function automaticPreviewCamera(project,rom,record,{xFx,yFx,zFx,yawDegrees}){
 if(![xFx,yFx,zFx].every(Number.isInteger)||!Number.isFinite(yawDegrees))throw Error('地図位置と向きが必要です');
 const preset=readRomInitialCamera(project.sdk,record.cameraSelector),height=readInitialFieldPlayerHeight(rom),raw=project.sdk.read(0x020e955c,16384),d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),trig=i=>[d.getInt16(i*4,true),d.getInt16(i*4+2,true)];
 // The user chooses a preview heading. This does not assert a running game's yaw.
 const yawFx=Math.round((((yawDegrees%360)+360)%360)/360*25736);
 const targetFx=followTargetFx([xFx,yFx,zFx],height.heightFx),orbit=buildEyeFx({target:targetFx,yawFx,heightFx:preset.orbitHeightFx,radiusFx:preset.radiusFx},trig),view=lookAtFx(orbit.eye,preset.upFx,targetFx),fov=fovHalfAngleFx(preset.halfFovFx,trig);
 return {viewFx:[...view.slice(0,3),0,...view.slice(3,6),0,...view.slice(6,9),0,...view.slice(9,12),4096],projectionFx:perspectiveFx({...fov,aspectFx:preset.aspectFx,nearFx:preset.nearFx,farFx:preset.farFx}),eyeFx:orbit.eye,targetFx,preset,scope:'ROM initial camera preset and initial player height at selected geometric floor and preview heading. Scripted/area camera, live actor Y and live yaw are not inferred.'};
}
