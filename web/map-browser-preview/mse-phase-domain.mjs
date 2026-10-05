// Input-domain reduction for the source MSE draw-offset recurrence.
// No elapsed seconds / video frames -> native draw count conversion.
const gcd=(a,b)=>{while(b){const c=a%b;a=b;b=c;}return a;};
const lcm=(a,b)=>a/gcd(a,b)*b;
function axes(profile){
 if(!profile?.layers?.length)throw Error('Source MSE layers required');
 return profile.layers.flatMap((l,layerIndex)=>[['S',l.widthFx,l.deltaSFx,Boolean(l.flags&12),l.offsetSFx],['T',l.heightFx,l.deltaTFx,Boolean(l.flags&3),l.offsetTFx]].map(([axis,modulus,increment,advances,initial])=>{
  if(![modulus,increment,initial].every(Number.isInteger)||modulus<=0||increment<0||increment>=modulus||initial!==0)throw Error('Only source-zero initialization and nonnegative single-wrap increment subset is proved');
  return{layerIndex,name:l.name,axis,modulusFx:modulus,incrementFx:increment,advances,initialFx:initial,individualDrawPeriod:advances&&increment?String(BigInt(modulus)/gcd(BigInt(modulus),BigInt(increment))):'1',writer:axis==='S'?0x0207bd34:0x0207bd50,wrap:axis==='S'?0x0207bd68:0x0207bd7c};
 }));
}
export function describeMsePhaseDomain(profile){
 const coordinates=axes(profile),active=coordinates.filter(x=>x.advances&&x.incrementFx!==0);let commonPeriod=1n;for(const c of active)commonPeriod=lcm(commonPeriod,BigInt(c.individualDrawPeriod));
 return{schema:'source-mse-phase-domain-v1',coordinates,independentActiveCoordinateCount:active.length,conditionalCommonDrawCounterPeriod:String(commonPeriod),counterUnit:'Completed executions of this enabled MSE draw loop with every listed layer loaded/positive zoom; offset is used before that execution increments it',counterIsVideoFrame:false,currentCounter:null,currentPhaseProven:false,
  conditionalCounterAssumptions:['All layers retain the same source load and zero-offset epoch','No intervening layer reload or external offset mutation','The manager reaches the draw loop and each listed layer has positive zoom; ordinary whole-manager skips pause the counter for all layers','Source low direction flags and BMED-derived velocity/dimensions remain unchanged'],
  liveDependencies:['Whether each native field draw reached overlay17:02196f20 and passed0207ba90 guards','Manager enable/fade/transition state; no current fade is inferred','Independent video PTS, camera/floor uncertainty and native rendering cadence'],
  nextComparisonContract:{camera:'Retain each current source floor/yaw hypothesis; never choose a camera using a reviewed enemy box',phase:'An explicit finite set/range of common-counter residues, with coverage and every unsearched residue recorded',time:'Unknown transitions in native executed-draw count between observed PTS; no implicit FPS conversion',pixels:'Keep full source pixels, UI/party and effect/render residuals; scores remain hypothesis evidence',unknown:'Independent offset/runtime-mutation branches remain outside the conditional common-counter domain'},
  scope:'Source-derived finite counter domain under explicit unchanged-load assumptions. It is not current phase recovery, full candidate coverage, native parity or an AT counter.'};
}
export function msePhaseAtCommonDrawCounter(profile,counter){
 if(typeof counter!=='bigint'||counter<0n)throw Error('Explicit nonnegative BigInt MSE draw counter required');
 const domain=describeMsePhaseDomain(profile),offsetsFx=profile.layers.map(()=>[0,0]);
 for(const c of domain.coordinates)offsetsFx[c.layerIndex][c.axis==='S'?0:1]=c.advances?Number((counter*BigInt(c.incrementFx))%BigInt(c.modulusFx)):c.initialFx;
 return{kind:'explicit-offsets',offsetsFx,evidence:{producer:'source-mse-draw-recurrence',counter:String(counter),counterResidue:String(counter%BigInt(domain.conditionalCommonDrawCounterPeriod)),period:domain.conditionalCommonDrawCounterPeriod,assumptions:domain.conditionalCounterAssumptions,currentCounterObserved:false,currentPhaseProven:false,minimumProvenATCalls:0}};
}
