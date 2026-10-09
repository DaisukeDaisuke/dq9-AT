import {mineFieldGraphs,fieldPathName} from './field-graph.mjs';
import {decodeCalls} from './map-core.mjs';
import {mineCreatorResources} from './monster-creation-resources.mjs';
import {preferredNodeTrigFromRom,fieldNativeFacing} from './field-preferred-node.mjs';
import {MonsterMovementKernel} from './monster-movement.mjs?v=ordinary-turn-20261009-e76d366f';
const validFrame=f=>f&&['romSHA256','fullRGBA_SHA256'].every(k=>/^[a-f0-9]{64}$/.test(f[k]??''))&&['recordKey','sourceId'].every(k=>typeof f[k]==='string'&&f[k].length)&&['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(f[k])&&f[k]>=0)&&Number.isFinite(f.mediaTime)&&f.mediaTime>=0;
const copy=structuredClone,int32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;

export function deriveSourceTargetHeadingProposals({prior,frame,record,candidate,speciesIds,graph,creator,motionKernel,trig,romSHA256,currentRootFrame=null}){
 const old=prior?.sourcePlacement?.priorFrame,placement=prior?.sourcePlacement;
 const sameIdentity=(a,b)=>validFrame(a)&&validFrame(b)&&['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment'].every(k=>a[k]===b[k]);
 const temporal=placement?.placementKind==='conditional-previous-native-root-priority'&&sameIdentity(frame,old)&&frame.mediaTime>old.mediaTime;
 const current=['conditional-native-emitted-envelope','conditional-native-boundary-envelope','conditional-tested-native-root-heading-seed'].includes(placement?.placementKind)&&placement.originOnFloorAssumed===true&&sameIdentity(frame,currentRootFrame)&&frame.mediaTime===currentRootFrame.mediaTime&&frame.fullRGBA_SHA256===currentRootFrame.fullRGBA_SHA256;
 if((!temporal&&!current)||frame?.romSHA256!==romSHA256||record?.key!==frame.recordKey||!Array.isArray(prior.positionFx)||prior.positionFx.length!==3||!prior.positionFx.every(int32))return [];
 const mapSpecies=new Set((candidate.origins??[]).filter(o=>o.mapId===record.mapId&&o.trapRuleUnresolved!==true&&Number.isInteger(o.monsterId)).map(o=>o.monsterId));
 const ai=creator.ai.filter(a=>speciesIds.includes(a.species)&&mapSpecies.has(a.species)&&(a.flags&7)===1&&[1,2,3].includes((a.flags>>>3)&7));
 if(!ai.length)return [];
 const {yawCondition:oldYawCondition,...pose}=copy(prior.pose);
 const oldFacing=fieldNativeFacing(prior.pose.yawFx,trig);if(!oldFacing)return [];
 const groups=new Map();
 for(const node of graph.nodes){
  if(!Number.isInteger(node.index)||!Number.isInteger(node.id)||!Array.isArray(node.position)||node.position.length!==3||!node.position.every(v=>Number.isInteger(v)&&v>=-32768&&v<=32767))continue;
  const target=node.position?.map(v=>v*4096);if(!target||target.length!==3||!target.every(int32))continue;
  for(const [sourceStage,steering] of [['state2-entry',motionKernel.state2EntrySteering(prior.positionFx,target)],['state2-update',motionKernel.state2Steering(prior.positionFx,target)]]){
  if(!steering.resolved||steering.steeringDistance<4096)continue;
  const facing=fieldNativeFacing(steering.targetAngle,trig);if(!facing||facing.every((v,i)=>v===oldFacing[i]))continue;
  const key=JSON.stringify(facing),reference={nodeIndex:node.index,nodeId:node.id,targetXYZ:target,targetAngle:steering.targetAngle,sourceStage};
  if(groups.has(key)){groups.get(key).targets.push(reference);continue;}
  groups.set(key,{yawFx:steering.targetAngle,facing,targets:[reference],continuityOrder:oldFacing[0]*facing[0]+oldFacing[2]*facing[2]});
  }
 }
 return [...groups.values()].sort((a,b)=>b.continuityOrder-a.continuityOrder||a.targets[0].nodeIndex-b.targets[0].nodeIndex).map((row,index)=>({
  id:`source-route-heading:${index}:${candidate.modelId}:${prior.id}`,positionFx:prior.positionFx.slice(),pose:{...copy(pose),yawFx:row.yawFx},
  sourcePlacement:{...copy(prior.sourcePlacement),poseOrdering:current?'same-frozen-ROM-route-target-heading-priority':'same-service-ROM-route-target-heading-priority',placementKind:current?'conditional-ROM-current-root-heading-priority':'conditional-ROM-route-heading-priority',headingAnchorFrame:copy(current?currentRootFrame:old),rootHypothesisKind:current?(placement.placementKind==='conditional-tested-native-root-heading-seed'?'same-frozen-native-tested-root':'same-frozen-native-emitted-root'):'previous-owned-native-root',
   routeHeading:{romSHA256,recordKey:record.key,graphSource:copy(graph.source),ai:ai.map(a=>({species:a.species,flags:a.flags,sourceOffset:a.sourceOffset})),targets:row.targets,source:'Existing ROM-bound state2 entry steering WASM',ordering:'source facing dot with prior heading, not calibrated confidence',actorHeadingCorrespondenceAssumed:true,sourceRouteReached:false,sourceTargetKnown:false},
   priorSupportReused:false,currentActorPoseCertified:false,currentRootCertified:false,actorAssociationCertified:false,sourceClockKnown:false,ATChoiceKnown:false,priorityOnly:true}
 }));
}

export function createNativeRouteHeadingPriority({rom,project,romSHA256,loadKernel=async()=>{
 const r=await fetch(new URL('./wasm/monster_movement.wasm',import.meta.url));if(!r.ok)throw Error(`Movement WASM HTTP ${r.status}`);return(await WebAssembly.instantiate(await r.arrayBuffer(),{})).instance;
}}){
 let ready=null;const creators=new Map();
 return {async proposals(priors,{frame,record,candidate,speciesIds,isCurrent=()=>true,currentRootFrame=null}){
  if(!priors.length)return [];
  const current=()=>{if(!isCurrent())throw new DOMException('Source heading priority superseded','AbortError');};current();
  // One immutable ROM service owns the table/graph cache. With no owned prior
  // hypothesis this path performs no additional reads, loads or preparation.
  ready??=(async()=>{const trig=preferredNodeTrigFromRom(rom,{includeAtan:true});return{trig,motionKernel:new MonsterMovementKernel(await loadKernel(),trig),graphs:mineFieldGraphs(project.nfs,decodeCalls)};})();
  const source=await ready;current();
  const matches=source.graphs.graphs.filter(g=>g.path===fieldPathName(record.fieldCode));
  if(record.mapId>=40000&&record.mapId<50000||matches.length!==1)return [];
  if(!creators.has(record.key))creators.set(record.key,mineCreatorResources(project.nfs,record.mapId));
  const out=[];for(const prior of priors){out.push(...deriveSourceTargetHeadingProposals({prior,frame,record,candidate,speciesIds,graph:matches[0],creator:creators.get(record.key),motionKernel:source.motionKernel,trig:source.trig,romSHA256,currentRootFrame}));current();}
  return out;
 }};
}
