/* Conditional source actor-height proposal. This evaluates native plane queries
 * at proposed heights, followed by the guarded wrapper rule. Actual collision
 * admission, prior height, movement flags and native candidate collection remain
 * unknown. No source geometric floor is relabeled as observed actor Y. */
import{selectNativeFloorCandidate}from'./native-floor-candidate.mjs';
import{conditionalSettledActorHeight}from'../monster-source-ground.mjs?v=source-scene-20261006-0040';
export function conditionalSourceGroundAtXZ({floors,xFx,zFx,initialQueryYFx,rule,maxQuerySteps=32,isCurrent=()=>true}){
 if(!Number.isSafeInteger(maxQuerySteps)||maxQuerySteps<1)throw Error('Finite native query proposal budget required');
 if(!isCurrent())throw new DOMException('Ground proposal cancelled','AbortError');
 if(floors.unsupported?.length)return{ready:false,reason:'Unsupported source collision instance exists',unknownOtherHeightPossible:true};
 const hypotheses=[],unresolved=[];
 for(const instance of floors.instances){const vertices=instance.col.records.filter(r=>!(r.rawFlags&1)).map(r=>({record:r,verticesFx:r.verticesQuantized.map(v=>v.map(x=>x*2**instance.col.shift)),normalFx:r.normalFx})),origin=instance.positionFx,localXZ=[xFx-origin[0],zFx-origin[2]],visited=new Set(),trace=[];let y=initialQueryYFx;
  while(!visited.has(y)){if(!isCurrent())throw new DOMException('Ground proposal cancelled','AbortError');if(trace.length>=maxQuerySteps){unresolved.push({member:instance.member,reason:'Finite source-query proposal budget exhausted; actor height remains unknown',maxQuerySteps,trace});break;}visited.add(y);const localY=y-origin[1],start=[localXZ[0],localY+rule.queryAboveFx,localXZ[1]],end=[localXZ[0],localY-rule.queryBelowFx,localXZ[1]];const query=selectNativeFloorCandidate(vertices,start,end);if(query.selected<0){unresolved.push({member:instance.member,reason:query.reason,trace});break;}
   const selected=vertices[query.selected].record,height=conditionalSettledActorHeight({nativePlaneYFx:query.pointFx[1],instanceYFx:origin[1],priorYFx:y,rule}),next=height.groundYFx,step={queryActorYFx:y,start,end,nativePlaneYFx:query.pointFx[1],source:{archive:instance.archive,stream:instance.stream,chunkId:instance.chunkId,placementId:instance.placementId,member:instance.member,recordIndex:selected.index,sourceOffset:selected.sourceOffset},height};trace.push(step);
   if(height.branchResult.actorYFx===y){hypotheses.push({actorYFx:y,source:step.source,trace,height,conditions:['Only this supported static instance participates and its supplied source-record candidate list is admitted','Native actor floor-search flag0x100 is clear','Prior-highest floor, ordinary step-height and movement/param14 admission conditions pass','This explicit numerical-height proposal follows the source correction/retain-prior chain shown in trace; other admitted prior heights remain possible'],currentActorYProven:false,nativeCandidateSelectionProven:false,unknownOtherHeightPossible:true});break;}
   y=next;if(visited.has(y)){unresolved.push({member:instance.member,reason:'Source ground-height query enters a rounding cycle; no unique settled write height',trace});break;}
  }
 }
 return{ready:hypotheses.length>0,hypotheses,unresolved,currentActorYProven:false,unknownOtherHeightPossible:true,scope:'Conditional settled correction branch only; actual native selection, flags, motion, prior height and other height branches are not established.'};
}
