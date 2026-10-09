import {createSourceNPCModeZeroReader,isPreparedNPCModeZero} from './source-npc-mode-zero.mjs';
// Non-spawn AT consumers. Reachability/order are explicit facts or hypotheses;
// visible NPC/container counts are never silently converted into draw counts.
export class WorldATKernel {
 constructor(kernel){this.kernel=kernel;this.e=kernel.e;if(!this.e.world_movement_init)throw Error('非spawn消費対応WASMが必要です');}
 consume(state,events){let position=BigInt(state.position);const initial=position,outputs=[];
  const finish=(resolved,reason)=>({resolved,reason,position:String(position),consumed:Number(position-initial),minimumConsumed:Number(position-initial),outputs,bootProof:false,unresolvedConsumersRemain:!resolved});
  for(const event of events){if(event.reached===false)continue;if(event.reached!==true)return finish(false,'consumer reachability unknown');
   if(event.kind==='source-NPC-mode-zero-interval'){
    const proof=event.sourceProof;
    if(!isPreparedNPCModeZero(proof))throw Error('Fresh ROM-prepared NPC mode-zero proof required');
    if(proof.ordinaryActorFamily.calls.max!=='0')return finish(false,'ordinary NPC mode-zero source conditions unavailable');
    // No generate(), timestamp, native frame counter, seed or arbitrary call
    // cap is needed: every admitted invocation of this source family is zero.
    outputs.push({kind:event.kind,mapId:proof.mapId,position:String(position),consumed:0,scope:'conditional ordinary kind1 NPC body/controller family only',sourceConditional:true,conditionsMeasured:false,conditions:proof.conditions,sourceProof:proof,otherWorldConsumersUnresolved:true,currentATRecovered:false});
    continue;
   }
   if(!['movement-init','actor-phase-init','pickup-materialize'].includes(event.kind))return finish(false,'consumer not implemented: '+event.kind);
   if(event.kind==='pickup-materialize'&&(!Number.isInteger(event.lower)||!Number.isInteger(event.upper)||event.lower<0||event.upper>0x7fffffff||event.upper<=event.lower))return finish(false,'pickup descriptor bounds missing/nonpositive');
   const [seed,random]=this.kernel.generate(state.seed,position,1);position++;
   const value=event.kind==='movement-init'?this.e.world_movement_init(random):event.kind==='actor-phase-init'?this.e.world_actor_phase(random):this.e.world_pickup_phase(random,event.lower,event.upper);
   outputs.push({kind:event.kind,object:event.object??null,position:String(position),seed,random,value});
  }return finish(true,'provided ordered consumers resolved');
 }
}
export function replayWorldPairs(observation,kernel){const engine=new WorldATKernel(kernel),actual=engine.consume({seed:observation.startSeed,position:0n},observation.items.map(({kind,object,lower,upper})=>({kind,object,lower,upper,reached:true}))),mismatches=[];
 actual.outputs.forEach((r,i)=>{const expected=observation.items[i];if(r.random!==expected.random||r.value!==expected.result)mismatches.push({sequence:i+1,kind:r.kind,expectedRandom:expected.random,random:r.random,expectedResult:expected.result,value:r.value});});
 return {format:'dq9-world-consumer-actual-replay',source:observation.origin,...actual,expectedCount:observation.items.length,mismatches,interpretation:'Paired return/writer replay, not autonomous event enumeration or a boot proof.'};
}

const isU32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const isI32=n=>Number.isInteger(n)&&n>=-0x80000000&&n<=0x7fffffff;
// Two explicit instruction-stage contracts, not a frame/NPC scheduler. These do
// not mutate ATSession or claim that the supplied instruction stage was reached.
export class MovementATStep {
 constructor(kernel){this.kernel=kernel;this.e=kernel.e;if(!this.e.world_actor_elapsed_write)throw Error('継続移動消費対応WASMが必要です');}
 elapsedWrite(state,input={}){
  if(input.reached!==true)return {resolved:false,reason:'elapsed writer reachability unknown',consumed:0,bootProof:false};
  // flagsAtWriter must be sampled/derived after 0203ce98 and the other motion
  // calls; flags at actor-update entry are not an interchangeable input.
  if(!isU32(state.elapsed)||!isU32(input.delta)||!isU32(input.flagsAtWriter))return {resolved:false,reason:'elapsed writer needs uint32 elapsed, supplied delta and post-motion flags',consumed:0,bootProof:false};
  const elapsed=this.e.world_actor_elapsed_write(state.elapsed,input.delta,input.flagsAtWriter)>>>0;
  return {resolved:true,reason:'reached elapsed store resolved',before:state.elapsed,elapsed,operation:input.flagsAtWriter&1?'zero':'add',consumed:0,bootProof:false,scope:'0203ce74..0203ce88 only; motion and invocation schedule remain external'};
 }
 timerStep(state,input={}){
  if(!isU32(state.seed))throw Error('seed must be uint32');
  const start=BigInt(state.position);if(start<0n)throw Error('position must be nonnegative');
  let position=start;
  const finish=(resolved,reason,extra={})=>({resolved,reason,position:String(position),consumed:Number(position-start),minimumConsumed:Number(position-start),bootProof:false,sessionUnchanged:true,scope:'reached actor+0x14 comparison tail only',...extra});
  // True specifically asserts arrival at 020411b0: upstream controller/global,
  // descriptor and actor gates and the preceding actor update are external.
  if(input.comparisonReached!==true)return finish(false,'timer comparison reachability unknown');
  if(!isU32(state.threshold)||!isU32(state.elapsed))return finish(false,'timer comparison needs uint32 threshold and post-update elapsed');
  if(!this.e.world_movement_due(state.threshold,state.elapsed))return finish(true,'unsigned threshold >= elapsed: no draw in this tail',{branch:'skip',threshold:state.threshold,elapsed:state.elapsed});
  // Only mode 8 / clear controller bit 3 was reached in the native evidence.
  // Mode 9/10 path selection and zero-threshold/no-reset-draw branches are not
  // silently promoted to measured production behavior.
  if(input.descriptorMode!==8)return finish(false,'proceeding descriptor mode not measured by this contract',{branch:'proceed'});
  if(!isU32(input.controllerFlags)||(input.controllerFlags&0x20009)!==0)return finish(false,'controller flags do not match reached mode-8 tail preconditions',{branch:'proceed'});
  const g=input.geometry;
  if(!g||![g.x,g.z,g.maxX,g.maxZ,g.minX,g.minZ].every(isI32))return finish(false,'signed original position and descriptor bounds required',{branch:'proceed'});
  const mask=this.e.world_direction_mask(g.x,g.z,g.maxX,g.maxZ,g.minX,g.minZ),candidates=[];
  for(let index=0;index<4;index++)if(mask&(1<<index))candidates.push(index);
  if(!candidates.length)return finish(false,'empty native direction list is not modeled',{branch:'proceed',candidateMask:mask});
  const [directionSeed,directionRandom,resetSeed,resetRandom]=this.kernel.generate(state.seed,position,2);
  const ordinal=this.e.world_direction_ordinal(directionRandom,candidates.length),threshold=this.e.world_movement_init(resetRandom);position+=2n;
  return finish(true,'provided reached mode-8 timer tail resolved',{branch:'proceed',threshold,elapsed:state.elapsed,candidateMask:mask,candidateIndices:candidates,candidateCount:candidates.length,selectedOrdinal:ordinal,selectedCandidateIndex:candidates[ordinal],draws:[{kind:'direction',position:String(start+1n),seed:directionSeed,random:directionRandom},{kind:'threshold-reset',position:String(position),seed:resetSeed,random:resetRandom}],movementStateResolved:false,unresolved:['mode-8 direction vectors, target/actor flag writes and intervening motion','next invocation, elapsed delta producer and global consumer order']});
 }
}

// Entry preparation for the existing ordered world-consumer flow. The map and
// scenario identities come from its ROM/video map alternative; this helper
// accepts no seed, clock or manually supplied mode/call-count override.
export async function prepareSourceNPCWorldInterval(context,sourceIdentity){
 const read=await createSourceNPCModeZeroReader(context),sourceProof=read(sourceIdentity);
 return Object.freeze({kind:'source-NPC-mode-zero-interval',reached:true,reachability:'conditional reached source branch; not measured',sourceProof});
}
