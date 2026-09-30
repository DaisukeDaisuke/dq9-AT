// Non-spawn AT consumers. Reachability/order are explicit facts or hypotheses;
// visible NPC/container counts are never silently converted into draw counts.
export class WorldATKernel {
 constructor(kernel){this.kernel=kernel;this.e=kernel.e;if(!this.e.world_movement_init)throw Error('非spawn消費対応WASMが必要です');}
 consume(state,events){let position=BigInt(state.position);const initial=position,outputs=[];
  const finish=(resolved,reason)=>({resolved,reason,position:String(position),consumed:Number(position-initial),minimumConsumed:Number(position-initial),outputs,bootProof:false,unresolvedConsumersRemain:!resolved});
  for(const event of events){if(event.reached===false)continue;if(event.reached!==true)return finish(false,'consumer reachability unknown');
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
