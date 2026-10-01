// Source-bound, explicit-clock continuation of the already reached F06 load.
// Updater writes are disjoint from the existing actor/spawn model. Its bounded
// zero-AT projection is checked before composition, never assumed from a seed.
import {stepPickupUpdater} from './pickup-updater.mjs';
import {deriveNaturalFreeSlot} from './field-inventory.mjs';
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const need=(p,m)=>{if(!p)throw Error(m);};
export function prepareF06Continuation(project,initial,trajectory,transitions,firstWorldFrame){
 need(exact(initial,['initialSourceFrame','cursor','accumulatorBits','groupWords','conditions']),'Initial recurring pickup packet required');
 need(uint(initial.initialSourceFrame)&&initial.initialSourceFrame<firstWorldFrame,'Initial updater frame must precede the first world phase');
 const names=['ordinaryOfflineUpdates','noOtherPickupWordWriters','motionCannotMutateATInputs','ordinaryF06LoaderComplete','noOtherDestinationAT','completeOrderedUpdaterStream','completeOrderedDestinationTicks','noOtherDestinationFieldWrites','noOtherDestinationPoolWrites'];
 need(exact(initial.conditions,names)&&names.every(k=>initial.conditions[k]===true),'Destination/updater runtime conditions unresolved');
 need(exact(initial.groupWords,Array.from({length:100},(_,i)=>String(i)))&&Object.values(initial.groupWords).every(n=>uint(n)),'Complete original100 pickup group words required');
 need(exact(trajectory,['pickupUpdates','schedulerTicks']),'Reached updater and F06 scheduler streams required');
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
 return {ticks,updates,initial:{cursor:initial.cursor,accumulatorBits:initial.accumulatorBits,words:{...initial.groupWords}},atPickup:structuredClone(atPickup),finalState:state,scope:'Explicit reached clocks; recurring pickup AT/countdown only',worldResolved:false};
}
export function advanceF06Continuation(session){
 if(session.stopped)return false;
 const plan=session.f06Continuation,index=session.f06TickIndex??0,t=plan.ticks[index];
 if(!t){session.status='trajectory-ended';session.reason='F06 clock軌跡の終端。以降のworld更新は未確定です';session.stopped=true;return false;}
 const row={index:session.events.length,sourceFrame:t.sourceFrame,phase:'destination-world-tick',mapId:20006,heroXYZ:null,seed:session.seed,timer:session.timer,consumed:0,invocationResolved:false,status:'unresolved',reason:''};
 try{
  need(session.currentMapId===20006&&session.pendingTransition?.phase==='pickup-projected','Reached F06 pickup boundary required');
  if(index===0){
   // 0202821c timer reset; 021b507c active write after graph success;
   // 021b5bfc flag8. This reconstructs no resource/template/terrain state.
   session.timer=0;session.field.flags=(session.field.index&3)|12;session.field.active=1;
  }
  const applicable=plan.updates.filter(u=>u.sourceFrame<t.sourceFrame),last=applicable.at(-1);
  session.pickupUpdater={cursor:last?.cursor??plan.initial.cursor,accumulatorBits:last?.accumulatorBits??plan.initial.accumulatorBits,projectedInvocations:applicable.length,consumed:0,motionResolved:false};
  const input={active:session.field.active===1,storyAllowed:true,delta:t.delta};
  const original={seed:session.seed,position:'0',timer:session.timer};let result=session.scheduler.step(original,input,{});
  if(!result.resolved&&result.reason==='free-slot result unknown'){const free=deriveNaturalFreeSlot(session.context.inventory,{group:0});if(free.resolved){input.freeSlot=free.freeSlot;result=session.scheduler.step(original,input,{});}}
  need(result.consumed===0,'Unexpected destination AT without resolved geometry');session.timer=result.timer;
  row.timer=session.timer;row.updaterInvocations=applicable.length;row.freeSlot=input.freeSlot??null;
  row.invocationResolved=result.resolved;row.status=result.resolved?'running':'unresolved';
  row.reason=result.reason==='initial-1000-gate'?'F06初期timer gate。pickup更新も初期状態からATなしを導出':result.reason==='next eligible member/geometry unknown'?'F06のtimer gateを通過。現在hero位置・向き・nodeが不明のためgeometry前で停止':'F06: '+result.reason;
  session.status=row.status;session.reason=row.reason;session.f06TickIndex=index+1;session.stopped=!result.resolved;
  session.events.push(row);return result.resolved;
 }catch(error){row.reason=error.message;session.status='unresolved';session.reason=row.reason;session.stopped=true;session.events.push(row);return false;}
}
