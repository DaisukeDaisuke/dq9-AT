import {prepareF06Creator,projectF06Creator} from './f06-creator.mjs';
// Source-bound, explicit-clock continuation of the already reached F06 load.
// Updater writes are disjoint from the existing actor/spawn model. Its bounded
// zero-AT projection is checked before composition, never assumed from a seed.
import {stepPickupUpdater} from './pickup-updater.mjs';
import {deriveNaturalFreeSlot,describeInventorySlot} from './field-inventory.mjs';
import {prepareF06HeroMotion,advanceF06HeroMotion} from './f06-hero-motion.mjs';
import {queryPreferredFieldNode} from './field-preferred-node.mjs';
import {evaluateFieldSpawnPoint} from './field-spawn-point.mjs';
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const need=(p,m)=>{if(!p)throw Error(m);};
export function prepareF06Continuation(project,initial,trajectory,transitions,firstWorldFrame,{rom}={}){
 const withCreator=Object.hasOwn(initial??{},'creator'),withMotion=Object.hasOwn(initial??{},'heroMotion');need(!withCreator||withMotion,'F06 creator requires source-carried motion');need(withMotion===Object.hasOwn(trajectory??{},'heroMotion'),'Motion runtime/control packets must be supplied together');
 need(exact(initial,['initialSourceFrame','cursor','accumulatorBits','groupWords','conditions',...(withMotion?['heroMotion']:[]),...(withCreator?['creator']:[])]),'Initial recurring pickup packet required');
 need(uint(initial.initialSourceFrame)&&initial.initialSourceFrame<firstWorldFrame,'Initial updater frame must precede the first world phase');
 const names=['ordinaryOfflineUpdates','noOtherPickupWordWriters','motionCannotMutateATInputs','ordinaryF06LoaderComplete','noOtherDestinationAT','completeOrderedUpdaterStream','completeOrderedDestinationTicks','noOtherDestinationFieldWrites','noOtherDestinationPoolWrites'];
 need(exact(initial.conditions,names)&&names.every(k=>initial.conditions[k]===true),'Destination/updater runtime conditions unresolved');
 need(exact(initial.groupWords,Array.from({length:100},(_,i)=>String(i)))&&Object.values(initial.groupWords).every(n=>uint(n)),'Complete original100 pickup group words required');
 need(exact(trajectory,['pickupUpdates','schedulerTicks',...(withMotion?['heroMotion']:[])]),'Reached updater and F06 scheduler streams required');
 need(dense(trajectory.pickupUpdates)&&trajectory.pickupUpdates.length>0&&trajectory.pickupUpdates.length<=5000,'Bounded updater stream required');
 need(dense(trajectory.schedulerTicks)&&trajectory.schedulerTicks.length>0&&trajectory.schedulerTicks.length<=2000,'Bounded F06 scheduler stream required');
 need(transitions.phases.length===18&&transitions.phases.at(-1).phase==='pickup-materialization','F06 pickup prefix required');
 const pickupFrame=transitions.phases.at(-1).sourceFrame,record=project.records.find(r=>r.mapId===20006),graph=project.fieldGraphs.graphs.find(g=>g.key===record?.fieldGraph?.key);
 need(record?.fieldCode==='F06'&&graph?.nodes?.length>0,'Successful ordinary F06 graph binding required');
 let previous=pickupFrame;
 const ticks=trajectory.schedulerTicks.map(t=>{need(exact(t,['sourceFrame','delta'])&&uint(t.sourceFrame)&&t.sourceFrame>previous&&uint(t.delta,50),'Ordered reached F06 scheduler delta0..50 required');previous=t.sourceFrame;return {...t};});
 let state={cursor:initial.cursor,accumulatorBits:initial.accumulatorBits,words:{...initial.groupWords}},atPickup=state;previous=initial.initialSourceFrame;
 const updates=trajectory.pickupUpdates.map(t=>{
  need(exact(t,['sourceFrame','scaledDelta'])&&uint(t.sourceFrame)&&t.sourceFrame>=previous&&t.sourceFrame<ticks.at(-1).sourceFrame&&t.sourceFrame!==pickupFrame&&uint(t.scaledDelta,50),'Updater stream must stop before the final scheduler phase');previous=t.sourceFrame;
  const result=stepPickupUpdater(state,{reached:true,networkBlocked:false,scaledDelta:t.scaledDelta,motionCannotMutateATInputs:true});
  need(result.resolved&&result.consumed===0,'Recurring pickup continuation stops: '+result.reason);
  state=result.state;if(t.sourceFrame<pickupFrame)atPickup=state;
  return {sourceFrame:t.sourceFrame,scaledDelta:t.scaledDelta,cursor:state.cursor,accumulatorBits:state.accumulatorBits,group:result.group,reason:result.reason,beforeWord:result.beforeWord,afterWord:result.afterWord};
 });
 // The old materializer is safe to compose only if its selected source words
 // really survive this carried updater prefix. No future snapshot is substituted.
 for(const [group,word] of Object.entries(transitions.context.pickup.stateWords))need(atPickup.words[group]===word,'Derived pickup word differs before materialization');
 const motion=withMotion?prepareF06HeroMotion({project,rom,packet:initial.heroMotion,stream:trajectory.heroMotion,transitions,ticks,initialSourceFrame:initial.initialSourceFrame}):null;
 const creator=withCreator?prepareF06Creator(project,rom,initial.creator,initial.initialSourceFrame):null;
 return {creator,motion,ticks,updates,initial:{cursor:initial.cursor,accumulatorBits:initial.accumulatorBits,words:{...initial.groupWords}},atPickup:structuredClone(atPickup),finalState:state,scope:'Explicit reached clocks; recurring pickup AT/countdown only',worldResolved:false};
}
export function advanceF06Continuation(session){
 if(session.stopped)return false;
 const plan=session.f06Continuation,index=session.f06TickIndex??0,t=plan.ticks[index],motion=plan.motion;
 if(!t){session.status='trajectory-ended';session.reason='F06 clock軌跡の終端。以降のworld更新は未確定です';session.stopped=true;return false;}
 const row={index:session.events.length,sourceFrame:t.sourceFrame,phase:'destination-world-tick',mapId:20006,heroXYZ:null,seed:session.seed,timer:session.timer,consumed:0,invocationResolved:false,status:'unresolved',reason:''};
 const original={seed:session.seed,position:'0',timer:index===0?0:session.timer};let result;
 function finish(resolved,reason){
  const consumed=result?.consumed??0;session.seed=session.atKernel?session.atKernel.seedAt(original.seed,BigInt(consumed)):original.seed;session.consumed+=consumed;session.timer=result?.timer??session.timer;
  Object.assign(row,{seed:session.seed,consumed,timer:session.timer,invocationResolved:resolved,status:resolved?'running':'unresolved',reason});session.status=row.status;session.reason=reason;session.f06TickIndex=index+1;session.stopped=!resolved;session.events.push(row);return resolved;
 }
 try{
  need(session.currentMapId===20006&&session.pendingTransition?.phase==='pickup-projected','Reached F06 pickup boundary required');
  if(index===0){session.timer=0;session.field.flags=(session.field.index&3)|12;session.field.active=1;}
  const applicable=plan.updates.filter(u=>u.sourceFrame<t.sourceFrame),last=applicable.at(-1);
  session.pickupUpdater={cursor:last?.cursor??plan.initial.cursor,accumulatorBits:last?.accumulatorBits??plan.initial.accumulatorBits,projectedInvocations:applicable.length,consumed:0,motionResolved:false};
  const input={active:session.field.active===1,storyAllowed:true,delta:t.delta};result=session.scheduler.step(original,input,{});
  if(!result.resolved&&result.reason==='free-slot result unknown'){const free=deriveNaturalFreeSlot(session.context.inventory,{group:0});if(free.resolved){input.freeSlot=free.freeSlot;result=session.scheduler.step(original,input,{});}}
  row.updaterInvocations=applicable.length;row.freeSlot=input.freeSlot??null;
  if(motion){
   need(session.hero?.slot===0&&session.hero.mapId===20006&&session.hero.alternateMap===0xffffffff&&session.hero.headerFlags===motion.hero.header&&session.context.globalWord===0&&session.parties.every((p,i)=>i===0||p.pointer===0),'Carried ordinary selected-hero identity/global branch required');
   Object.assign(session.hero,{xyz:[...motion.state.xyz],angle:motion.state.angle,nodeIndex:motion.node});row.heroXYZ=[...motion.state.xyz];row.conditionalPose=true;
   session.currentCoordinate={mapId:20006,xyz:[...motion.state.xyz],kind:'conditional-source-carried',sourceFrame:t.sourceFrame,assumptions:[...motion.assumptions]};
   if(!result.resolved&&result.reason==='next eligible member/geometry unknown'){
    const near=[];for(const slot of session.context.inventory.slots.filter(s=>s.slot>=112&&s.slot<124)){const d=describeInventorySlot(slot);need(d.allocated!==null&&d.active!==null,'Destination member proximity inventory unknown');if(!d.allocated||!d.active)continue;need(Array.isArray(d.xyz)&&d.xyz.length===3&&d.xyz.every(Number.isInteger),'Active destination actor position unknown');if(d.xyz.every((v,k)=>v>=((motion.state.xyz[k]-[61440,2048,61440][k])|0)&&v<=((motion.state.xyz[k]+[61440,6144,61440][k])|0)))near.push(slot.slot);}
    row.nearbyActorSlots=near;
    if(near.length>=3)input.attempts=[{memberId:-1}];else{
     const query=queryPreferredFieldNode({queryReached:true,player:{position:motion.state.xyz,angle:motion.state.angle,nodeIndex:motion.node,graphEnabled:true},graph:motion.graph,inventory:session.context.inventory,fieldFlags:session.field.flags,trig:session.trig});need(query.resolved,query.reason);
     input.attempts=[{memberId:0,direction:{nodeIds:query.nodeIds,dots:query.dots}},{memberId:-1}];input.timeValue=motion.day.category;input.rows=motion.rows;
     result=session.scheduler.step(original,input,motion.distributions);
     if(!result.resolved&&result.reason==='spawn position/collision/area/time unknown'){
      row.selectedNodeId=result.nodeId;const geometry=evaluateFieldSpawnPoint({pointQueryReached:true,graph:motion.graph,selectedNodeId:result.nodeId,currentNodeIndex:motion.node,playerPosition:motion.state.xyz,fieldMapId:20006,fieldFlags:session.field.flags,parties:{slots:session.parties.map(p=>({...p,effectivePositionResolved:p.pointer?true:undefined,effectivePosition:p.xyz}))},inventory:session.context.inventory,runtimeNodeFlags:motion.nodeFlags});need(geometry.resolved,geometry.reason);row.candidateXYZ=geometry.point?[...geometry.point]:geometry.candidate?.point?[...geometry.candidate.point]:null;Object.assign(input.attempts[0],{geometryEligible:geometry.geometryEligible,areaMask:geometry.areaMask});
     }
    }
    result=session.scheduler.step(original,input,motion.distributions);row.tableId=result.tableId??null;row.monsterId=result.monsterId??null;row.creationResolved=false;
    if(!result.resolved&&result.reason==='creation-result-unknown'&&plan.creator){
     const creation=projectF06Creator(session,{mapId:20006,species:result.monsterId,tableId:result.tableId,nodeId:row.selectedNodeId,candidateXYZ:row.candidateXYZ,routeFlags:0});
     if(!creation.resolved)return finish(false,creation.reason);need(creation.atConsumed===0,'Unexpected creator AT');const prefix=result;
     result=session.scheduler.step(original,{...input,creationResult:creation.result},motion.distributions);need(result.resolved&&result.consumed===prefix.consumed&&JSON.stringify(result.events)===JSON.stringify(prefix.events),'Creator refinement changed selection draws');
     row.creationResolved=true;row.worldStepResolved=false;row.creatorReturn=creation.result;row.conditionalCreator=true;
     if(creation.created){session.destinationBirth={...structuredClone(creation.actor),kind:'conditional-source-created',sourceFrame:t.sourceFrame};session.destinationCreation=creation;row.birth=structuredClone(session.destinationBirth);}
     finish(true,'F06 creator/scheduler returnまでを条件付き導出。同pass hero/body前で停止');session.status=creation.created?'created-boundary':'rejected-boundary';row.status=session.status;session.stopped=true;return false;
    }
    if(!result.resolved)return finish(false,result.reason==='creation-result-unknown'?'条件付きposeからtable/weighted ATまで導出。F06 creator資源・template bindingが未確定のため生成前で停止':result.reason);
   }
   if(result.resolved){
    const next=advanceF06HeroMotion(motion,session.kernel,{phase:motion.phases[index],scaledDelta:t.delta});if(!next.resolved){session.currentCoordinate=null;session.hero.xyz=null;return finish(false,next.reason);}
    Object.assign(motion,{state:next.state,node:next.node,lock:next.lock});Object.assign(session.hero,{xyz:[...next.state.xyz],angle:next.state.angle,nodeIndex:next.node});session.currentCoordinate={mapId:20006,xyz:[...next.state.xyz],kind:'conditional-source-carried',sourceFrame:t.sourceFrame,assumptions:[...motion.assumptions]};session.heroTrace.push([...next.state.xyz]);row.postHeroXYZ=[...next.state.xyz];row.heroNode=next.node;row.heroGround=next.ground;session.pickupUpdater.motionResolved='conditional';
   }
  }
  need(motion||result.consumed===0,'Unexpected destination AT without resolved geometry');
  const reason=result.reason==='initial-1000-gate'?(motion?'F06 timer gateとsource-carried条件付きhero更新。観測現在位置とは別':'F06初期timer gate。pickup更新も初期状態からATなしを導出'):result.reason==='next eligible member/geometry unknown'?'F06のtimer gateを通過。現在hero位置・向き・nodeが不明のためgeometry前で停止':'F06: '+result.reason;
  return finish(result.resolved,reason);
 }catch(error){return finish(false,error.message);}
}
