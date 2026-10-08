// Retain the original background producer's scalar comparison contract beside
// its own timeline frame. Never reconstruct it from a body score or latest frame.
const clone=structuredClone,keys=['sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
export function retainCameraATBackgroundSupport(support){
 if(!support)return null;
 return{kind:support.kind,ready:support.ready,frame:clone(support.frame),passingBranchCount:support.passingBranchCount,branches:(support.branches??[]).map(b=>({branchId:b.branchId,recordKey:b.recordKey,mapId:b.mapId,romSHA256:b.romSHA256,fullRGBA_SHA256:b.fullRGBA_SHA256,camera:clone(b.camera??{viewFx:b.viewFx,projectionFx:b.projectionFx}),alignment:clone(b.alignment),alignedBackgroundRGBA_SHA256:b.alignedBackgroundRGBA_SHA256}))};
}
export function resolveCameraATBackgroundSupport(support,frame,expected){
 const need=(v,m)=>{if(!v)throw Error(m);};
 need(support?.kind==='same-frame-background-branch-support-v1'&&support.ready===true&&keys.every(k=>frame[k]!==undefined&&frame[k]!==null&&support.frame?.[k]===frame[k]),'Owned background comparison frame unavailable or changed');
 need(expected.length>0&&Array.isArray(support.branches)&&support.passingBranchCount===expected.length&&support.branches.length===expected.length&&new Set(support.branches.map(b=>b.branchId)).size===expected.length,'Owned background comparison branch domain differs');
 for(const e of expected){const b=support.branches.find(b=>b.branchId===e.branchId);need(b&&b.recordKey===e.recordKey&&b.mapId===e.mapId&&b.romSHA256===frame.romSHA256&&b.fullRGBA_SHA256===frame.fullRGBA_SHA256,'Owned background comparison branch identity differs');}
 return retainCameraATBackgroundSupport(support);
}
