// Necessary orientation constraint only. Does not assert actor identity,
// entry reachability, elapsed updates, translation, or absence of AT consumers.
const facingCaches=new WeakMap();
export function deriveNativeTurnPhaseAlternatives({fromYaw,toYaw,targetAngle,turnRate,sourceFacing,turnAngle}){
 const valid=n=>Number.isInteger(n)&&n>=0&&n<=25736;
 if(![fromYaw,toYaw,targetAngle].every(valid)||!Number.isInteger(turnRate)||turnRate<0||turnRate>32767||typeof sourceFacing!=='function'||typeof turnAngle!=='function')throw Error('Source angle, signed16 rate and exact ROM/kernel leaves required');
 const before=sourceFacing(fromYaw),after=sourceFacing(toYaw),same=(a,b)=>a&&b&&a.length===b.length&&a.every((n,i)=>n===b[i]);
 if(!before||!after)return {resolved:false,reason:'ROM facing unavailable'};
 const rows=[];let cache=facingCaches.get(sourceFacing);if(!cache){cache=new Map();for(let a=0;a<=25736;a++){const f=sourceFacing(a);if(!f)continue;const key=JSON.stringify(f),list=cache.get(key)??[];list.push(a);cache.set(key,list);}facingCaches.set(sourceFacing,cache);}
 for(const angle of cache.get(JSON.stringify(before))??[]){
  let diff=targetAngle-angle;if(angle<targetAngle){if(diff>12868)diff-=25736;}else if(diff< -12868)diff+=25736;
  const saturation=turnRate?Math.ceil(Math.abs(diff)/turnRate):0;
  // All phases below saturation are separate; the rest have the same angle.
  const bound=turnRate?saturation:0;
  for(let phase=0;phase<=bound;phase++){
   const output=turnAngle(angle,targetAngle,turnRate,phase);
   if(!valid(output))throw Error('Exact source orientation leaf rejected bounded input');
   if(!same(sourceFacing(output),after))continue;
   rows.push({beforeAngle:angle,targetAngle,turnRate,phase:{min:phase,max:phase===bound?65535:phase},afterAngle:output});
  }
 }
 return {resolved:true,alternatives:rows,phaseDomain:[0,65535],conditions:['Both rendered yaw hypotheses use the ROM actor-angle convention','Exactly one supported ordinary orientation-prefix invocation','Turn rate equals the separately source-bound conditional initialization value','Target bearing was computed from this source node and root hypothesis'],necessaryOrientationOnly:true,translationResolved:false,sourceUpdateCountMeasured:false,ATCallsInOrientationLeaf:0,wholeTickATCallsKnown:false,unknownAlternativeRetained:true};
}
