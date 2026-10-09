// Necessary orientation constraint only. Does not assert actor identity,
// entry reachability, elapsed updates, translation, or absence of AT consumers.
const facingCaches=new WeakMap();
export function deriveNativeTurnPhaseAlternatives({fromYaw,toYaw,targetAngle,turnRate,sourceFacing,turnAngle,phaseDomain=[0,65535]}){
 const valid=n=>Number.isInteger(n)&&n>=0&&n<=25736;
 if(![fromYaw,toYaw,targetAngle].every(valid)||!Number.isInteger(turnRate)||turnRate<0||turnRate>32767||typeof sourceFacing!=='function'||typeof turnAngle!=='function')throw Error('Source angle, signed16 rate and exact ROM/kernel leaves required');
 if(!Array.isArray(phaseDomain)||phaseDomain.length!==2||!phaseDomain.every(Number.isInteger)||phaseDomain[0]<0||phaseDomain[1]<phaseDomain[0]||phaseDomain[1]>65535)throw Error('Bounded source phase domain required');
 const before=sourceFacing(fromYaw),after=sourceFacing(toYaw),same=(a,b)=>a&&b&&a.length===b.length&&a.every((n,i)=>n===b[i]);
 if(!before||!after)return {resolved:false,reason:'ROM facing unavailable'};
 const rows=[];let cache=facingCaches.get(sourceFacing);if(!cache){cache=new Map();for(let a=0;a<=25736;a++){const f=sourceFacing(a);if(!f)continue;const key=JSON.stringify(f),list=cache.get(key)??[];list.push(a);cache.set(key,list);}facingCaches.set(sourceFacing,cache);}
 for(const angle of cache.get(JSON.stringify(before))??[]){
  let diff=targetAngle-angle;if(angle<targetAngle){if(diff>12868)diff-=25736;}else if(diff< -12868)diff+=25736;
  const saturation=turnRate?Math.ceil(Math.abs(diff)/turnRate):0;
  // All phases below saturation are separate; the rest have the same angle.
  const bound=turnRate?saturation:0;
  for(let phase=phaseDomain[0];phase<=Math.min(phaseDomain[1],Math.max(phaseDomain[0],bound));phase++){
   const output=turnAngle(angle,targetAngle,turnRate,phase);
   if(!valid(output))throw Error('Exact source orientation leaf rejected bounded input');
   if(!same(sourceFacing(output),after))continue;
   rows.push({beforeAngle:angle,targetAngle,turnRate,phase:{min:phase,max:phase>=bound?phaseDomain[1]:phase},afterAngle:output});
  }
 }
 return {resolved:true,alternatives:rows,phaseDomain:phaseDomain.slice(),conditions:['Both rendered yaw hypotheses use the ROM actor-angle convention','Exactly one supported ordinary orientation-prefix invocation','Turn rate equals the separately source-bound conditional initialization value','Target bearing was computed from this source node and root hypothesis'],necessaryOrientationOnly:true,translationResolved:false,sourceUpdateCountMeasured:false,ATCallsInOrientationLeaf:0,wholeTickATCallsKnown:false,unknownAlternativeRetained:true};
}

export function createNativeOrdinaryTurnResolver({motionKernel,sourceFacing}){
 if(!motionKernel?.sourceBinding?.sourceRanges?.some(r=>r.name==='state1-entry')||typeof motionKernel.orientationStep!=='function')throw Error('Source-bound ordinary state1 initialization and orientation kernel required');
 const turnAngle=(...args)=>{const r=motionKernel.orientationStep(...args);if(!r.resolved)throw Error(r.reason);return r.angle;};
 return(h,targetAngle)=>{const r=deriveNativeTurnPhaseAlternatives({fromYaw:h.fromPose?.yawFx,toYaw:h.toPose?.yawFx,targetAngle,turnRate:808,sourceFacing,turnAngle,phaseDomain:motionKernel.sourceBinding.ordinaryClockPhaseDomain??[0,65535]});
  if(h.fromPositionFx.some((n,i)=>n!==h.toPositionFx[i]))r.alternatives=r.alternatives.flatMap(a=>a.phase.max===0?[]:[{...a,phase:{...a.phase,min:Math.max(1,a.phase.min)}}]);
  return {...r,sourceClockConditions:motionKernel.sourceBinding.ordinaryClockConditions?.slice()??[],phaseDomainSourceBound:Boolean(motionKernel.sourceBinding.ordinaryClockPhaseDomain),initializationHypothesis:'Reached ordinary state1 entry and retained ROM turnRate808',postPrefixPositionCorrectionHypothesis:'none; changed XYZ excludes phase0',conditionsMeasured:false};
 };
}

// Multi-invocation companion for sparse observations. This is an exact finite
// graph of the existing orientation leaf, not interpolation by video seconds.
// Phase0 self-loops retain an unbounded invocation-count tail.
export function deriveNativeTurnSequenceAlternatives({fromYaw,toYaw,targetAngle,turnRate,sourceFacing,turnAngle,phaseDomain,requirePositivePhase=false,maximumStates=16384}){
 if(!Array.isArray(phaseDomain)||phaseDomain.length!==2||phaseDomain[0]!==0||!Number.isInteger(phaseDomain[1])||phaseDomain[1]<1||phaseDomain[1]>256||!Number.isSafeInteger(maximumStates)||maximumStates<1||maximumStates>65536)throw Error('Explicit bounded ordinary phase domain required');
 // Reuse the exact facing-equivalence cache and validation in the single leaf.
 const initial=deriveNativeTurnPhaseAlternatives({fromYaw,toYaw:fromYaw,targetAngle:fromYaw,turnRate:0,sourceFacing,turnAngle,phaseDomain:[0,0]});
 const wanted=sourceFacing(toYaw);if(!wanted)return {resolved:false,reason:'ROM facing unavailable'};
 const matches=angle=>{const a=sourceFacing(angle);return a&&a.length===wanted.length&&a.every((n,i)=>n===wanted[i]);};
 const alternatives=[];let visitedStates=0;
 for(const before of new Set(initial.alternatives.map(a=>a.beforeAngle))){
  const start={angle:before,positive:false,updates:0,totalPhase:0,phases:[]},queue=[start],seen=new Set([before+':false']);
  for(let i=0;i<queue.length;i++){
   if(++visitedStates>maximumStates)return {resolved:false,reason:'Ordinary turn sequence state budget reached',alternatives,remainingAlternativesRetained:true,sourceUpdateCountMeasured:false,unknownAlternativeRetained:true};
   const state=queue[i];if(matches(state.angle)&&(!requirePositivePhase||state.positive))alternatives.push({beforeAngle:before,targetAngle,turnRate,afterAngle:state.angle,minimumInvocations:state.updates,invocationCount:{min:state.updates,max:null},witness:{phases:state.phases,totalPhase:state.totalPhase},witnessIsHypothesis:true});
   for(let phase=1;phase<=phaseDomain[1];phase++){
    const angle=turnAngle(state.angle,targetAngle,turnRate,phase);if(!Number.isInteger(angle)||angle<0||angle>25736)throw Error('Source orientation sequence leaf rejected input');
    const key=angle+':true';if(seen.has(key))continue;seen.add(key);queue.push({angle,positive:true,updates:state.updates+1,totalPhase:state.totalPhase+phase,phases:[...state.phases,phase]});
   }
  }
 }
 return {resolved:true,alternatives,phaseDomain:phaseDomain.slice(),visitedStates,sourceUpdateCountMeasured:false,minimumInvocations:alternatives.length?Math.min(...alternatives.map(a=>a.minimumInvocations)):null,maximumInvocations:null,zeroPhaseSelfLoopsRetained:true,ATCallsInOrientationLeaves:0,wholeTickATCallsKnown:false,translationResolved:false,unknownAlternativeRetained:true,currentVideoStateRecovered:false,necessaryOrientationOnly:true,conditions:['Every reached invocation uses the same source target bearing and turnRate','Every phase is in the source clock domain; zero-phase repetitions are not bounded by PTS','No intervening orientation overwrite or post-prefix correction; translation/handler/other AT consumers remain unresolved']};
}
export function createNativeOrdinaryTurnSequenceResolver({motionKernel,sourceFacing}){
 if(!motionKernel?.sourceBinding?.ordinaryClockPhaseDomain||!motionKernel.sourceBinding.sourceRanges.some(r=>r.name==='state1-entry')||typeof motionKernel.orientationStep!=='function')throw Error('Source-bound clock and ordinary turn kernel required');
 const resolve=(h,targetAngle)=>{const result=deriveNativeTurnSequenceAlternatives({fromYaw:h.fromPose?.yawFx,toYaw:h.toPose?.yawFx,targetAngle,turnRate:808,sourceFacing,turnAngle:(...args)=>{const r=motionKernel.orientationStep(...args);if(!r.resolved)throw Error(r.reason);return r.angle;},phaseDomain:motionKernel.sourceBinding.ordinaryClockPhaseDomain,requirePositivePhase:h.fromPositionFx.some((n,i)=>n!==h.toPositionFx[i])});return{...result,sourceClockConditions:motionKernel.sourceBinding.ordinaryClockConditions.slice(),phaseDomainSourceBound:true,initializationHypothesis:'Ordinary state1 turnRate retained across the orientation sequence',conditionsMeasured:false};};
 resolve.sourceMode='ordinary-turn-sequence';return resolve;
}
