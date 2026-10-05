// Explicit same-frame binding for a source-camera body comparison. The renderer
// consumes this beside the original frozen RGB/background; no current-state proof.
const need=(v,m)=>{if(!v)throw Error(m);};
const keys=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
function frame(value){need(value&&keys.every(k=>value[k]!==null&&value[k]!==undefined),'Complete source/frame binding required');need(['romSHA256','fullRGBA_SHA256'].every(k=>/^[a-f0-9]{64}$/.test(value[k])),'Exact ROM/frame SHA256 required');need(typeof value.recordKey==='string'&&value.recordKey.length&&typeof value.sourceId==='string'&&value.sourceId.length&&['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)&&Number.isFinite(value.mediaTime),'Invalid source/frame binding');return Object.fromEntries(keys.map(k=>[k,value[k]]));}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function bindFrozenBodyProjection({frame:videoFrame,cameraFrame,camera,alignment,sourceFloorFrame}){
 const bound=frame(videoFrame),cameraBound=frame(cameraFrame);for(const k of keys)need(bound[k]===cameraBound[k],'Body camera differs from frozen frame: '+k);
 need(sourceFloorFrame?.romSHA256===bound.romSHA256&&sourceFloorFrame?.recordKey===bound.recordKey,'Floor source differs from camera ROM/map');
 need([camera?.viewFx,camera?.projectionFx].every(m=>Array.isArray(m)&&m.length===16&&m.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647)),'Frozen signed FX32 camera required');
 need(Number.isInteger(alignment?.dx)&&Number.isInteger(alignment?.dy),'Exact frozen native-pixel alignment required');
 return freeze({kind:'frozen-source-body-projection-input',frame:bound,camera:{viewFx:camera.viewFx.slice(),projectionFx:camera.projectionFx.slice()},alignment:{dx:alignment.dx,dy:alignment.dy},sourceFloorFrame:{romSHA256:bound.romSHA256,recordKey:bound.recordKey},currentCameraCertified:false,sourceRootFloorBindingCertified:false,opaqueSceneOcclusionAvailable:false,minimumProvenATCalls:0,scope:'Identity-bound camera/floor source for one frozen frame. Alignment remains the existing conditional 2D background translation; no player-floor substitution.'});
}
