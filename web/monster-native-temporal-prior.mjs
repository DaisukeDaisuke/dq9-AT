// Additional priority proposals, never transferred support. This bank is private to one ROM/native service. It
// never imports a supplied observation, score, mask, track, or continuation.
// Bank <= one best per finite prior-frame job, deduplicated; no history grows.
// Active work owns a frozen copy; the next bank holds only its latest frame.
const clone=structuredClone,keys=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const validFrame=f=>['romSHA256','fullRGBA_SHA256'].every(k=>/^[a-f0-9]{64}$/.test(f?.[k]??''))&&['recordKey','sourceId'].every(k=>typeof f?.[k]==='string'&&f[k].length>0)&&['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(f?.[k])&&f[k]>=0)&&Number.isFinite(f?.mediaTime)&&f.mediaTime>=0;
const sameFrame=(a,b)=>validFrame(a)&&validFrame(b)&&keys.every(k=>a?.[k]!==undefined&&a[k]===b?.[k]);
const int32=x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647;
export function createNativeTemporalPriorBank(){
 let bank=[];
 return{
  clear(){bank=[];},
  snapshot(){return clone(bank);},
  remember(jobs){
   const next=new Map();
   for(const j of jobs){const b=j.result?.best,p=b?.pose,s=b?.nativeComparisonSupport,placement=b?.sourcePlacement;
    if(s?.ready!==true||s.modelId!==j.candidate.modelId||!sameFrame(s.frame,j.frame)||!(b.fit?.pixelErrorReduction>0)||!Number.isFinite(b.fit.pixelErrorReduction)||!Array.isArray(b.positionFx)||b.positionFx.length!==3||!b.positionFx.every(int32)||!p||!int32(p.yawFx)||!Number.isInteger(p.actorScaleFx)||p.actorScaleFx<=0||p.actorScaleFx>32767||p.phaseFx!==undefined||p.actionCondition!==undefined||p.drawAnimationCondition!==undefined||placement?.originOnFloorAssumed!==true||typeof placement.planeKey!=='string')continue;
    if(!(p.clip==='bind'&&p.frame===null||['stand.nsbca','run.nsbca','appear.nsbca'].includes(p.clip)&&Number.isSafeInteger(p.frame)&&p.frame>=0))continue;
    const row={frame:clone(j.frame),modelId:j.candidate.modelId,variant:j.candidate.variant,pose:{clip:p.clip,frame:p.frame,actorScaleFx:p.actorScaleFx,yawFx:p.yawFx},positionFx:b.positionFx.slice(),planeKey:placement.planeKey,orderScore:b.fit.pixelErrorReduction};
    const key=JSON.stringify([row.frame.recordKey,row.modelId,row.variant,row.pose,row.positionFx,row.planeKey]),old=next.get(key);if(!old||old.orderScore<row.orderScore)next.set(key,row);
   }
   bank=[...next.values()].sort((a,b)=>b.orderScore-a.orderScore);
  },
  proposals(rows,{frame,candidate,source,scales,floor}){
   const out=[];
   for(const row of rows){const f=row.frame;
    if(!validFrame(frame)||!validFrame(f)||!['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment'].every(k=>frame[k]===f[k])||!Number.isFinite(frame.mediaTime)||!Number.isFinite(f.mediaTime)||!(frame.mediaTime>f.mediaTime)||row.modelId!==candidate.modelId||row.variant!==candidate.variant||!scales.includes(row.pose.actorScaleFx)||!source.list.some(p=>p.clip===row.pose.clip&&p.frame===row.pose.frame)||!floor.planes.some(p=>p.key===row.planeKey))continue;
    out.push({id:`temporal-prior:${out.length}:${row.pose.clip}:${row.pose.frame??'bind'}:yawFx${row.pose.yawFx}:scale${row.pose.actorScaleFx}`,pose:clone(row.pose),positionFx:row.positionFx.slice(),sourcePlacement:{poseOrdering:'same-service-previous-frame-source-priority',placementKind:'conditional-previous-native-root-priority',planeKey:row.planeKey,originOnFloorAssumed:true,completeGeometryCenterAssumed:false,priorFrame:clone(f),priorSupportReused:false,currentActorPoseCertified:false,currentRootCertified:false,actorAssociationCertified:false,priorityOnly:true}});
   }
   return out;
  }
 };
}
