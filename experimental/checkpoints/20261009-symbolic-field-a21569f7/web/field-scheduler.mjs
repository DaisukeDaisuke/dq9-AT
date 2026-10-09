import {monsterForRandom} from './at-core.mjs';
import {queryPreferredFieldNode} from './field-preferred-node.mjs';

const symbolicMode=Symbol('symbolic scheduler state'),symbolicBoundary=Symbol('symbolic scheduler output');
// Owns AT consumption and timer updates. Unknown runtime facts suspend a step;
// the caller refines its original input, not a fabricated zero-draw continuation.
export class FieldScheduler {
 constructor(field){this.field=field;this.kernel=field.kernel;this.e=field.e;if(!this.e.field_spawn_timer)throw Error('生成scheduler対応WASMが必要です');}
 stepSymbolic(state,input,tables){
  if(!state?.seed||typeof state.seed!=='object'||Array.isArray(state.seed))throw Error('Opaque symbolic AT reference required');
  try{return this.step({...state,[symbolicMode]:true},input,tables);}catch(error){if(!error?.[symbolicBoundary])throw error;return error.result;}
 }
 step(state,input,tables){
  const initial=BigInt(state.position),cursor={position:initial,timer:state.timer},events=[];let row=null;
  const result=(resolved,reason,extra={})=>({resolved,reason,position:String(cursor.position),timer:cursor.timer,consumed:Number(cursor.position-initial),minimumConsumed:Number(cursor.position-initial),events,bootProof:false,...(!resolved?{refineOriginalInput:true,originalState:{...state,position:String(initial)}}:{}),...extra});
  const draw=(kind,outputIndependent=false)=>{if(state[symbolicMode]){if(!outputIndependent)throw {[symbolicBoundary]:true,result:result(false,'symbolic-AT-output-required',{requestedDraw:{kind,position:String(cursor.position),count:1},ATReference:state.seed,numericSeedSupplied:false})};cursor.position++;events.push({kind,position:String(cursor.position),ATReference:state.seed,random:null,outputDomain:[0,32767],outputIndependent:true});return null;}const [seed,random]=this.kernel.generate(state.seed,cursor.position,1);cursor.position++;events.push({kind,position:String(cursor.position),seed,random});return random;};
  if(input.active===false||input.storyAllowed===false)return result(true,'inactive-or-story-gated');
  if(input.active!==true||input.storyAllowed!==true)return result(false,'activity/story gate unknown');
  const delta=Number.isInteger(input.elapsedLow)&&Number.isInteger(input.elapsedHigh)?this.e.field_clock_delta(input.elapsedLow,input.elapsedHigh):input.delta;
  if(!Number.isInteger(state.timer)||!Number.isInteger(delta))return result(false,'timer/elapsed unknown');
  cursor.timer=this.e.field_spawn_timer(state.timer,delta);events.push({kind:'timer',before:state.timer,delta,after:cursor.timer});
  if(cursor.timer<1000)return result(true,'initial-1000-gate');
  if(!Number.isInteger(input.freeSlot))return result(false,'free-slot result unknown');
  if(input.freeSlot<0)return result(true,'no-free-slot');
  for(let index=0;index<4;index++){
   const attempt=input.attempts?.[index];
   if(!attempt)return result(false,'next eligible member/geometry unknown',{attempt:index});
   if(attempt.memberId===-1)return result(true,'no-untried-eligible-member');
   if(!Number.isInteger(attempt.memberId))return result(false,'selected member unknown',{attempt:index});
   let node=attempt.nodeId,direction=attempt.direction;
   if(attempt.preferredQuery){
    if(direction)return result(false,'conflicting supplied and derived direction inputs',{attempt:index});
    const query=queryPreferredFieldNode(attempt.preferredQuery);
    if(!query.resolved)return result(false,query.reason,{attempt:index,preferredQuery:query});
    direction=query;
    events.push({kind:'preferred-query',attempt:index,nodeIds:query.nodeIds,dots:query.dots,preferredNodeId:query.preferredNodeId});
   }
   if(direction){
    const {nodeIds,dots}=direction;
    if(!Array.isArray(nodeIds)||!Array.isArray(dots)||dots.length!==nodeIds.length||dots.some(x=>!Number.isInteger(x)))return result(false,'ordered direction candidates/dots unknown');
    if(!nodeIds.length)continue;
    const p=this.kernel.heap;this.field.reserve(dots.length*4);new Int32Array(this.e.memory.buffer,p,dots.length).set(dots);
    let chosen=this.e.field_spawn_direction_index(p,dots.length);if(chosen<0){const random=draw('spawn-direction',nodeIds.length===1);chosen=nodeIds.length===1?0:random%nodeIds.length;}
    node=nodeIds[chosen];
   }else if(attempt.directionResolved!==true)return result(false,'spawn-direction draw status unknown',{attempt:index});
   events.push({kind:'node',attempt:index,memberId:attempt.memberId,nodeId:node});
   if(attempt.geometryEligible===false)continue;
   if(attempt.geometryEligible!==true||!Number.isInteger(attempt.areaMask)||!Number.isInteger(input.timeValue)||!Array.isArray(input.rows))return result(false,'spawn position/collision/area/time unknown',{attempt:index,nodeId:node});
   const candidates=this.field.tableCandidates(input.rows,input.timeValue,attempt.areaMask);
   if(candidates.length){const random=draw('table-select',candidates.length===1);row=candidates[candidates.length===1?0:this.e.at_randint(random,candidates.length)];}else row=null;
   if(!row)continue;
   const threshold=this.e.field_spawn_delay(row.flags),next=input.attempts?.[index+1];
   const branch=this.e.field_spawn_delay_branch(cursor.timer,row.flags,index,next?.memberId===-1?0:Number.isInteger(next?.memberId)?1:-1);
   events.push({kind:'delay',attempt:index,tableId:row.tableId,threshold,timer:cursor.timer,branch});
   if(branch===2)break;
   if(branch===0)return result(true,'delay-then-no-member');
   if(branch<0)return result(false,'delay-next-member-unknown',{attempt:index+1});
  }
  // Four-attempt exhaustion retains the last table through skipped geometry.
  // Early no-member is different: it returned above without a weighted draw.
  if(!row)return result(true,'no-final-table');
  const table=tables[String(row.tableId)];if(!table)return result(false,'existing-enc-distribution-missing',{tableId:row.tableId});
  const outcome=monsterForRandom(table,draw('weighted-monster'));
  if(!outcome.monster)return result(false,'weighted-result-unresolved',{tableId:row.tableId,...outcome});
  const details={tableId:row.tableId,monsterId:Number(outcome.monster.monsterId),monsterName:outcome.monster.monsterName,value:outcome.value};
  if(!Number.isInteger(input.creationResult))return result(false,'creation-result-unknown',details);
  cursor.timer=this.e.field_spawn_finish_timer(cursor.timer,input.creationResult);
  return result(true,input.creationResult?'created':'creation-rejected',{...details,creationResult:input.creationResult});
 }
}

export function replaySchedulerTrace(trace,field,tables){
 const scheduler=new FieldScheduler(field),groups=new Map(),mismatches=[],records=[];
 for(const event of trace.schedulerEvents||[]){if(!groups.has(event[1]))groups.set(event[1],[]);groups.get(event[1]).push(event);}
 const check=(ok,id,kind,actual,expected)=>{if(!ok)mismatches.push({invocation:id,kind,actual,expected});};
 for(const [id,events]of groups){
  const find=k=>events.find(e=>e[0]===k),entry=find('entry'),delta=find('delta'),timer=find('timer'),exit=find('exit');
  if(!entry||!exit){records.push({invocation:id,complete:false});continue;}
  if(!delta||!timer){records.push({invocation:id,complete:true,reason:'pre-timer-gate-unobserved'});continue;}
  const computed=field.e.field_spawn_timer(delta[4],delta[5]);check(computed===timer[4],id,'timer-add',computed,timer[4]);
  const slot=find('slot'),attempts=[];let current=null;
  for(const e of events){
   if(e[0]==='member'){current={memberId:e[4],directionResolved:false,geometryEligible:false};attempts[e[5]]=current;}
   if(e[0]==='direction'&&current){current.directionResolved=e[4]>=0;current.nodeId=e[4];if(e[4]<0)current.direction={nodeIds:e[6],dots:e[6].map(()=>0)};}
   if(e[0]==='node'&&current)current.nodeId=e[4];
   if(e[0]==='table'&&current){current.geometryEligible=true;const call=(trace.tableCalls||[]).find(c=>c[0]===e[3]-1);current.areaMask=call?.[1];}
   if(e[0]==='delay'){const t=events.find(x=>x[0]==='table'&&x[4]===e[6]);if(t)check(field.e.field_spawn_delay(t[6])===e[5],id,'delay-flags',field.e.field_spawn_delay(t[6]),e[5]);}
  }
  const context=trace.contexts?.[String(entry[5])];
  const result=scheduler.step({seed:trace.startSeed,position:entry[3],timer:entry[7]},
   {active:entry[6]!==0,storyAllowed:true,delta:delta[5],freeSlot:slot?.[4],attempts,rows:context?.rows,timeValue:context?.timeValue,creationResult:find('created')?.[4]},tables);
  if(result.resolved){check(result.timer===exit[4],id,'timer-exit',result.timer,exit[4]);check(result.consumed===exit[3]-entry[3],id,'AT-consumption',result.consumed,exit[3]-entry[3]);}
  const weighted=find('weighted');if(weighted&&result.monsterId!==undefined)check(result.monsterId===weighted[4],id,'monster',result.monsterId,weighted[4]);
  const created=find('created');if(created)check(field.e.field_spawn_finish_timer(computed,created[4])===exit[4],id,'creation-reset',field.e.field_spawn_finish_timer(computed,created[4]),exit[4]);
  records.push({invocation:id,complete:true,resolved:result.resolved,reason:result.reason,consumed:result.consumed,actualConsumed:exit[3]-entry[3],timerBefore:entry[7],delta:delta[5],timerAfter:exit[4],monsterId:result.monsterId});
 }
 return {format:'dq9-scheduler-production-replay',invocations:groups.size,records,mismatches,bootProof:false,geometrySource:'actual branch observations; geometry and delta source simulation remain separate'};
}
